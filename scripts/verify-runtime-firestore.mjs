import { randomUUID } from 'node:crypto';
import {
  createEmulatorFirestoreBoundary,
  createFirestoreRepositories,
  createIntakePersistenceService,
} from '../packages/runtime/dist/index.js';

const timestamp = '2026-10-24T20:00:00.000Z';
const digest = 'a'.repeat(64);
const systemBundleId = randomUUID();
const boundary = createEmulatorFirestoreBoundary();

const bundle = {
  schemaVersion: 'system-bundle-v1',
  systemBundleId,
  createdAt: timestamp,
  code: {
    revision: 'emulator-contract-probe',
    dirty: true,
    sourceDigest: digest,
    patchDigest: digest,
  },
  lockfileDigest: digest,
  fixtures: { version: 'emulator-contract-probe-v1', digest },
  versions: {
    intake: 'intake-v1',
    lead: 'lead-v1',
    run: 'run-v1',
    event: 'event-v1',
    checkpoint: 'checkpoint-v1',
    rubric: 'rubric-v1',
    interpreter: 'deterministic-interpreter-v1',
    graph: 'qualification-graph-v1',
    checkpointer: 'firestore-checkpointer-v1',
    simulator: 'simulator-v1',
    evaluator: 'emulator-contract-probe-v1',
    configuration: 'phase-1-local-v1',
  },
  environment: {
    node: process.version.replace(/^v/u, ''),
    pnpm: '12.15.0',
    java: '21.0.12.1',
    firebaseCli: '15.34.1',
    firestoreEmulator: '1.22.0',
    structurizrCli: '2025.11.09',
    platform: process.platform,
    architecture: process.arch,
    projectId: 'demo-leadflow-ai-local',
  },
  provider: { value: null, reason: 'provider gate unresolved' },
  model: { value: null, reason: 'model gate unresolved' },
  prompt: { value: null, reason: 'no model prompt in Phase 1' },
  liveToolContracts: {
    value: null,
    reason: 'live enrichment and outbound tools are deferred',
  },
};

try {
  const repositories = createFirestoreRepositories(boundary.database);
  await repositories.systemBundles.create(bundle);
  const stored = await repositories.systemBundles.get(systemBundleId);
  if (JSON.stringify(stored) !== JSON.stringify(bundle)) {
    throw new Error('Emulator repository round-trip changed the document.');
  }

  let duplicateRejected = false;
  try {
    await repositories.systemBundles.create(bundle);
  } catch {
    duplicateRejected = true;
  }
  if (!duplicateRejected) {
    throw new Error('Emulator repository allowed a duplicate create.');
  }

  await boundary.database.doc(`systemBundles/${systemBundleId}`).set({
    ...bundle,
    unexpected: true,
  });
  let malformedReadRejected = false;
  try {
    await repositories.systemBundles.get(systemBundleId);
  } catch {
    malformedReadRejected = true;
  }
  if (!malformedReadRejected) {
    throw new Error('Emulator repository accepted malformed stored state.');
  }

  const intakeService = createIntakePersistenceService(boundary.database);
  const intake = {
    schemaVersion: 'intake-v1',
    identityClass: 'fictional',
    givenName: 'Avery',
    familyName: 'Example',
    email: 'avery@example.com',
    zipCode: '10001',
    vehicleYear: 2024,
    vehicleMake: 'Example Motors',
    vehicleModel: 'Demo One',
    coverageFocus: 'balanced',
    requestIntent: 'compare_options',
    needTimeline: 'within_30_days',
    requestDetails: 'Synthetic emulator transaction probe.',
    emailContactConsent: false,
  };
  const first = await intakeService.persist({
    idempotencyKey: 'emulator-intake-probe-v1',
    intake,
    systemBundleId,
  });
  const replay = await intakeService.persist({
    idempotencyKey: 'emulator-intake-probe-v1',
    intake,
    systemBundleId,
  });
  if (
    !replay.replayed ||
    replay.leadId !== first.leadId ||
    replay.runId !== first.runId
  ) {
    throw new Error('Emulator idempotency replay changed the original IDs.');
  }
  let conflictRejected = false;
  try {
    await intakeService.persist({
      idempotencyKey: 'emulator-intake-probe-v1',
      intake: { ...intake, zipCode: '90210' },
      systemBundleId,
    });
  } catch (error) {
    conflictRejected = error?.code === 'idempotency_conflict';
  }
  if (!conflictRejected) {
    throw new Error('Emulator idempotency conflict was not rejected.');
  }
  const storedLead = await repositories.leads.get(first.leadId);
  const storedRun = await repositories.runs.get(first.runId);
  if (storedLead === null || storedRun?.status !== 'persisted') {
    throw new Error('Emulator atomic intake records were not durable.');
  }

  console.log(
    'Runtime Firestore repository and atomic-intake probes passed against the isolated emulator.',
  );
} finally {
  await boundary.close();
}
