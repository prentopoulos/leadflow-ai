import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IntakeAcceptedResponse } from '@leadflow-ai/domain';
import { IdempotencyConflictError } from '@leadflow-ai/runtime';
import { createApp } from './app.js';
import type { IntakeRouteDependencies } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

const bundleId = '66666666-6666-4666-8666-666666666666';
const requestId = '55555555-5555-4555-8555-555555555555';
const traceId = '44444444-4444-4444-8444-444444444444';
const accepted: IntakeAcceptedResponse = {
  schemaVersion: 'intake-response-v1',
  leadId: '11111111-1111-4111-8111-111111111111',
  runId: '22222222-2222-4222-8222-222222222222',
  runRevision: 0,
  replayed: false,
  committedAt: '2026-10-25T12:00:00.000Z',
  evidenceClass: 'synthetic-local',
};
const intake = {
  schemaVersion: 'intake-v1',
  identityClass: 'fictional',
  givenName: ' Avery ',
  familyName: 'Example',
  email: 'AVERY@EXAMPLE.COM',
  zipCode: '10001',
  vehicleYear: 2024,
  vehicleMake: 'Example Motors',
  vehicleModel: 'Demo One',
  coverageFocus: 'balanced',
  requestIntent: 'compare_options',
  needTimeline: 'within_30_days',
  requestDetails: 'Synthetic API fixture.',
  emailContactConsent: false,
} as const;

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

function readyStartup(): PhaseOneStartup {
  return {
    status: 'ready',
    configuration: {
      configurationVersion: 'phase-1-local-v1',
      projectId: 'demo-leadflow-ai-local',
      firestoreHost: '127.0.0.1:8080',
      localResetEnabled: false,
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

function ids() {
  const values = [requestId, traceId];
  let index = 0;
  return () => values[index++] ?? requestId;
}

function buildApp(intakeDependencies?: IntakeRouteDependencies) {
  const baseOptions = {
    phaseOne: readyStartup(),
    requestIdFactory: ids(),
  };
  const app = createApp(
    intakeDependencies === undefined
      ? baseOptions
      : { ...baseOptions, intake: intakeDependencies },
  );
  apps.add(app);
  return app;
}

describe('POST /v1/intake', () => {
  it('returns only after persistence and starts new processing with shared correlation', async () => {
    let committed = false;
    const persist = vi.fn(async (request) => {
      expect(request).toMatchObject({
        idempotencyKey: 'api-intake-001',
        systemBundleId: bundleId,
        requestId,
        traceId,
        intake: {
          givenName: 'Avery',
          email: 'avery@example.com',
          identityClass: 'fictional',
        },
      });
      committed = true;
      return accepted;
    });
    const postCommitFailure = vi.fn();
    const processPersisted = vi.fn(async (context) => {
      expect(committed).toBe(true);
      expect(context).toEqual({ accepted, requestId, traceId });
      throw new Error(
        'raw processing failure must not change HTTP persistence',
      );
    });
    const app = buildApp({
      persistence: { persist },
      systemBundleId: bundleId,
      processPersisted,
      onPostCommitFailure: postCommitFailure,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: { 'idempotency-key': 'api-intake-001' },
      payload: intake,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual(accepted);
    expect(persist).toHaveBeenCalledOnce();
    expect(processPersisted).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(postCommitFailure).toHaveBeenCalledWith({
        runId: accepted.runId,
        requestId,
      });
    });
  });

  it('keeps malformed and unsupported bodies as safe client errors', async () => {
    const persist = vi.fn();
    const app = buildApp({
      persistence: { persist },
      systemBundleId: bundleId,
    });

    const malformed = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'idempotency-key': 'api-intake-bad-json',
        'content-type': 'application/json',
      },
      payload: '{"schemaVersion":',
    });
    const unsupported = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: {
        'idempotency-key': 'api-intake-bad-type',
        'content-type': 'application/xml',
      },
      payload: '<intake/>',
    });

    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error).toMatchObject({
      code: 'validation_failed',
      retryable: false,
    });
    expect(unsupported.statusCode).toBe(415);
    expect(unsupported.json().error.code).toBe('validation_failed');
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns the original committed identity on replay without starting duplicate work', async () => {
    const replayed = { ...accepted, replayed: true };
    const processPersisted = vi.fn(async () => undefined);
    const app = buildApp({
      persistence: { persist: async () => replayed },
      systemBundleId: bundleId,
      processPersisted,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: { 'idempotency-key': 'api-intake-001' },
      payload: intake,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(replayed);
    expect(processPersisted).not.toHaveBeenCalled();
  });

  it('returns a safe conflict without changing it into a storage failure', async () => {
    const app = buildApp({
      persistence: {
        persist: async () => {
          throw new IdempotencyConflictError();
        },
      },
      systemBundleId: bundleId,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: { 'idempotency-key': 'api-intake-001' },
      payload: intake,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      schemaVersion: 'error-response-v1',
      error: {
        code: 'idempotency_conflict',
        category: 'conflict',
        retryable: false,
      },
      requestId,
    });
  });

  it.each([
    [{}, { ...intake, email: 'person@real-domain.test' }],
    [{ 'idempotency-key': 'api-intake-001' }, { ...intake, extra: true }],
  ])(
    'rejects invalid headers or body without calling persistence',
    async (headers, payload) => {
      const persist = vi.fn(async () => accepted);
      const app = buildApp({
        persistence: { persist },
        systemBundleId: bundleId,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/intake',
        headers,
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: 'validation_failed', retryable: false },
      });
      expect(response.body).not.toContain('real-domain.test');
      expect(persist).not.toHaveBeenCalled();
    },
  );

  it('fails closed when stateful startup is unavailable', async () => {
    const persist = vi.fn(async () => accepted);
    const app = createApp({
      intake: { persistence: { persist }, systemBundleId: bundleId },
      requestIdFactory: ids(),
    });
    apps.add(app);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: { 'idempotency-key': 'api-intake-001' },
      payload: intake,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: { code: 'storage_unavailable', retryable: true },
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns a fixed safe storage error without leaking the raw failure', async () => {
    const app = buildApp({
      persistence: {
        persist: async () => {
          throw new Error('secret raw backend detail');
        },
      },
      systemBundleId: bundleId,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/intake',
      headers: { 'idempotency-key': 'api-intake-001' },
      payload: intake,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: { code: 'storage_unavailable', retryable: true },
      requestId,
    });
    expect(response.body).not.toContain('secret raw backend detail');
  });
});
