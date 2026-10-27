// Hosted request-bound execution against the isolated emulator (synthetic,
// recorded enrichment): intake commits without post-response work, one held
// execution request completes the run, a duplicate is rejected, and a run
// stopped at its deadline stays stored and becomes resumable once its lease
// expires. Called by verify-runtime-firestore.mjs before its final flush.
import { randomUUID } from 'node:crypto';
import {
  RunRevisionConflictError,
  bindHostedSystemBundle,
  createEmulatorFirestoreBoundary,
  createFirestoreRepositories,
} from '../packages/runtime/dist/index.js';
import { createPhaseOneApiDependencies } from '../apps/api/dist/phase-one-runtime.js';

const hostedInput = {
  projectId: 'synthetic-hosted-project',
  revision: 'leadflow-ai-demo-00001-probe',
  imageDigest: `sha256:${'c'.repeat(64)}`,
};

function intake(givenName) {
  return {
    schemaVersion: 'intake-v3',
    identityClass: 'fictional',
    givenName,
    familyName: 'Example',
    email: `${givenName.toLowerCase()}@example.com`,
    zipCode: '22150',
    vehicleYear: 2020,
    vehicleMake: 'Subaru',
    vehicleModel: 'Outback',
    coverageFocus: 'balanced',
    requestIntent: 'compare_options',
    needTimeline: 'within_30_days',
    requestDetails: 'Synthetic hosted execution probe.',
    emailContactConsent: false,
    consentRecord: null,
  };
}

export async function verifyHostedExecution({ localBundle }) {
  const boundary = createEmulatorFirestoreBoundary();
  try {
    const repositories = createFirestoreRepositories(boundary.database);
    const base = { ...localBundle };
    delete base.systemBundleId;
    delete base.createdAt;
    delete base.deployment;
    const bundle = bindHostedSystemBundle(
      {
        schemaVersion: 'release-manifest-v1',
        base: {
          ...base,
          // A hosted build is always a clean commit.
          code: { ...base.code, dirty: false, patchDigest: null },
          versions: { ...base.versions, configuration: 'phase-3-cloud-v1' },
        },
      },
      hostedInput,
    );
    await repositories.systemBundles.create(bundle);
    // A hosted startup shape over the emulator database: only the boundary
    // differs from Cloud Run, so the execution contract is exercised as is.
    const startup = () => ({
      status: 'ready',
      configuration: {
        mode: 'cloud',
        configurationVersion: 'phase-3-cloud-v1',
        enrichmentMode: 'recorded',
        localResetEnabled: false,
        ...hostedInput,
      },
      firestore: boundary,
    });
    const dependencies = await createPhaseOneApiDependencies(
      startup(),
      bundle.systemBundleId,
    );
    if (
      dependencies.intake.processPersisted !== undefined ||
      dependencies.execute === undefined
    ) {
      throw new Error('Hosted intake would start post-response work.');
    }

    const persist = (name) =>
      dependencies.intake.persistence.persist({
        idempotencyKey: `hosted-execution-${randomUUID()}`,
        intake: intake(name),
        systemBundleId: bundle.systemBundleId,
        traceId: randomUUID(),
        requestId: randomUUID(),
      });

    const first = await persist('Morgan');
    await new Promise((resolve) => setTimeout(resolve, 250));
    if ((await repositories.runs.get(first.runId))?.status !== 'persisted') {
      throw new Error('A hosted run advanced without an execution request.');
    }
    const finished = await dependencies.execute.execute({
      runId: first.runId,
      expectedRevision: first.runRevision,
      traceId: randomUUID(),
      requestId: randomUUID(),
    });
    if (finished.outcome !== 'finished' || finished.status !== 'complete') {
      throw new Error(
        `Held execution did not complete (${finished.outcome}/${finished.status}).`,
      );
    }
    let duplicateRejected = false;
    try {
      await dependencies.execute.execute({
        runId: first.runId,
        expectedRevision: first.runRevision,
        traceId: randomUUID(),
        requestId: randomUUID(),
      });
    } catch (error) {
      duplicateRejected = error instanceof RunRevisionConflictError;
    }
    if (!duplicateRejected) {
      throw new Error('A duplicate execution request was not rejected.');
    }

    // A deadline shorter than any step: work stops, the claim stays stored
    // with its bounded lease, and nothing is reported as success.
    const stopped = await persist('Quinn');
    const bounded = await createPhaseOneApiDependencies(
      startup(),
      bundle.systemBundleId,
      { executionDeadlineMs: 1 },
    );
    const outcome = await bounded.execute.execute({
      runId: stopped.runId,
      expectedRevision: stopped.runRevision,
      traceId: randomUUID(),
      requestId: randomUUID(),
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const interrupted = await repositories.runs.get(stopped.runId);
    if (outcome.outcome !== 'deadline' || interrupted?.lease === null) {
      throw new Error(
        `The deadline did not leave a leased recoverable run (${outcome.outcome}/${interrupted?.status}).`,
      );
    }
    const leaseMs =
      Date.parse(interrupted.lease.expiresAt) -
      Date.parse(interrupted.lease.claimedAt);
    if (leaseMs !== 75_000) {
      throw new Error(`Hosted lease was ${leaseMs} ms, not 75000 ms.`);
    }
    if (interrupted.status === 'complete') {
      throw new Error('An interrupted run was reported complete.');
    }

    // After the lease expires the stored run is reclaimed through the same
    // revision-checked resume path, inside its own held request.
    const later = () =>
      new Date(Date.parse(interrupted.lease.expiresAt) + 1_000).toISOString();
    const resumed = await createPhaseOneApiDependencies(
      startup(),
      bundle.systemBundleId,
      { now: later },
    );
    const started = await resumed.resume.resume.begin({
      runId: stopped.runId,
      expectedRevision: interrupted.revision,
      ownerId: `api:${randomUUID()}`,
      leaseDurationMs: 75_000,
      traceId: randomUUID(),
      requestId: randomUUID(),
      authorization: 'allowed',
    });
    await resumed.resume.schedule(stopped.runId, started.continuation);
    const recovered = await repositories.runs.get(stopped.runId);
    if (
      started.resumedFrom !== 'lease_reclaim' ||
      recovered?.status !== 'complete'
    ) {
      throw new Error(
        `Lease reclaim did not recover the run (${started.resumedFrom}/${recovered?.status}).`,
      );
    }
  } finally {
    await boundary.close();
  }
}
