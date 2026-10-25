import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunDetailResponse, RunStatus } from '@leadflow-ai/domain';
import {
  CheckpointIncompatibleError,
  CheckpointMissingError,
  RunLeaseConflictError,
  RunNotFoundError,
  RunRevisionConflictError,
  RunStateConflictError,
} from '@leadflow-ai/runtime';
import { createApp } from './app.js';
import type { ResumeRouteDependencies } from './resume-route.js';
import type { PhaseOneStartup } from './startup.js';

const runId = '22222222-2222-4222-8222-222222222222';
const requestId = '55555555-5555-4555-8555-555555555555';
const traceId = '44444444-4444-4444-8444-444444444444';
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

function detail(
  status: RunStatus,
  revision: number,
  resumeRevision?: number,
): RunDetailResponse {
  return {
    run: { runId, status, revision },
    events:
      resumeRevision === undefined
        ? []
        : [{ name: 'run.resume_requested', runRevision: resumeRevision }],
  } as RunDetailResponse;
}

function idFactory() {
  const values = [requestId, traceId];
  let index = 0;
  return () => values[index++] ?? requestId;
}

function buildApp(dependencies: ResumeRouteDependencies) {
  const app = createApp({
    phaseOne: readyStartup(),
    resume: dependencies,
    requestIdFactory: idFactory(),
  });
  apps.add(app);
  return app;
}

describe('POST /v1/runs/:runId/resume', () => {
  it('passes the expected revision and server correlation into explicit resume', async () => {
    const resume = vi.fn(async () => ({}) as never);
    const app = buildApp({
      resume: { resume },
      details: { get: async () => detail('complete', 9) },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/runs/${runId}/resume`,
      payload: { expectedRevision: 0 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      schemaVersion: 'resume-response-v1',
      runId,
      revision: 9,
      status: 'complete',
      replayed: false,
    });
    expect(resume).toHaveBeenCalledWith({
      runId,
      expectedRevision: 0,
      ownerId: `api:${requestId}`,
      leaseDurationMs: 300_000,
      traceId,
      requestId,
      authorization: 'allowed',
    });
  });

  it('returns a durable replay only when history proves the requested resume committed', async () => {
    const app = buildApp({
      resume: {
        resume: async () => {
          throw new RunRevisionConflictError();
        },
      },
      details: { get: async () => detail('complete', 9, 1) },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/runs/${runId}/resume`,
      payload: { expectedRevision: 0 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      runId,
      revision: 9,
      status: 'complete',
      replayed: true,
    });
  });

  it('keeps an unrelated stale revision as a conflict', async () => {
    const app = buildApp({
      resume: {
        resume: async () => {
          throw new RunRevisionConflictError();
        },
      },
      details: { get: async () => detail('running', 2) },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/runs/${runId}/resume`,
      payload: { expectedRevision: 0 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: 'revision_conflict', retryable: false },
    });
  });

  it.each([
    [new RunNotFoundError(), 404, 'run_not_found', false],
    [new RunLeaseConflictError(), 409, 'lease_active', true],
    [new RunStateConflictError(), 409, 'run_ineligible', false],
    [new CheckpointMissingError(), 409, 'checkpoint_missing', false],
    [new CheckpointIncompatibleError(), 409, 'checkpoint_incompatible', false],
    [new Error('raw resume failure'), 503, 'storage_unavailable', true],
  ] as const)(
    'maps resume failure %# to a safe contract',
    async (failure, status, code, retryable) => {
      const app = buildApp({
        resume: {
          resume: async () => {
            throw failure;
          },
        },
        details: { get: async () => detail('failed_retryable', 7) },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/runs/${runId}/resume`,
        payload: { expectedRevision: 7 },
      });

      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({
        error: { code, retryable },
        requestId,
      });
      expect(response.body).not.toContain('raw resume failure');
    },
  );

  it('rejects invalid revisions before invoking resume', async () => {
    const resume = vi.fn(async () => ({}) as never);
    const app = buildApp({
      resume: { resume },
      details: { get: async () => detail('persisted', 0) },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/runs/${runId}/resume`,
      payload: { expectedRevision: -1, extra: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'validation_failed', retryable: false },
    });
    expect(resume).not.toHaveBeenCalled();
  });
});
