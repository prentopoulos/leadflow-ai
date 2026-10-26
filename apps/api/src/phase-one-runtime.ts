import {
  AdminDraftReader,
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
  type EnrichmentTransport,
  type QualificationInterpreter,
} from '@leadflow-ai/runtime';
import { z } from 'zod';
import type { IntakeRouteDependencies } from './intake-route.js';
import type { ResetRouteDependencies } from './reset-route.js';
import type { ResumeRouteDependencies } from './resume-route.js';
import type { RunRouteDependencies } from './run-route.js';
import type { OperationsRouteDependencies } from './operations-route.js';
import type { PhaseOneStartup } from './startup.js';

const SystemBundleIdSchema = z.string().uuid();

export interface PhaseOneApiDependencies {
  intake: IntakeRouteDependencies;
  runs: RunRouteDependencies;
  resume: ResumeRouteDependencies;
  reset: ResetRouteDependencies;
  drafts: DraftService;
  operations: OperationsRouteDependencies;
  executor: WorkflowExecutor;
}

export interface PhaseOneApiRuntimeOptions {
  interpreter?: QualificationInterpreter;
  now?: () => string;
  // Tests inject a fixture transport; otherwise the configured mode decides.
  enrichmentTransport?: EnrichmentTransport;
  enrichmentSleep?: (milliseconds: number) => Promise<void>;
  executor?: WorkflowExecutor;
}

export async function createPhaseOneApiDependencies(
  startup: Extract<PhaseOneStartup, { status: 'ready' }>,
  systemBundleId: string,
  options: PhaseOneApiRuntimeOptions = {},
): Promise<PhaseOneApiDependencies> {
  const validatedBundleId = SystemBundleIdSchema.parse(systemBundleId);
  const { database } = startup.firestore;
  const enrichmentMode = startup.configuration.enrichmentMode;
  const repositories = createFirestoreRepositories(database);
  const systemBundle = await repositories.systemBundles.get(validatedBundleId);
  if (
    systemBundle === null ||
    systemBundle.environment.projectId !== startup.configuration.projectId ||
    systemBundle.enrichmentMode !== enrichmentMode
  ) {
    throw new Error('Compatible persisted system bundle is unavailable.');
  }
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

  return {
    intake: {
      persistence: createIntakePersistenceService(database),
      systemBundleId: validatedBundleId,
      processPersisted: async ({ accepted, traceId, requestId }) => {
        const lead = await repositories.leads.get(accepted.leadId);
        if (lead === null) throw new Error('Persisted lead is unavailable.');
        const claimed = await lifecycle.claim({
          runId: accepted.runId,
          expectedRevision: accepted.runRevision,
          ownerId: `api:${requestId}`,
          leaseDurationMs: 300_000,
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
      },
    },
    runs: { details },
    resume: {
      resume,
      details,
      schedule: (runId, continuation) => {
        executor.schedule(runId, continuation);
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
  };
}
