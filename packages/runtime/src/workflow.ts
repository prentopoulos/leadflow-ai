import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { RunnableConfig } from '@langchain/core/runnables';
import {
  END,
  START,
  StateGraph,
  type BaseCheckpointSaver,
} from '@langchain/langgraph';
import {
  AGENT_VERSIONS,
  AgentBriefRecordSchema,
  agentProjectionFrom,
  CONTRACT_VERSIONS,
  QualificationGraphStateSchema,
  scoreQualification,
  simulateOutcome,
  verifyOutputs,
  type EnrichmentEvidence,
  type LifecycleEvent,
  type QualificationGraphState,
  type RunDocument,
  type SafeError,
  type WorkflowStep,
} from '@leadflow-ai/domain';
import {
  AGENT_PROMPTS_SHA256,
  runAgentTeam,
  type ModelPort,
  type SpendLedger,
} from './agent-team.js';
import {
  agentBriefIdFor,
  agentBriefIdOf,
  deterministicUuid,
  sha256Hex,
  templateRevision,
} from './drafts.js';
import {
  EnrichmentRefusedError,
  checkEmail,
  lookupVehicle,
  lookupZip,
  type AttemptRecord,
  type EnrichmentTransport,
  type LookupResult,
} from './enrichment.js';
import {
  SyntheticTransientFault,
  type QualificationInterpreter,
} from './interpreter.js';
import type { LifecyclePersistenceService, NextRunState } from './lifecycle.js';
import type { FirestoreRepositories } from './repositories.js';
import type { RunEventReader } from './run-detail.js';

export const QUALIFICATION_GRAPH_VERSION = 'phase-2-graph-v1' as const;
export const QUALIFICATION_GRAPH_NODES = [
  'interpretQualification',
  'scoreQualification',
  'enrichLead',
  'composeDraft',
  'verifyOutputs',
  'simulateOutcome',
  'finalizeRun',
] as const;

export interface WorkflowEnrichmentDependencies {
  transport: EnrichmentTransport;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  timeoutMs?: number;
}

export interface QualificationWorkflowDependencies {
  interpreter: QualificationInterpreter;
  lifecycle: LifecyclePersistenceService;
  repositories: FirestoreRepositories;
  checkpointer: BaseCheckpointSaver;
  enrichment: WorkflowEnrichmentDependencies;
  events: RunEventReader;
  // Present only when the local process was started with --agents=claude.
  agents?: { port: ModelPort; ledger: SpendLedger };
  now?: () => string;
  idFactory?: () => string;
}

export class WorkflowIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowIntegrityError';
  }
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
    enrichmentMode: run.enrichmentMode,
    enrichmentEvidenceIds: run.enrichmentEvidenceIds,
    emailCheckId: run.emailCheckId,
    evidenceCompleteness: run.evidenceCompleteness,
    draftId: run.draftId,
    draftSkipReason: run.draftSkipReason,
    verificationResultId: run.verificationResultId,
    holds: run.holds,
    ...patch,
  };
}

function attemptTelemetry(attempt: AttemptRecord) {
  return { durationMs: attempt.durationMs, externalCall: attempt.telemetry };
}

