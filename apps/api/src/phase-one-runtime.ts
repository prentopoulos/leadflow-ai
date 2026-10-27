import {
  HOSTED_TARGET,
  type ExecuteResponse,
  type QualificationGraphState,
} from '@leadflow-ai/domain';
import {
  AGENT_PROMPTS_SHA256,
  AnthropicModelPort,
  SpendLedger,
  type ModelPort,
  AdminDraftReader,
  projectDigest,
  AdminRunEventReader,
  AdminRunReader,
  DeterministicQualificationInterpreter,
  DraftService,
  QualificationResumeService,
  WorkflowExecutor,
  OperationsService,
  compileQualificationWorkflow,
  createEnrichmentTransport,
  createFirestoreCheckpointSaver,
  createFirestoreRepositories,
  createIntakePersistenceService,
  createLifecyclePersistenceService,
  createRunDetailService,
  initialQualificationGraphState,
  qualificationProjectionFromLead,
  resetLocalEmulatorData,
  RunNotFoundError,
  type EnrichmentTransport,
  type QualificationInterpreter,
} from '@leadflow-ai/runtime';
import { z } from 'zod';
import type { ExecuteRouteDependencies } from './execute-route.js';
import type { IntakeRouteDependencies } from './intake-route.js';
import type { ResetRouteDependencies } from './reset-route.js';
import type { ResumeRouteDependencies } from './resume-route.js';
import type { RunRouteDependencies } from './run-route.js';
import type { OperationsRouteDependencies } from './operations-route.js';
import type { ReadyStartup } from './startup.js';

const SystemBundleIdSchema = z.string().uuid();

export interface PhaseOneApiDependencies {
  intake: IntakeRouteDependencies;
  runs: RunRouteDependencies;
  resume: ResumeRouteDependencies;
  reset: ResetRouteDependencies;
  drafts: DraftService;
  operations: OperationsRouteDependencies;
  executor: WorkflowExecutor;
  // Present only in hosted mode, where intake starts no post-response work.
  execute?: ExecuteRouteDependencies;
}

export interface PhaseOneApiRuntimeOptions {
  interpreter?: QualificationInterpreter;
  now?: () => string;
  // Tests inject a fixture transport; otherwise the configured mode decides.
  enrichmentTransport?: EnrichmentTransport;
  enrichmentSleep?: (milliseconds: number) => Promise<void>;
  executor?: WorkflowExecutor;
  executionDeadlineMs?: number;
  // Tests inject a fake model; otherwise the Anthropic adapter is used when
  // the local configuration enables agents.
  modelPort?: ModelPort;
}

