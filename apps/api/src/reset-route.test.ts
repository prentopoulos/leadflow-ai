import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LEADFLOW_LOCAL_PROJECT_ID,
  LOCAL_RESET_CONFIRMATION,
} from '@leadflow-ai/domain';
import { LocalResetDeniedError } from '@leadflow-ai/runtime';
import { createApp } from './app.js';
import type { PhaseOneStartup } from './startup.js';

const requestId = '55555555-5555-4555-8555-555555555555';
const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

function startup(localResetEnabled: boolean): PhaseOneStartup {
  return {
    status: 'ready',
    configuration: {
      configurationVersion: 'phase-2-local-v1',
      projectId: LEADFLOW_LOCAL_PROJECT_ID,
      firestoreHost: '127.0.0.1:8080',
      localResetEnabled,
    },
    firestore: {
      app: {} as never,
      database: {} as never,
      configuration: {
        projectId: LEADFLOW_LOCAL_PROJECT_ID,
        host: '127.0.0.1:8080',
      },
      close: async () => undefined,
    },
  };
}

function payload() {
  return {
    projectId: LEADFLOW_LOCAL_PROJECT_ID,
    confirmation: LOCAL_RESET_CONFIRMATION,
  };
}

describe('DELETE /v1/local-data', () => {
  it('is absent unless validated startup explicitly enables local reset', async () => {
    const reset = vi.fn();
    for (const phaseOne of [undefined, startup(false)]) {
      const app = createApp({
        ...(phaseOne === undefined ? {} : { phaseOne }),
        reset: { reset },
        requestIdFactory: () => requestId,
      });
      apps.add(app);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/local-data',
        payload: payload(),
      });
      expect(response.statusCode).toBe(404);
    }
    expect(reset).not.toHaveBeenCalled();
  });

  it('passes only fixed local guards to the reset boundary', async () => {
    const reset = vi.fn(async () => ({
      projectId: LEADFLOW_LOCAL_PROJECT_ID,
      firestoreHost: '127.0.0.1:8080' as const,
      evidenceClass: 'synthetic-local' as const,
      deleted: true as const,
    }));
    const app = createApp({
      phaseOne: startup(true),
      reset: { reset },
      requestIdFactory: () => requestId,
    });
    apps.add(app);

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/local-data',
      payload: payload(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      schemaVersion: 'local-reset-response-v1',
      projectId: LEADFLOW_LOCAL_PROJECT_ID,
      firestoreHost: '127.0.0.1:8080',
      evidenceClass: 'synthetic-local',
      deleted: true,
    });
    expect(reset).toHaveBeenCalledWith({
      enabled: true,
      remoteAddress: '127.0.0.1',
      projectId: LEADFLOW_LOCAL_PROJECT_ID,
      firestoreHost: '127.0.0.1:8080',
      confirmation: LOCAL_RESET_CONFIRMATION,
    });
  });

  it.each([
    { ...payload(), projectId: 'production-project' },
    { ...payload(), confirmation: 'DELETE EVERYTHING' },
    { ...payload(), extra: 'arbitrary-target' },
  ])(
    'rejects unsafe or expanded reset body %# before deletion',
    async (body) => {
      const reset = vi.fn();
      const app = createApp({
        phaseOne: startup(true),
        reset: { reset },
        requestIdFactory: () => requestId,
      });
      apps.add(app);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/local-data',
        payload: body,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: 'validation_failed', retryable: false },
      });
      expect(reset).not.toHaveBeenCalled();
    },
  );

  it('maps guard denial and emulator refusal without claiming deletion', async () => {
    for (const [failure, status, code] of [
      [new LocalResetDeniedError('raw guard detail'), 403, 'reset_denied'],
      [new Error('raw emulator refusal'), 503, 'storage_unavailable'],
    ] as const) {
      const app = createApp({
        phaseOne: startup(true),
        reset: {
          reset: async () => {
            throw failure;
          },
        },
        requestIdFactory: () => requestId,
      });
      apps.add(app);

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/local-data',
        payload: payload(),
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({
        error: { code },
        requestId,
      });
      expect(response.body).not.toContain('raw');
    }
  });
});