function safeErrorFrom(error: unknown): SafeError {
  if (error instanceof WorkflowIntegrityError) {
    return {
      code: 'invariant_failed',
      category: 'runtime',
      retryable: false,
      message: 'Stored run records failed an integrity check.',
    };
  }
  if (error instanceof EnrichmentRefusedError) {
    return {
      code: 'invariant_failed',
      category: 'runtime',
      retryable: false,
      message: 'An enrichment request targeted an unauthorized endpoint.',
    };
  }
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
  const idFactory = dependencies.idFactory ?? randomUUID;

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

  // Step durations use the workflow clock, keyed per run so one compiled
  // graph can serve concurrent runs.
  const stepStarts = new Map<string, number>();
  const stepKey = (state: QualificationGraphState, step: WorkflowStep) =>
    `${state.runId}:${step}`;
  function elapsedMs(state: QualificationGraphState, step: WorkflowStep) {
    const key = stepKey(state, step);
    const started = stepStarts.get(key);
    stepStarts.delete(key);
    return started === undefined
      ? null
      : Math.max(0, Date.parse(now()) - started);
  }

  async function startStep(state: QualificationGraphState, step: WorkflowStep) {
    const run = await storedRun(state);
    stepStarts.set(stepKey(state, step), Date.parse(now()));
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
      durationMs: elapsedMs(state, step),
      traceId: state.traceId,
      requestId: state.requestId,
      authorization: 'not_applicable',
    });
  }

  async function commitStepEvent(
    state: QualificationGraphState,
    run: RunDocument,
    step: WorkflowStep,
    eventName: LifecycleEvent['name'],
    options: {
      durationMs?: number | null;
      externalCall?: LifecycleEvent['externalCall'];
      patch?: Partial<NextRunState>;
    } = {},
  ) {
    return dependencies.lifecycle.commitRunEvent({
      runId: state.runId,
      expectedRevision: run.revision,
      next: nextRunState(run, options.patch ?? {}),
      eventName,
      step,
      durationMs: options.durationMs ?? null,
      externalCall: options.externalCall ?? null,
      traceId: state.traceId,
      requestId: state.requestId,
      authorization: 'not_applicable',
    });
  }

  async function loadLead(state: QualificationGraphState) {
    const lead = await dependencies.repositories.leads.get(state.leadId);
    if (lead === null) throw new WorkflowIntegrityError('Lead is missing.');
    return lead;
  }

  async function loadEvidence(ids: readonly string[]) {
    const records = await Promise.all(
      ids.map((id) => dependencies.repositories.enrichmentEvidence.get(id)),
    );
    if (records.some((record) => record === null)) {
      throw new WorkflowIntegrityError('Linked evidence is missing.');
    }
    return records.filter(
      (record): record is EnrichmentEvidence => record !== null,
    );
  }

  // Runs the agent team once per run and evidence set; a replayed step
  // reuses the stored brief instead of paying for a second run.
  async function agentBriefFor(
    state: QualificationGraphState,
    lead: Awaited<ReturnType<typeof loadLead>>,
    evidence: readonly EnrichmentEvidence[],
  ) {
    const agents = dependencies.agents;
    if (agents === undefined) return null;
    const briefId = agentBriefIdFor(state.runId, state.enrichmentEvidenceIds);
    const stored = await dependencies.repositories.agentBriefs.get(briefId);
    if (stored !== null) {
      if (stored.status !== 'in_progress') return stored;
      // A prior process stopped after reserving/potentially making a paid
      // call. Preserve that conservative cost record and fall back instead of
      // spending again for the same lead.
      return dependencies.repositories.agentBriefs.set({
        ...stored,
        status: 'fallback',
        fallbackReason: 'model_error',
      });
    }
    const projection = agentProjectionFrom({ intake: lead.intake, evidence });
    const createdAt = now();
    const record = (outcome: Awaited<ReturnType<typeof runAgentTeam>>) =>
      AgentBriefRecordSchema.parse({
        schemaVersion: AGENT_VERSIONS.brief,
        briefId,
        runId: state.runId,
        leadId: state.leadId,
        createdAt,
        teamVersion: AGENT_VERSIONS.team,
        rulesVersion: AGENT_VERSIONS.rules,
        promptsSha256: AGENT_PROMPTS_SHA256,
        projectionSha256: sha256Hex(JSON.stringify(projection)),
        ...outcome,
      });
    let progressWrites = Promise.resolve();
    const outcome = await runAgentTeam({
      projection,
      port: agents.port,
      budget: agents.ledger.forLead(),
      onProgress: async (progress) => {
        const snapshot = record(progress);
        progressWrites = progressWrites.then(async () => {
          await dependencies.repositories.agentBriefs.set(snapshot);
        });
        await progressWrites;
      },
    });
    const brief = record(outcome);
    return dependencies.repositories.agentBriefs.set(brief);
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
      durationMs: elapsedMs(state, 'interpret_qualification'),
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
      durationMs: elapsedMs(state, step),
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
      const started = await startStep(state, 'enrich_lead');
      // Each node commits several events; failure handling must use the
      // latest committed revision, not the one from the step start.
      let current = started.run;
      try {
        const { transport, sleep, random, timeoutMs } = dependencies.enrichment;
        const lookupContext = (evidenceId: string) => ({
          transport,
          runId: state.runId,
          leadId: state.leadId,
          evidenceId,
          now,
          ...(sleep === undefined ? {} : { sleep }),
          ...(random === undefined ? {} : { random }),
          ...(timeoutMs === undefined ? {} : { timeoutMs }),
        });
        // Fresh evidence ids on every execution: a reclaimed run repeats its
        // lookups, and earlier records stay stored but unlinked (superseded).
        const settled = await Promise.allSettled([
          lookupVehicle(state.projection, lookupContext(idFactory())),
          lookupZip(state.projection.zipCode, lookupContext(idFactory())),
        ]);
        const lookups: LookupResult[] = settled.map((outcome) => {
          if (outcome.status === 'rejected') throw outcome.reason;
          return outcome.value;
        });
        for (const { evidence } of lookups) {
          await dependencies.repositories.enrichmentEvidence.createIdempotent(
            evidence,
          );
        }
        const emailCheckId = deterministicUuid('email-check', state.runId);
        const storedCheck =
          await dependencies.repositories.emailChecks.get(emailCheckId);
        const emailCheck = checkEmail({
          email: state.projection.email,
          emailCheckId,
          runId: state.runId,
          leadId: state.leadId,
          checkedAt: storedCheck?.checkedAt ?? now(),
        });
        await dependencies.repositories.emailChecks.createIdempotent(
          emailCheck,
        );
        // Lookups ran concurrently; their attempt events are committed in
        // order afterwards so every attempt stays on one revision line.
        for (const { attempts } of lookups) {
          for (const attempt of attempts) {
            if (attempt.failureKind !== null) {
              current = (
                await commitStepEvent(
                  state,
                  current,
                  'enrich_lead',
                  'enrichment.attempt_failed',
                  attemptTelemetry(attempt),
                )
              ).run;
            }
            if (attempt.retryScheduled) {
              current = (
                await commitStepEvent(
                  state,
                  current,
                  'enrich_lead',
                  'enrichment.retry_scheduled',
                )
              ).run;
            }
          }
          const last = attempts.at(-1);
          current = (
            await commitStepEvent(
              state,
              current,
              'enrich_lead',
              'enrichment.lookup_completed',
              last === undefined ? {} : attemptTelemetry(last),
            )
          ).run;
        }
        current = (
          await commitStepEvent(
            state,
            current,
            'enrich_lead',
            'email_check.completed',
          )
        ).run;
        const evidenceIds = lookups.map(({ evidence }) => evidence.evidenceId);
        const partial = lookups.some(
          ({ evidence }) => evidence.outcome === 'unavailable',
        );
        const completed = await completeStep(state, current, 'enrich_lead', {
          enrichmentMode: transport.mode,
          enrichmentEvidenceIds: evidenceIds,
          emailCheckId,
          evidenceCompleteness: partial ? 'partial' : 'complete',
        });
        return {
          enrichmentEvidenceIds: evidenceIds,
          emailCheckId,
          safeError: null,
          runRevision: completed.run.revision,
        };
      } catch (error) {
        const safeError = safeErrorFrom(error);
        const failed = await failStepAndRun(
          state,
          current,
          'enrich_lead',
          safeError,
        );
        return { safeError, runRevision: failed.run.revision };
      }
    })
    .addNode(QUALIFICATION_GRAPH_NODES[3], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      const started = await startStep(state, 'compose_draft');
      let current = started.run;
      try {
        if (state.qualification === null) {
          throw new Error('Qualification result is unavailable.');
        }
        const skipReason = !state.emailContactConsent
          ? ('no_consent' as const)
          : state.qualification.priority === null
            ? ('qualification_held' as const)
            : null;
        let draftRevisionId: string | null = null;
        if (skipReason !== null) {
          current = (
            await commitStepEvent(
              state,
              current,
              'compose_draft',
              'draft.skipped',
              { patch: { draftId: null, draftSkipReason: skipReason } },
            )
          ).run;
        } else {
          const [lead, evidence] = await Promise.all([
            loadLead(state),
            loadEvidence(state.enrichmentEvidenceIds),
          ]);
          const agentBrief =
            dependencies.agents === undefined
              ? null
              : await agentBriefFor(state, lead, evidence);
          const composed = templateRevision({
            run: current,
            lead,
            qualification: state.qualification,
            evidence,
            createdAt: now(),
            agentBrief,
          });
          const stored = await dependencies.repositories.draftRevisions.get(
            composed.draftId,
            composed.revisionId,
          );
          const revision =
            stored === null
              ? composed
              : { ...composed, createdAt: stored.createdAt };
          await dependencies.repositories.draftRevisions.createIdempotent(
            revision,
          );
          draftRevisionId = revision.revisionId;
          current = (
            await commitStepEvent(
              state,
              current,
              'compose_draft',
              'draft.composed',
              { patch: { draftId: revision.draftId, draftSkipReason: null } },
            )
          ).run;
        }
        const completed = await completeStep(state, current, 'compose_draft');
        return {
          draftRevisionId,
          safeError: null,
          runRevision: completed.run.revision,
        };
      } catch (error) {
        const safeError = safeErrorFrom(error);
        const failed = await failStepAndRun(
          state,
          current,
          'compose_draft',
          safeError,
        );
        return { safeError, runRevision: failed.run.revision };
      }
    })
    .addNode(QUALIFICATION_GRAPH_NODES[4], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      const started = await startStep(state, 'verify_outputs');
      let current = started.run;
      try {
        const [lead, evidence, rawEvents] = await Promise.all([
          loadLead(state),
          loadEvidence(state.enrichmentEvidenceIds),
          dependencies.events.list(state.runId, 1_000),
        ]);
        const draft =
          current.draftId === null || state.draftRevisionId === null
            ? null
            : await dependencies.repositories.draftRevisions.get(
                current.draftId,
                state.draftRevisionId,
              );
        if (state.draftRevisionId !== null && draft === null) {
          throw new WorkflowIntegrityError('Composed draft is missing.');
        }
        const briefId = draft === null ? null : agentBriefIdOf(draft);
        const agentBrief =
          briefId === null
            ? null
            : await dependencies.repositories.agentBriefs.get(briefId);
        const verificationResultId =
          draft?.verificationResultId ??
          deterministicUuid(
            'verification-result',
            state.runId,
            ...state.enrichmentEvidenceIds,
          );
        // A replayed step reuses its stored verdict rather than re-deriving
        // it from an event history that has since grown.
        const verification =
          (await dependencies.repositories.verificationResults.get(
            verificationResultId,
          )) ??
          verifyOutputs({
            verificationResultId,
            runId: state.runId,
            leadId: state.leadId,
            verifiedAt: now(),
            intake: lead.intake,
            priority: state.qualification?.priority ?? null,
            evidence,
            sha256: sha256Hex,
            events: rawEvents.map((event) =>
              dependencies.repositories.events.parseStored(event),
            ),
            draft,
            scope: 'run',
            agentBrief,
          });
        await dependencies.repositories.verificationResults.createIdempotent(
          verification,
        );
        if (!verification.integrityPassed) {
          throw new WorkflowIntegrityError(
            'Evidence or event integrity verification failed.',
          );
        }
        current = (
          await commitStepEvent(
            state,
            current,
            'verify_outputs',
            'verification.completed',
            {
              patch: {
                verificationResultId,
                holds:
                  verification.draftPassed === false
                    ? ['draft_verification_blocked']
                    : [],
              },
            },
          )
        ).run;
        const completed = await completeStep(state, current, 'verify_outputs');
        return {
          verificationResultId,
          safeError: null,
          runRevision: completed.run.revision,
        };
      } catch (error) {
        const safeError = safeErrorFrom(error);
        const failed = await failStepAndRun(
          state,
          current,
          'verify_outputs',
          safeError,
        );
        return { safeError, runRevision: failed.run.revision };
      }
    })
    .addNode(QUALIFICATION_GRAPH_NODES[5], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      const started = await startStep(state, 'simulate_outcome');
      try {
        if (state.qualification === null) {
          throw new Error('Qualification result is unavailable.');
        }
        const simulationRecordId = `${state.runId}:${CONTRACT_VERSIONS.simulator}`;
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
    .addNode(QUALIFICATION_GRAPH_NODES[6], async (candidate) => {
      const state = QualificationGraphStateSchema.parse(candidate);
      const started = await startStep(state, 'finalize_run');
      try {
        if (
          state.qualification === null ||
          state.simulation === null ||
          state.verificationResultId === null
        ) {
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
          durationMs: elapsedMs(state, 'finalize_run'),
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
    .addConditionalEdges(QUALIFICATION_GRAPH_NODES[3], routeAfterStep, {
      continue: QUALIFICATION_GRAPH_NODES[4],
      failed: END,
    })
    .addConditionalEdges(QUALIFICATION_GRAPH_NODES[4], routeAfterStep, {
      continue: QUALIFICATION_GRAPH_NODES[5],
      failed: END,
    })
    .addConditionalEdges(QUALIFICATION_GRAPH_NODES[5], routeAfterStep, {
      continue: QUALIFICATION_GRAPH_NODES[6],
      failed: END,
    })
    .addEdge(QUALIFICATION_GRAPH_NODES[6], END);

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
  emailContactConsent: boolean;
}): QualificationGraphState {
  return QualificationGraphStateSchema.parse({
    schemaVersion: CONTRACT_VERSIONS.graphState,
    ...input,
    interpretation: null,
    qualification: null,
    enrichmentEvidenceIds: [],
    emailCheckId: null,
    draftRevisionId: null,
    verificationResultId: null,
    simulation: null,
    safeError: null,
    finalized: false,
  });
}
