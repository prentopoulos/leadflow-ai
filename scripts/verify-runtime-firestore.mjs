import { randomUUID } from 'node:crypto';
import {
  createEmulatorFirestoreBoundary,
  createFirestoreRepositories,
  createFirestoreCheckpointSaver,
  createIntakePersistenceService,
  createLifecyclePersistenceService,
  createRunDetailService,
  createEnrichmentTransport,
  compileQualificationWorkflow,
  AdminRunEventReader,
  DeterministicQualificationInterpreter,
  initialQualificationGraphState,
  LOCAL_RESET_CONFIRMATION,
  qualificationProjectionFromLead,
  resetLocalEmulatorData,
  SyntheticTransientFault,
} from '../packages/runtime/dist/index.js';
import { createApp } from '../apps/api/dist/app.js';
import { createPhaseOneApiDependencies } from '../apps/api/dist/phase-one-runtime.js';

const timestamp = '2026-10-24T20:00:00.000Z';
const digest = 'a'.repeat(64);
const systemBundleId = randomUUID();
const boundary = createEmulatorFirestoreBoundary();

const bundle = {
  schemaVersion: 'system-bundle-v2',
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
    intake: 'intake-v2',
    lead: 'lead-v2',
    run: 'run-v2',
    event: 'event-v2',
    checkpoint: 'checkpoint-v1',
    rubric: 'rubric-v1',
    interpreter: 'deterministic-interpreter-v1',
    graph: 'phase-2-graph-v1',
    checkpointer: 'firestore-checkpointer-v1',
    simulator: 'simulator-v1',
    enrichmentAdapters: 'enrichment-adapters-v1',
    composer: 'deterministic-template-v1',
    verificationRules: 'verification-rules-v1',
    decisionLanguage: 'decision-language-v1',
    metricsDefinitions: 'metrics-definitions-v1',
    evaluator: 'emulator-contract-probe-v1',
    configuration: 'phase-2-local-v1',
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
  enrichmentMode: 'recorded',
  liveToolContracts: {
    hosts: ['vpic.nhtsa.dot.gov', 'api.zippopotam.us'],
    authorization:
      'owner-authorized read-only GET, 2026-10-25 (PROJECT.md Phase 2 decisions)',
  },
};

