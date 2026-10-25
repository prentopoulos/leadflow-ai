import { randomUUID } from 'node:crypto';
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
  type WorkflowStep,
} from '@leadflow-ai/domain';
import type { QualificationInterpreter } from './interpreter.js';
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
  idFactory?: () => string;
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

export function compileQualificationWorkflow(
  dependencies: QualificationWorkflowDependencies,
): CompiledQualificationWorkflow {
  const idFactory = dependencies.idFactory ?? randomUUID;
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
    return dependencies.lifecycle.commitRunEvent({
      runId: state.runId,
      expectedRevision: state.runRevision,
      next: nextRunState(run, { currentStep: step, safeError: null }),
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

  const graph = new StateGraph(QualificationGraphStateSchema)
    .addNode(QUALIFICATION_GRAPH_NODES[0], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      const started = await startStep(state, 'interpret_qualification');
      const interpretation = await dependencies.interpreter.interpret(
        state.projection,
      );
      const completed = await completeStep(
        state,
        started.run,
        'interpret_qualification',
      );
      return { interpretation, runRevision: completed.run.revision };
    })
    .addNode(QUALIFICATION_GRAPH_NODES[1], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      if (state.interpretation === null) {
        throw new Error('Qualification interpretation is unavailable.');
      }
      const started = await startStep(state, 'score_qualification');
      const qualification = scoreQualification(state.interpretation, {
        resultId: idFactory(),
        runId: state.runId,
        leadId: state.leadId,
        generatedAt: now(),
      });
      await dependencies.repositories.qualificationResults.create(
        qualification,
      );
      const completed = await completeStep(
        state,
        started.run,
        'score_qualification',
        { qualificationResultId: qualification.resultId },
      );
      return { qualification, runRevision: completed.run.revision };
    })
    .addNode(QUALIFICATION_GRAPH_NODES[2], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      if (state.qualification === null) {
        throw new Error('Qualification result is unavailable.');
      }
      const started = await startStep(state, 'simulate_outcome');
      const simulation = simulateOutcome({
        runId: state.runId,
        generatedAt: now(),
      });
      await dependencies.repositories.simulationRecords.create(simulation);
      const completed = await completeStep(
        state,
        started.run,
        'simulate_outcome',
        { simulationRecordId: simulation.simulationRecordId },
        'simulation.completed',
      );
      return { simulation, runRevision: completed.run.revision };
    })
    .addNode(QUALIFICATION_GRAPH_NODES[3], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      if (state.qualification === null || state.simulation === null) {
        throw new Error('Workflow cannot finalize incomplete results.');
      }
      const started = await startStep(state, 'finalize_run');
      const completedSteps = started.run.completedSteps.includes('finalize_run')
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
      return { finalized: true, runRevision: completed.run.revision };
    })
    .addEdge(START, QUALIFICATION_GRAPH_NODES[0])
    .addEdge(QUALIFICATION_GRAPH_NODES[0], QUALIFICATION_GRAPH_NODES[1])
    .addEdge(QUALIFICATION_GRAPH_NODES[1], QUALIFICATION_GRAPH_NODES[2])
    .addEdge(QUALIFICATION_GRAPH_NODES[2], QUALIFICATION_GRAPH_NODES[3])
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
    finalized: false,
  });
}
