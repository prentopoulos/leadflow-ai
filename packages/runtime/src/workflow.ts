import { isDeepStrictEqual } from 'node:util';
import type { RunnableConfig } from '@langchain/core/runnables';
import {
  END,
  START,
  StateGraph,
  type BaseCheckpointSaver,
} from '@langchain/langgraph';
import {
  PHASE_ONE_VERSIONS,
  QualificationGraphStateSchema,
  scoreQualification,
  simulateOutcome,
  type QualificationGraphState,
  type RunDocument,
  type SafeError,
  type WorkflowStep,
} from '@leadflow-ai/domain';
import {
  SyntheticTransientFault,
  type QualificationInterpreter,
} from './interpreter.js';
import type { LifecyclePersistenceService, NextRunState } from './lifecycle.js';
import type { FirestoreRepositories } from './repositories.js';

export const QUALIFICATION_GRAPH_VERSION = 'qualification-graph-v1' as const;
export const QUALIFICATION_GRAPH_NODES = [
  'interpretQualification',
  'scoreQualification',
  'simulateOutcome',
  'finalizeRun',
] as const;

export interface QualificationWorkflowDependencies {
  interpreter: QualificationInterpreter;
  lifecycle: LifecyclePersistenceService;
  repositories: FirestoreRepositories;
  checkpointer: BaseCheckpointSaver;
  now?: () => string;
}

export interface CompiledQualificationWorkflow {
  invoke(
    input: QualificationGraphState,
    config: RunnableConfig,
  ): Promise<QualificationGraphState>;
}

function nextRunState(
  run: RunDocument,
  patch: Partial<NextRunState>,
): NextRunState {
  return {
    status: run.status,
    attempt: run.attempt,
    retryCount: run.retryCount,
    currentStep: run.currentStep,
    completedSteps: run.completedSteps,
    lease: run.lease,
    qualificationResultId: run.qualificationResultId,
    simulationRecordId: run.simulationRecordId,
    safeError: run.safeError,
    ...patch,
  };
}

function safeErrorFrom(error: unknown): SafeError {
  if (error instanceof SyntheticTransientFault) {
    return {
      code: 'transient_interpreter_fault',
      category: 'runtime',
      retryable: true,
      message:
        'The deterministic interpreter returned a synthetic transient fault.',
    };
  }
  return {
    code: 'unknown_failure',
    category: 'runtime',
    retryable: false,
    message: 'The qualification workflow stopped after a safe failure.',
  };
}