try {
  await resetLocalEmulatorData({
    enabled: true,
    remoteAddress: '127.0.0.1',
    projectId: 'demo-leadflow-ai-local',
    firestoreHost: '127.0.0.1:8080',
    confirmation: LOCAL_RESET_CONFIRMATION,
  });
  const repositories = createFirestoreRepositories(boundary.database);
  const phaseTwoWorkflowDependencies = {
    enrichment: {
      transport: await createEnrichmentTransport('recorded'),
      sleep: async () => undefined,
      random: () => 0,
    },
    events: new AdminRunEventReader(boundary.database),
  };
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
  await boundary.database.doc(`systemBundles/${systemBundleId}`).set(bundle);

  const intakeService = createIntakePersistenceService(boundary.database);
  const intake = {
    schemaVersion: 'intake-v2',
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
    consentRecord: null,
  };
  const first = await intakeService.persist({
    idempotencyKey: 'emulator-intake-probe-v1',
    intake,
    systemBundleId,
    traceId: randomUUID(),
    requestId: randomUUID(),
  });
  const replay = await intakeService.persist({
    idempotencyKey: 'emulator-intake-probe-v1',
    intake,
    systemBundleId,
    traceId: randomUUID(),
    requestId: randomUUID(),
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
      traceId: randomUUID(),
      requestId: randomUUID(),
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

  const context = {
    traceId: randomUUID(),
    requestId: randomUUID(),
    authorization: 'not_applicable',
  };
  const claimService = createLifecyclePersistenceService(boundary.database, {
    now: () => '2026-10-24T20:01:00.000Z',
  });
  const claimResults = await Promise.allSettled([
    claimService.claim({
      runId: first.runId,
      expectedRevision: 0,
      ownerId: 'emulator-worker-a',
      leaseDurationMs: 1_000,
      ...context,
    }),
    claimService.claim({
      runId: first.runId,
      expectedRevision: 0,
      ownerId: 'emulator-worker-b',
      leaseDurationMs: 1_000,
      ...context,
    }),
  ]);
  const successfulClaims = claimResults.filter(
    ({ status }) => status === 'fulfilled',
  );
  if (successfulClaims.length !== 1) {
    throw new Error('Emulator concurrent claim did not select one owner.');
  }
  const claimedRun = await repositories.runs.get(first.runId);
  if (claimedRun?.revision !== 1 || claimedRun.nextEventSequence !== 3) {
    throw new Error(
      'Emulator claim revision or event sequence was not atomic.',
    );
  }

  const reclaim = await createLifecyclePersistenceService(boundary.database, {
    now: () => '2026-10-24T20:01:02.000Z',
  }).reclaimExpiredLease({
    runId: first.runId,
    expectedRevision: 1,
    ownerId: 'emulator-worker-recovery',
    leaseDurationMs: 30_000,
    ...context,
  });
  if (
    reclaim.run.revision !== 2 ||
    reclaim.event.sequence !== 3 ||
    reclaim.event.name !== 'run.lease_reclaimed'
  ) {
    throw new Error('Emulator expired-lease reclaim broke lifecycle ordering.');
  }

  const saver = createFirestoreCheckpointSaver(
    boundary.database,
    systemBundleId,
  );
  let graphMilliseconds = 0;
  const graphClock = () => {
    graphMilliseconds += 1;
    return new Date(
      Date.UTC(2026, 9, 24, 20, 1, 3, graphMilliseconds),
    ).toISOString();
  };
  const graphLifecycle = createLifecyclePersistenceService(boundary.database, {
    now: graphClock,
  });
  const graph = compileQualificationWorkflow({
    interpreter: new DeterministicQualificationInterpreter(graphClock),
    lifecycle: graphLifecycle,
    repositories,
    checkpointer: saver,
    now: graphClock,
    ...phaseTwoWorkflowDependencies,
  });
  const graphConfig = {
    configurable: {
      thread_id: first.runId,
      system_bundle_id: systemBundleId,
    },
  };
  const graphOutput = await graph.invoke(
    initialQualificationGraphState({
      runId: first.runId,
      leadId: first.leadId,
      traceId: context.traceId,
      requestId: context.requestId,
      systemBundleId,
      runRevision: reclaim.run.revision,
      projection: qualificationProjectionFromLead(storedLead),
      emailContactConsent: storedLead.intake.emailContactConsent,
    }),
    graphConfig,
  );
  const completedRun = await repositories.runs.get(first.runId);
  if (
    !graphOutput.finalized ||
    graphOutput.runRevision !== 21 ||
    completedRun?.status !== 'complete' ||
    completedRun.revision !== 21 ||
    completedRun.nextEventSequence !== 23 ||
    (await repositories.qualificationResults.get(
      graphOutput.qualification?.resultId ?? '',
    )) === null ||
    (await repositories.simulationRecords.get(
      graphOutput.simulation?.simulationRecordId ?? '',
    )) === null
  ) {
    throw new Error(
      'Emulator qualification graph did not durably finalize its run and results.',
    );
  }
  const storedDetail = await createRunDetailService(boundary.database).get(
    first.runId,
  );
  if (
    storedDetail.run.revision !== 21 ||
    storedDetail.events.length !== 22 ||
    storedDetail.events.at(-1)?.name !== 'run.completed' ||
    storedDetail.qualification?.runId !== first.runId ||
    storedDetail.simulation?.runId !== first.runId ||
    JSON.stringify(storedDetail.events).includes(intake.email) ||
    JSON.stringify(storedDetail.events).includes(intake.requestDetails)
  ) {
    throw new Error(
      'Emulator run-detail snapshot was incomplete or crossed its privacy boundary.',
    );
  }
  const graphCheckpoints = [];
  for await (const tuple of saver.list(graphConfig)) {
    graphCheckpoints.push(tuple);
  }
  if (
    graphCheckpoints.length < 5 ||
    graphCheckpoints[0]?.checkpoint.channel_values.finalized !== true
  ) {
    throw new Error(
      'Emulator qualification graph did not persist its durable checkpoints.',
    );
  }

  const retryIntake = await intakeService.persist({
    idempotencyKey: 'emulator-retry-probe-v1',
    intake,
    systemBundleId,
    traceId: randomUUID(),
    requestId: randomUUID(),
  });
  const retryClaim = await graphLifecycle.claim({
    runId: retryIntake.runId,
    expectedRevision: 0,
    ownerId: 'emulator-worker-retry',
    leaseDurationMs: 30_000,
    ...context,
  });
  const retryLead = await repositories.leads.get(retryIntake.leadId);
  if (retryLead === null) throw new Error('Emulator retry lead is missing.');
  let interpreterCalls = 0;
  const retryDelegate = new DeterministicQualificationInterpreter(graphClock);
  const retryGraph = compileQualificationWorkflow({
    interpreter: {
      version: 'deterministic-interpreter-v1',
      async interpret(projection) {
        interpreterCalls += 1;
        if (interpreterCalls === 1) throw new SyntheticTransientFault();
        return retryDelegate.interpret(projection);
      },
    },
    lifecycle: graphLifecycle,
    repositories,
    checkpointer: saver,
    now: graphClock,
    ...phaseTwoWorkflowDependencies,
  });
  const retryOutput = await retryGraph.invoke(
    initialQualificationGraphState({
      runId: retryIntake.runId,
      leadId: retryIntake.leadId,
      traceId: context.traceId,
      requestId: context.requestId,
      systemBundleId,
      runRevision: retryClaim.run.revision,
      projection: qualificationProjectionFromLead(retryLead),
      emailContactConsent: retryLead.intake.emailContactConsent,
    }),
    {
      configurable: {
        thread_id: retryIntake.runId,
        system_bundle_id: systemBundleId,
      },
    },
  );
  const retryRun = await repositories.runs.get(retryIntake.runId);
  const retryEventsSnapshot = await boundary.database
    .collection(`runs/${retryIntake.runId}/events`)
    .get();
  const retryEvents = retryEventsSnapshot.docs
    .map((document) => repositories.events.parseStored(document.data()))
    .sort((left, right) => left.sequence - right.sequence);
  if (
    interpreterCalls !== 2 ||
    !retryOutput.finalized ||
    retryOutput.runRevision !== 23 ||
    retryRun?.status !== 'complete' ||
    retryRun.attempt !== 2 ||
    retryRun.retryCount !== 1 ||
    retryEvents.filter(({ name }) => name === 'step.started').length !== 8 ||
    retryEvents.filter(({ name }) => name === 'step.retry_scheduled').length !==
      1
  ) {
    throw new Error(
      'Emulator transient retry did not preserve its bounded attempt history.',
    );
  }

  const resumeIntake = await intakeService.persist({
    idempotencyKey: 'emulator-resume-probe-v1',
    intake,
    systemBundleId,
    traceId: randomUUID(),
    requestId: randomUUID(),
  });
  const resumeClaim = await graphLifecycle.claim({
    runId: resumeIntake.runId,
    expectedRevision: 0,
    ownerId: 'emulator-worker-failure',
    leaseDurationMs: 30_000,
    ...context,
  });
  const resumeLead = await repositories.leads.get(resumeIntake.leadId);
  if (resumeLead === null) throw new Error('Emulator resume lead is missing.');
  let exhaustionCalls = 0;
  const exhaustionGraph = compileQualificationWorkflow({
    interpreter: {
      version: 'deterministic-interpreter-v1',
      async interpret() {
        exhaustionCalls += 1;
        throw new SyntheticTransientFault();
      },
    },
    lifecycle: graphLifecycle,
    repositories,
    checkpointer: saver,
    now: graphClock,
    ...phaseTwoWorkflowDependencies,
  });
  await exhaustionGraph.invoke(
    initialQualificationGraphState({
      runId: resumeIntake.runId,
      leadId: resumeIntake.leadId,
      traceId: context.traceId,
      requestId: context.requestId,
      systemBundleId,
      runRevision: resumeClaim.run.revision,
      projection: qualificationProjectionFromLead(resumeLead),
      emailContactConsent: resumeLead.intake.emailContactConsent,
    }),
    {
      configurable: {
        thread_id: resumeIntake.runId,
        system_bundle_id: systemBundleId,
      },
    },
  );
  const exhaustedRun = await repositories.runs.get(resumeIntake.runId);
  if (exhaustionCalls !== 2 || exhaustedRun?.status !== 'failed_retryable') {
    throw new Error('Emulator resume fixture did not exhaust exactly once.');
  }
  const apiBoundary = createEmulatorFirestoreBoundary();
  const apiStartup = {
    status: 'ready',
    configuration: {
      configurationVersion: 'phase-2-local-v1',
      projectId: 'demo-leadflow-ai-local',
      firestoreHost: '127.0.0.1:8080',
      localResetEnabled: false,
      enrichmentMode: 'recorded',
      webOrigin: 'http://127.0.0.1:5173',
    },
    firestore: apiBoundary,
  };
  const apiDependencies = await createPhaseOneApiDependencies(
    apiStartup,
    systemBundleId,
    { now: graphClock },
  );
  const api = createApp({ phaseOne: apiStartup, ...apiDependencies });
  await api.listen({ host: '127.0.0.1', port: 0 });
  const apiAddress = api.server.address();
  if (
    apiAddress === null ||
    typeof apiAddress === 'string' ||
    apiAddress.address !== '127.0.0.1'
  ) {
    throw new Error('Built API did not bind to the exact loopback address.');
  }
  const apiUrl = `http://127.0.0.1:${apiAddress.port}`;
  let builtApiRunId;
  const apiFetch = (path, init = {}) =>
    fetch(`${apiUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(5_000),
    });
  try {
    const healthResponse = await apiFetch('/health');
    const health = await healthResponse.json();
    if (
      !healthResponse.ok ||
      health.scope !== 'process' ||
      'readiness' in health
    ) {
      throw new Error('Built API health exceeded its process-only contract.');
    }

    const failedDetailResponse = await apiFetch(
      `/v1/runs/${resumeIntake.runId}`,
    );
    const failedDetail = await failedDetailResponse.json();
    if (
      !failedDetailResponse.ok ||
      failedDetail.run?.status !== 'failed_retryable' ||
      failedDetail.run?.revision !== exhaustedRun.revision
    ) {
      throw new Error('Built API did not expose the stored retryable failure.');
    }

    const resumeResponse = await apiFetch(
      `/v1/runs/${resumeIntake.runId}/resume`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: exhaustedRun.revision }),
      },
    );
    const resumeBody = await resumeResponse.json();
    if (
      resumeResponse.status !== 202 ||
      resumeBody.status !== 'running' ||
      resumeBody.revision !== exhaustedRun.revision + 1 ||
      resumeBody.replayed
    ) {
      throw new Error('Built API explicit resume was not durably accepted.');
    }
    let resumedDetail;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const response = await apiFetch(`/v1/runs/${resumeIntake.runId}`);
      if (response.ok) {
        resumedDetail = await response.json();
        if (resumedDetail.run?.status === 'complete') break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (resumedDetail?.run?.status !== 'complete') {
      throw new Error('Built API resumed workflow did not complete in time.');
    }
    const resumeReplayResponse = await apiFetch(
      `/v1/runs/${resumeIntake.runId}/resume`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: exhaustedRun.revision }),
      },
    );
    const resumeReplay = await resumeReplayResponse.json();
    if (!resumeReplayResponse.ok || !resumeReplay.replayed) {
      throw new Error('Built API did not identify the durable resume replay.');
    }

    const apiIntake = {
      ...intake,
      requestDetails: 'Synthetic built API workflow probe.',
    };
    const intakeResponse = await apiFetch('/v1/intake', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'built-api-intake-probe-v1',
      },
      body: JSON.stringify(apiIntake),
    });
    const accepted = await intakeResponse.json();
    builtApiRunId = accepted.runId;
    if (intakeResponse.status !== 202 || accepted.replayed) {
      throw new Error('Built API did not accept committed synthetic intake.');
    }

    let completedDetail;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const response = await apiFetch(`/v1/runs/${accepted.runId}`);
      if (response.ok) {
        completedDetail = await response.json();
        if (completedDetail.run?.status === 'complete') break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (
      completedDetail?.run?.status !== 'complete' ||
      completedDetail.qualification?.classification !== 'marketing_readiness' ||
      completedDetail.simulation?.notices?.[1] !== 'not_predictive'
    ) {
      throw new Error('Built API intake did not reach stored completion.');
    }

    const replayResponse = await apiFetch('/v1/intake', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'built-api-intake-probe-v1',
      },
      body: JSON.stringify(apiIntake),
    });
    const replayBody = await replayResponse.json();
    if (
      replayResponse.status !== 200 ||
      !replayBody.replayed ||
      replayBody.runId !== accepted.runId
    ) {
      throw new Error(
        'Built API intake replay changed the committed identity.',
      );
    }
    const conflictResponse = await apiFetch('/v1/intake', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'built-api-intake-probe-v1',
      },
      body: JSON.stringify({ ...apiIntake, zipCode: '90210' }),
    });
    const invalidResponse = await apiFetch('/v1/intake', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'built-api-invalid-probe-v1',
      },
      body: JSON.stringify({ ...apiIntake, email: 'person@invalid.test' }),
    });
    const resetDenied = await apiFetch('/v1/local-data', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'demo-leadflow-ai-local',
        confirmation: 'DELETE SYNTHETIC LEADFLOW LOCAL DATA',
      }),
    });
    if (
      conflictResponse.status !== 409 ||
      invalidResponse.status !== 400 ||
      resetDenied.status !== 404
    ) {
      throw new Error('Built API safe denial contracts did not hold.');
    }
  } finally {
    await api.close();
  }
  if (api.server.listening) {
    throw new Error('Built API listener remained open after cleanup.');
  }
  const resumedRun = await repositories.runs.get(resumeIntake.runId);
  const resumedEvents = await boundary.database
    .collection(`runs/${resumeIntake.runId}/events`)
    .get();
  if (
    resumedRun?.status !== 'complete' ||
    resumedRun.revision !== 27 ||
    resumedEvents.docs.filter(
      (document) => document.data().name === 'run.resume_requested',
    ).length !== 1
  ) {
    throw new Error(
      'Emulator explicit resume did not continue from compatible durable state.',
    );
  }

  const rootCheckpointId = '00000000-0000-6000-8000-000000000001';
  const childCheckpointId = '00000000-0000-6000-8000-000000000002';
  const checkpointConfig = {
    configurable: {
      thread_id: first.runId,
      checkpoint_ns: 'qualification',
      system_bundle_id: systemBundleId,
    },
  };
  const rootConfig = await saver.put(
    checkpointConfig,
    {
      v: 4,
      id: rootCheckpointId,
      ts: '2026-10-24T20:02:00.000Z',
      channel_values: { state: 'root' },
      channel_versions: { state: 1 },
      versions_seen: {},
    },
    { source: 'input', step: -1, parents: {} },
    { state: 1 },
  );
  const childConfig = await saver.put(
    rootConfig,
    {
      v: 4,
      id: childCheckpointId,
      ts: '2026-10-24T20:02:01.000Z',
      channel_values: { state: 'child' },
      channel_versions: { state: 2 },
      versions_seen: {},
    },
    { source: 'loop', step: 0, parents: {} },
    { state: 2 },
  );
  await saver.putWrites(
    childConfig,
    [
      ['second', 2],
      ['third', 3],
    ],
    'task-z',
    'z-path',
  );
  await saver.putWrites(childConfig, [['first', 1]], 'task-a', 'a-path');
  await saver.putWrites(
    childConfig,
    [['second', 'ignored duplicate']],
    'task-z',
    'z-path',
  );
  const checkpointTuple = await saver.getTuple(childConfig);
  if (
    checkpointTuple?.checkpoint.id !== childCheckpointId ||
    checkpointTuple.parentConfig?.configurable?.checkpoint_id !==
      rootCheckpointId ||
    JSON.stringify(checkpointTuple.pendingWrites) !==
      JSON.stringify([
        ['task-a', 'first', 1],
        ['task-z', 'second', 2],
        ['task-z', 'third', 3],
      ])
  ) {
    throw new Error(
      'Emulator checkpoint tuple did not preserve identity or ordering.',
    );
  }
  const checkpointIds = [];
  for await (const tuple of saver.list(checkpointConfig)) {
    checkpointIds.push(tuple.checkpoint.id);
  }
  if (
    JSON.stringify(checkpointIds) !==
    JSON.stringify([childCheckpointId, rootCheckpointId])
  ) {
    throw new Error('Emulator checkpoint listing order was incorrect.');
  }
  await saver.deleteThread(first.runId);
  if (
    (await saver.getTuple(childConfig)) !== undefined ||
    (await repositories.runs.get(first.runId)) === null
  ) {
    throw new Error('Checkpoint deletion crossed the thread-state boundary.');
  }
  await resetLocalEmulatorData({
    enabled: true,
    remoteAddress: '127.0.0.1',
    projectId: 'demo-leadflow-ai-local',
    firestoreHost: '127.0.0.1:8080',
    confirmation: LOCAL_RESET_CONFIRMATION,
  });
  if (
    (await repositories.runs.get(first.runId)) !== null ||
    (await repositories.runs.get(retryIntake.runId)) !== null ||
    (await repositories.runs.get(resumeIntake.runId)) !== null ||
    (builtApiRunId !== undefined &&
      (await repositories.runs.get(builtApiRunId)) !== null) ||
    (await repositories.systemBundles.get(systemBundleId)) !== null
  ) {
    throw new Error('Verified emulator flush left fixture records behind.');
  }

  console.log(
    'Runtime Firestore, built loopback API, workflow recovery, and verified-flush probes passed against the isolated emulator.',
  );
} finally {
  await boundary.close();
}
