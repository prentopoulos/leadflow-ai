import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunDetailResponse } from '@leadflow-ai/domain';
import {
  RunDetailIntegrityError,
  RunDetailSnapshotUnavailableError,
  RunNotFoundError,
} from '@leadflow-ai/runtime';
import { createApp } from './app.js';
import type { PhaseOneStartup } from './startup.js';

const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  event: '33333333-3333-4333-8333-333333333333',
  trace: '44444444-4444-4444-8444-444444444444',
  request: '55555555-5555-4555-8555-555555555555',
  bundle: '66666666-6666-4666-8666-666666666666',
};
const timestamp = '2026-10-25T12:00:00.000Z';

const responseFixture: RunDetailResponse = {
  schemaVersion: 'run-detail-response-v2',
  lead: {
    schemaVersion: 'lead-v2',
    leadId: ids.lead,
    createdAt: timestamp,
    intake: {
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
      requestDetails: 'Synthetic route fixture.',
      emailContactConsent: false,
      consentRecord: null,
    },
    provenance: {
      sourceId: 'military-com-auto-landing',
      sourceUrl: 'https://auto.military.com/',
      retrievedAt: '2026-10-24',
      exactSourceFields: ['zipCode'],
      demoFields: [
        'givenName',
        'familyName',
        'email',
        'vehicleYear',
        'vehicleMake',
        'vehicleModel',
        'coverageFocus',
        'requestIntent',
        'needTimeline',
        'requestDetails',
        'emailContactConsent',
      ],
      parityVerified: false,
    },
    evidenceClass: 'synthetic',
  },
  run: {
    schemaVersion: 'run-v2',
    runId: ids.run,
    leadId: ids.lead,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'persisted',
    revision: 0,
    nextEventSequence: 2,
    attempt: 0,
    retryCount: 0,
    currentStep: null,
    completedSteps: [],
    lease: null,
    qualificationResultId: null,
    simulationRecordId: null,
    enrichmentMode: null,
    enrichmentEvidenceIds: [],
    emailCheckId: null,
    evidenceCompleteness: 'not_evaluated',
    draftId: null,
    draftSkipReason: null,
    verificationResultId: null,
    holds: [],
    safeError: null,
    systemBundleId: ids.bundle,
  },
  events: [
    {
      schemaVersion: 'event-v2',
      eventId: ids.event,
      runId: ids.run,
      traceId: ids.trace,
      requestId: ids.request,
      sequence: 1,
      runRevision: 0,
      name: 'lead.persisted',
      occurredAt: timestamp,
      step: null,
      status: 'persisted',
      durationMs: null,
      attempt: 0,
      retryCount: 0,
      authorization: 'not_applicable',
      safeError: null,
      systemBundleId: ids.bundle,
      evidenceClass: 'synthetic-local',
      externalCall: null,
      usage: null,
      usageUnavailableReason: 'no_model_or_paid_tool',
    },
  ],
  qualification: null,
  simulation: null,
  enrichment: [],
  emailCheck: null,
  draft: null,
  verification: null,
  retrievedAt: '2026-10-25T12:00:01.000Z',
  evidenceClass: 'synthetic-local',
};

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

function readyStartup(): PhaseOneStartup {
  return {
    status: 'ready',
    configuration: {
      configurationVersion: 'phase-2-local-v1',
      projectId: 'demo-leadflow-ai-local',
      firestoreHost: '127.0.0.1:8080',
      localResetEnabled: false,
      enrichmentMode: 'recorded',
      webOrigin: 'http://127.0.0.1:5173',
    },
    firestore: {
      app: {} as never,
      database: {} as never,
      configuration: {
        projectId: 'demo-leadflow-ai-local',
        host: '127.0.0.1:8080',
      },
      close: async () => undefined,
    },
  };
}

function buildApp(get: (runId: string) => Promise<RunDetailResponse>) {
  const app = createApp({
    phaseOne: readyStartup(),
    runs: { details: { get } },
    requestIdFactory: () => ids.request,
  });
  apps.add(app);
  return app;
}

describe('GET /v1/runs/:runId', () => {
  it('returns the stored snapshot without synthesizing progress', async () => {
    const get = vi.fn(async () => responseFixture);
    const app = buildApp(get);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/runs/${ids.run}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(responseFixture);
    expect(get).toHaveBeenCalledWith(ids.run);
  });

  it('rejects an invalid run identifier before reading storage', async () => {
    const get = vi.fn(async () => responseFixture);
    const app = buildApp(get);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/runs/not-a-uuid',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'validation_failed', retryable: false },
    });
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    [new RunNotFoundError(), 404, 'run_not_found', false],
    [new RunDetailSnapshotUnavailableError(), 503, 'storage_unavailable', true],
    [new RunDetailIntegrityError(), 503, 'invariant_failed', false],
    [new Error('raw storage detail'), 503, 'storage_unavailable', true],
  ] as const)(
    'maps stored read failure %# to a safe response',
    async (failure, status, code, retryable) => {
      const app = buildApp(async () => {
        throw failure;
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/runs/${ids.run}`,
      });

      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({
        error: { code, retryable },
        requestId: ids.request,
      });
      expect(response.body).not.toContain('raw storage detail');
    },
  );

  it('fails closed when the stateful runtime is unavailable', async () => {
    const app = createApp({ requestIdFactory: () => ids.request });
    apps.add(app);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/runs/${ids.run}`,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: { code: 'storage_unavailable', retryable: true },
    });
  });
});
