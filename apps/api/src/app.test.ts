import { HealthResponseSchema } from '@leadflow-ai/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadPhaseOneConfig, loadServerConfig } from './config.js';
import { PHASE_ONE_UNAVAILABLE, createPhaseOneStartup } from './startup.js';

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

describe('API skeleton', () => {
  it('returns schema-valid process health without opening a listener', async () => {
    const app = createApp();
    apps.add(app);
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(response.json())).toMatchObject({
      status: 'ok',
      scope: 'process',
    });
    expect(app.server.listening).toBe(false);
  });

  it('rejects non-loopback host configuration', () => {
    expect(() => loadServerConfig({ HOST: '0.0.0.0', PORT: '3001' })).toThrow();
  });

  it('accepts only the exact local Phase 1 configuration', () => {
    expect(
      loadPhaseOneConfig({
        GCLOUD_PROJECT: 'demo-leadflow-ai-local',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        LEADFLOW_LOCAL_RESET_ENABLED: 'false',
      }),
    ).toEqual({
      configurationVersion: 'phase-2-local-v1',
      projectId: 'demo-leadflow-ai-local',
      firestoreHost: '127.0.0.1:8080',
      localResetEnabled: false,
    });
  });

  it.each([
    {},
    {
      GCLOUD_PROJECT: 'production-project',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    },
    {
      GCLOUD_PROJECT: 'demo-leadflow-ai-local',
      FIRESTORE_EMULATOR_HOST: 'http://127.0.0.1:8080',
    },
    {
      GCLOUD_PROJECT: 'demo-leadflow-ai-local',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      LEADFLOW_LOCAL_RESET_ENABLED: 'TRUE',
    },
  ])('fails closed for unsafe Phase 1 configuration %#', (environment) => {
    let boundaryCalls = 0;
    const startup = createPhaseOneStartup(environment, () => {
      boundaryCalls += 1;
      throw new Error('boundary must not be constructed');
    });

    expect(startup).toEqual(PHASE_ONE_UNAVAILABLE);
    expect(boundaryCalls).toBe(0);
  });

  it('constructs and closes only the validated loopback Firestore boundary', async () => {
    let closeCalls = 0;
    let boundaryEnvironment: Readonly<
      Record<string, string | undefined>
    > | null = null;
    const startup = createPhaseOneStartup(
      {
        GCLOUD_PROJECT: 'demo-leadflow-ai-local',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      },
      (environment) => {
        boundaryEnvironment = environment;
        return {
          app: {} as never,
          database: {} as never,
          configuration: {
            projectId: 'demo-leadflow-ai-local',
            host: '127.0.0.1:8080',
          },
          close: async () => {
            closeCalls += 1;
          },
        };
      },
    );
    const app = createApp({ phaseOne: startup });
    apps.add(app);

    expect(startup.status).toBe('ready');
    expect(boundaryEnvironment).toEqual({
      GCLOUD_PROJECT: 'demo-leadflow-ai-local',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'leadflow-api',
      scope: 'process',
      evidence: 'local-process',
    });
    await app.close();
    apps.delete(app);
    expect(closeCalls).toBe(1);
  });
});
