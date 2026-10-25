import {
  DeterministicQualificationInterpreter,
  QualificationResumeService,
  compileQualificationWorkflow,
  createFirestoreCheckpointSaver,
  createFirestoreRepositories,
  createIntakePersistenceService,
  createLifecyclePersistenceService,
  createRunDetailService,
  initialQualificationGraphState,
  qualificationProjectionFromLead,
  type QualificationInterpreter,
} from '@leadflow-ai/runtime';
import { z } from 'zod';
import type { IntakeRouteDependencies } from './intake-route.js';
import type { ResumeRouteDependencies } from './resume-route.js';
import type { RunRouteDependencies } from './run-route.js';
import type { PhaseOneStartup } from './startup.js';

const SystemBundleIdSchema = z.string().uuid();

export interface PhaseOneApiDependencies {
  intake: IntakeRouteDependencies;
  runs: RunRouteDependencies;
  resume: ResumeRouteDependencies;
}

export interface PhaseOneApiRuntimeOptions {
  interpreter?: QualificationInterpreter;
  now?: () => string;
}

export async function createPhaseOneApiDependencies(
  startup: Extract<PhaseOneStartup, { status: 'ready' }>,
  systemBundleId: string,
  options: PhaseOneApiRuntimeOptions = {},
): Promise<PhaseOneApiDependencies> {
  const validatedBundleId = SystemBundleIdSchema.parse(systemBundleId);
  const repositories = createFirestoreRepositories(startup.firestore.database);
  const systemBundle = await repositories.systemBundles.get(validatedBundleId);
  if (
    systemBundle === null ||
    systemBundle.environment.projectId !== startup.configuration.projectId
  ) {
    throw new Error('Compatible persisted system bundle is unavailable.');
  }
  const lifecycle = createLifecyclePersistenceService(
    startup.firestore.database,
    options.now === undefined ? {} : { now: options.now },
  );
  const checkpointer = createFirestoreCheckpointSaver(
    startup.firestore.database,
    validatedBundleId,
  );
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
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const details = createRunDetailService(startup.firestore.database);
  const resume = new QualificationResumeService({
    repositories,
    lifecycle,
    checkpoints: checkpointer,
    workflow,
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  return {
    intake: {
      persistence: createIntakePersistenceService(startup.firestore.database),
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
        await workflow.invoke(
          initialQualificationGraphState({
            runId: accepted.runId,
            leadId: accepted.leadId,
            traceId,
            requestId,
            systemBundleId: validatedBundleId,
            runRevision: claimed.run.revision,
            projection: qualificationProjectionFromLead(lead),
          }),
          {
            configurable: {
              thread_id: accepted.runId,
              system_bundle_id: validatedBundleId,
            },
          },
        );
      },
    },
    runs: { details },
    resume: { resume, details },
  };
}