// Holds hosted work inside the request: new graph steps stop at the deadline
// so the stored run, not the response, explains where execution ended.
async function withinDeadline<T = QualificationGraphState>(
  deadlineMs: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T | 'deadline'> {
  const signal = AbortSignal.timeout(deadlineMs);
  try {
    return await work(signal);
  } catch (cause) {
    if (signal.aborted) return 'deadline';
    throw cause;
  }
}

export async function createPhaseOneApiDependencies(
  startup: ReadyStartup,
  systemBundleId: string,
  options: PhaseOneApiRuntimeOptions = {},
): Promise<PhaseOneApiDependencies> {
  const validatedBundleId = SystemBundleIdSchema.parse(systemBundleId);
  const { database } = startup.firestore;
  const enrichmentMode = startup.configuration.enrichmentMode;
  const repositories = createFirestoreRepositories(database);
  const systemBundle = await repositories.systemBundles.get(validatedBundleId);
  const hosted = startup.configuration.mode === 'cloud';
  const deploymentMatches =
    systemBundle !== null &&
    (startup.configuration.mode === 'cloud'
      ? systemBundle.deployment.mode === 'cloud' &&
        systemBundle.deployment.projectDigest ===
          projectDigest(startup.configuration.projectId) &&
        systemBundle.deployment.revision === startup.configuration.revision &&
        systemBundle.deployment.imageDigest ===
          startup.configuration.imageDigest
      : systemBundle.deployment.mode === 'local' &&
        systemBundle.deployment.projectId === startup.configuration.projectId);
  if (
    systemBundle === null ||
    !deploymentMatches ||
    systemBundle.enrichmentMode !== enrichmentMode
  ) {
    throw new Error('Compatible persisted system bundle is unavailable.');
  }
  const agentsEnabled =
    startup.configuration.mode === 'local' &&
    startup.configuration.agents === 'claude';
  // The bundle must say exactly what drafts this process produces.
  const bundleAgents =
    systemBundle.versions.agentTeam !== null &&
    systemBundle.prompt.value !== null &&
    systemBundle.prompt.value.sha256 === AGENT_PROMPTS_SHA256;
  if (agentsEnabled !== bundleAgents) {
    throw new Error('The system bundle does not match the agent setting.');
  }
  const agents = agentsEnabled
    ? {
        port:
          options.modelPort ??
          new AnthropicModelPort(process.env.ANTHROPIC_API_KEY ?? ''),
        ledger: new SpendLedger(),
      }
    : undefined;
  const transport =
    options.enrichmentTransport ??
    (await createEnrichmentTransport(enrichmentMode));
  if (transport.mode !== enrichmentMode) {
    throw new Error('The enrichment transport does not match its mode.');
  }
  const clock = options.now === undefined ? {} : { now: options.now };
  const lifecycle = createLifecyclePersistenceService(database, clock);
  const checkpointer = createFirestoreCheckpointSaver(
    database,
    validatedBundleId,
  );
  const events = new AdminRunEventReader(database);
  const interpreter =
    options.interpreter ??
    (options.now === undefined
      ? new DeterministicQualificationInterpreter()
      : new DeterministicQualificationInterpreter(options.now));
  const workflow = compileQualificationWorkflow({
    interpreter,
    lifecycle,
    repositories,
    checkpointer,
    events,
    enrichment: {
      transport,
      ...(options.enrichmentSleep === undefined
        ? {}
        : { sleep: options.enrichmentSleep }),
    },
    ...(agents === undefined ? {} : { agents }),
    ...clock,
  });
  const drafts = new DraftService({
    repositories,
    reader: new AdminDraftReader(database),
    lifecycle,
    events,
    ...clock,
  });
  const details = createRunDetailService(database, drafts);
  const operationsService = new OperationsService({
    repositories,
    runs: new AdminRunReader(database),
    events,
    drafts,
    ...clock,
  });
  const resume = new QualificationResumeService({
    repositories,
    lifecycle,
    checkpoints: checkpointer,
    workflow,
    ...clock,
  });
  const executor = options.executor ?? new WorkflowExecutor();
  const deadlineMs =
    options.executionDeadlineMs ?? HOSTED_TARGET.executionDeadlineMs;
  const leaseDurationMs = hosted ? HOSTED_TARGET.executionLeaseMs : 300_000;

  const execute: ExecuteRouteDependencies = {
    execute: async ({ runId, expectedRevision, traceId, requestId }) => {
      const run = await repositories.runs.get(runId);
      if (run === null) throw new RunNotFoundError();
      const lead = await repositories.leads.get(run.leadId);
      if (lead === null) throw new Error('Persisted lead is unavailable.');
      const claimed = await lifecycle.claim({
        runId,
        expectedRevision,
        ownerId: `api:${requestId}`,
        leaseDurationMs,
        traceId,
        requestId,
        authorization: 'allowed',
      });
      const result = await withinDeadline(deadlineMs, (signal) =>
        workflow.invoke(
          initialQualificationGraphState({
            runId,
            leadId: run.leadId,
            traceId,
            requestId,
            systemBundleId: validatedBundleId,
            runRevision: claimed.run.revision,
            projection: qualificationProjectionFromLead(lead),
            emailContactConsent: lead.intake.emailContactConsent,
          }),
          {
            configurable: {
              thread_id: runId,
              system_bundle_id: validatedBundleId,
            },
            signal,
          },
        ),
      );
      const stored = await repositories.runs.get(runId);
      if (stored === null) throw new RunNotFoundError();
      const response: ExecuteResponse = {
        schemaVersion: 'execute-response-v1',
        runId,
        revision: stored.revision,
        status: stored.status,
        outcome: result === 'deadline' ? 'deadline' : 'finished',
      };
      return response;
    },
  };

  const localProcessPersisted: IntakeRouteDependencies['processPersisted'] =
    async ({ accepted, traceId, requestId }) => {
      const lead = await repositories.leads.get(accepted.leadId);
      if (lead === null) throw new Error('Persisted lead is unavailable.');
      const claimed = await lifecycle.claim({
        runId: accepted.runId,
        expectedRevision: accepted.runRevision,
        ownerId: `api:${requestId}`,
        leaseDurationMs,
        traceId,
        requestId,
        authorization: 'not_applicable',
      });
      executor.schedule(accepted.runId, () =>
        workflow.invoke(
          initialQualificationGraphState({
            runId: accepted.runId,
            leadId: accepted.leadId,
            traceId,
            requestId,
            systemBundleId: validatedBundleId,
            runRevision: claimed.run.revision,
            projection: qualificationProjectionFromLead(lead),
            emailContactConsent: lead.intake.emailContactConsent,
          }),
          {
            configurable: {
              thread_id: accepted.runId,
              system_bundle_id: validatedBundleId,
            },
          },
        ),
      );
    };

  return {
    intake: {
      persistence: createIntakePersistenceService(database),
      systemBundleId: validatedBundleId,
      // Hosted mode never continues after the 202: the browser holds the
      // separately authenticated execution request instead.
      ...(hosted ? {} : { processPersisted: localProcessPersisted }),
    },
    runs: { details },
    resume: {
      resume,
      details,
      leaseDurationMs,
      schedule: hosted
        ? // Hosted resume is request-bound too: the route answers after the
          // bounded continuation stops, and polling shows stored progress.
          async (_runId, continuation) => {
            await withinDeadline(deadlineMs, (signal) =>
              continuation({ signal }),
            );
          }
        : (runId, continuation) => {
            executor.schedule(runId, () => continuation());
          },
    },
    reset: {
      // A guarded reset erases every emulator document, including the bundle
      // this process validated at startup; restore it so later runs keep a
      // resolvable systemBundleId.
      reset: async (request) => {
        const result = await resetLocalEmulatorData(request);
        await repositories.systemBundles.create(systemBundle);
        return result;
      },
    },
    drafts,
    operations: {
      operations: operationsService,
      systemBundleId: validatedBundleId,
    },
    executor,
    ...(hosted ? { execute } : {}),
  };
}