export function compileQualificationWorkflow(
  dependencies: QualificationWorkflowDependencies,
): CompiledQualificationWorkflow {
  const now = dependencies.now ?? (() => new Date().toISOString());

  async function storedRun(state: QualificationGraphState) {
    const run = await dependencies.repositories.runs.get(state.runId);
    if (run === null) throw new Error('Workflow run is missing.');
    if (
      run.leadId !== state.leadId ||
      run.systemBundleId !== state.systemBundleId
    ) {
      throw new Error('Workflow state identity mismatched the stored run.');
    }
    return run;
  }

  async function startStep(state: QualificationGraphState, step: WorkflowStep) {
    const run = await storedRun(state);
    const attempt =
      step === 'interpret_qualification' && run.attempt === 0 ? 1 : run.attempt;
    return dependencies.lifecycle.commitRunEvent({
      runId: state.runId,
      expectedRevision: state.runRevision,
      next: nextRunState(run, {
        attempt,
        currentStep: step,
        safeError: null,
      }),
      eventName: 'step.started',
      step,
      durationMs: null,
      traceId: state.traceId,
      requestId: state.requestId,
      authorization: 'not_applicable',
    });
  }

  async function completeStep(
    state: QualificationGraphState,
    startedRun: Awaited<ReturnType<typeof startStep>>['run'],
    step: WorkflowStep,
    patch: Partial<NextRunState> = {},
    eventName: 'step.completed' | 'simulation.completed' = 'step.completed',
  ) {
    const completedSteps = startedRun.completedSteps.includes(step)
      ? startedRun.completedSteps
      : [...startedRun.completedSteps, step];
    return dependencies.lifecycle.commitRunEvent({
      runId: state.runId,
      expectedRevision: startedRun.revision,
      next: nextRunState(startedRun, {
        currentStep: null,
        completedSteps,
        ...patch,
      }),
      eventName,
      step,
      durationMs: null,
      traceId: state.traceId,
      requestId: state.requestId,
      authorization: 'not_applicable',
    });
  }

  async function scheduleInterpreterRetry(
    state: QualificationGraphState,
    startedRun: RunDocument,
    safeError: SafeError,
  ) {
    const failed = await dependencies.lifecycle.commitRunEvent({
      runId: state.runId,
      expectedRevision: startedRun.revision,
      next: nextRunState(startedRun, {
        status: 'retrying',
        currentStep: 'interpret_qualification',
        safeError,
      }),
      eventName: 'step.failed',
      step: 'interpret_qualification',
      durationMs: null,
      traceId: state.traceId,
      requestId: state.requestId,
      authorization: 'not_applicable',
    });
    return dependencies.lifecycle.commitRunEvent({
      runId: state.runId,
      expectedRevision: failed.run.revision,
      next: nextRunState(failed.run, {
        status: 'running',
        attempt: 2,
        retryCount: 1,
        currentStep: 'interpret_qualification',
        safeError,
      }),
      eventName: 'step.retry_scheduled',
      step: 'interpret_qualification',
      durationMs: null,
      traceId: state.traceId,
      requestId: state.requestId,
      authorization: 'not_applicable',
    });
  }

  async function failStepAndRun(
    state: QualificationGraphState,
    startedRun: RunDocument,
    step: WorkflowStep,
    safeError: SafeError,
  ) {
    const failedStep = await dependencies.lifecycle.commitRunEvent({
      runId: state.runId,
      expectedRevision: startedRun.revision,
      next: nextRunState(startedRun, {
        status: 'partial',
        currentStep: step,
        safeError,
      }),
      eventName: 'step.failed',
      step,
      durationMs: null,
      traceId: state.traceId,
      requestId: state.requestId,
      authorization: 'not_applicable',
    });
    return dependencies.lifecycle.commitRunEvent({
      runId: state.runId,
      expectedRevision: failedStep.run.revision,
      next: nextRunState(failedStep.run, {
        status: safeError.retryable ? 'failed_retryable' : 'failed_terminal',
        currentStep: step,
        lease: null,
        safeError,
      }),
      eventName: 'run.failed',
      step,
      durationMs: null,
      traceId: state.traceId,
      requestId: state.requestId,
      authorization: 'not_applicable',
    });
  }

  const routeAfterStep = (candidate: QualificationGraphState) =>
    QualificationGraphStateSchema.parse(candidate).safeError === null
      ? 'continue'
      : 'failed';

  const graph = new StateGraph(QualificationGraphStateSchema)
    .addNode(QUALIFICATION_GRAPH_NODES[0], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      let started = await startStep(state, 'interpret_qualification');
      for (;;) {
        try {
          const interpretation = await dependencies.interpreter.interpret(
            state.projection,
          );
          const completed = await completeStep(
            state,
            started.run,
            'interpret_qualification',
          );
          return {
            interpretation,
            safeError: null,
            runRevision: completed.run.revision,
          };
        } catch (error) {
          const safeError = safeErrorFrom(error);
          if (
            error instanceof SyntheticTransientFault &&
            started.run.retryCount === 0
          ) {
            const scheduled = await scheduleInterpreterRetry(
              state,
              started.run,
              safeError,
            );
            started = await startStep(
              { ...state, runRevision: scheduled.run.revision },
              'interpret_qualification',
            );
            continue;
          }
          const failed = await failStepAndRun(
            state,
            started.run,
            'interpret_qualification',
            safeError,
          );
          return { safeError, runRevision: failed.run.revision };
        }
      }
    })
    .addNode(QUALIFICATION_GRAPH_NODES[1], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      const started = await startStep(state, 'score_qualification');
      try {
        if (state.interpretation === null) {
          throw new Error('Qualification interpretation is unavailable.');
        }
        const storedQualification =
          await dependencies.repositories.qualificationResults.get(state.runId);
        const qualification = scoreQualification(state.interpretation, {
          resultId: state.runId,
          runId: state.runId,
          leadId: state.leadId,
          generatedAt: storedQualification?.generatedAt ?? now(),
        });
        if (
          storedQualification !== null &&
          !isDeepStrictEqual(storedQualification, qualification)
        ) {
          throw new Error('Stored qualification result is incompatible.');
        }
        await dependencies.repositories.qualificationResults.createIdempotent(
          qualification,
        );
        const completed = await completeStep(
          state,
          started.run,
          'score_qualification',
          { qualificationResultId: qualification.resultId },
        );
        return {
          qualification,
          safeError: null,
          runRevision: completed.run.revision,
        };
      } catch (error) {
        const safeError = safeErrorFrom(error);
        const failed = await failStepAndRun(
          state,
          started.run,
          'score_qualification',
          safeError,
        );
        return { safeError, runRevision: failed.run.revision };
      }
    })
    .addNode(QUALIFICATION_GRAPH_NODES[2], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      const started = await startStep(state, 'simulate_outcome');
      try {
        if (state.qualification === null) {
          throw new Error('Qualification result is unavailable.');
        }
        const simulationRecordId = `${state.runId}:${PHASE_ONE_VERSIONS.simulator}`;
        const storedSimulation =
          await dependencies.repositories.simulationRecords.get(
            simulationRecordId,
          );
        const simulation = simulateOutcome({
          runId: state.runId,
          generatedAt: storedSimulation?.generatedAt ?? now(),
        });
        if (
          storedSimulation !== null &&
          !isDeepStrictEqual(storedSimulation, simulation)
        ) {
          throw new Error('Stored simulation record is incompatible.');
        }
        await dependencies.repositories.simulationRecords.createIdempotent(
          simulation,
        );
        const completed = await completeStep(
          state,
          started.run,
          'simulate_outcome',
          { simulationRecordId: simulation.simulationRecordId },
          'simulation.completed',
        );
        return {
          simulation,
          safeError: null,
          runRevision: completed.run.revision,
        };
      } catch (error) {
        const safeError = safeErrorFrom(error);
        const failed = await failStepAndRun(
          state,
          started.run,
          'simulate_outcome',
          safeError,
        );
        return { safeError, runRevision: failed.run.revision };
      }
    })
    .addNode(QUALIFICATION_GRAPH_NODES[3], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      const started = await startStep(state, 'finalize_run');
      try {
        if (state.qualification === null || state.simulation === null) {
          throw new Error('Workflow cannot finalize incomplete results.');
        }
        const completedSteps = started.run.completedSteps.includes(
          'finalize_run',
        )
          ? started.run.completedSteps
          : [...started.run.completedSteps, 'finalize_run' as const];
        const completed = await dependencies.lifecycle.commitRunEvent({
          runId: state.runId,
          expectedRevision: started.run.revision,
          next: nextRunState(started.run, {
            status: 'complete',
            currentStep: null,
            completedSteps,
            lease: null,
            safeError: null,
          }),
          eventName: 'run.completed',
          step: 'finalize_run',
          durationMs: null,
          traceId: state.traceId,
          requestId: state.requestId,
          authorization: 'not_applicable',
        });
        return {
          finalized: true,
          safeError: null,
          runRevision: completed.run.revision,
        };
      } catch (error) {
        const safeError = safeErrorFrom(error);
        const failed = await failStepAndRun(
          state,
          started.run,
          'finalize_run',
          safeError,
        );
        return { safeError, runRevision: failed.run.revision };
      }
    })
    .addEdge(START, QUALIFICATION_GRAPH_NODES[0])
    .addConditionalEdges(QUALIFICATION_GRAPH_NODES[0], routeAfterStep, {
      continue: QUALIFICATION_GRAPH_NODES[1],
      failed: END,
    })
    .addConditionalEdges(QUALIFICATION_GRAPH_NODES[1], routeAfterStep, {
      continue: QUALIFICATION_GRAPH_NODES[2],
      failed: END,
    })
    .addConditionalEdges(QUALIFICATION_GRAPH_NODES[2], routeAfterStep, {
      continue: QUALIFICATION_GRAPH_NODES[3],
      failed: END,
    })
    .addEdge(QUALIFICATION_GRAPH_NODES[3], END);

  return graph.compile({
    checkpointer: dependencies.checkpointer,
  }) as CompiledQualificationWorkflow;
}

export function initialQualificationGraphState(input: {
  runId: string;
  leadId: string;
  traceId: string;
  requestId: string;
  systemBundleId: string;
  runRevision: number;
  projection: QualificationGraphState['projection'];
}): QualificationGraphState {
  return QualificationGraphStateSchema.parse({
    schemaVersion: PHASE_ONE_VERSIONS.graphState,
    ...input,
    interpretation: null,
    qualification: null,
    simulation: null,
    safeError: null,
    finalized: false,
  });
}
