import { afterEach, describe, expect, it } from 'vitest';
import { LEADFLOW_LOCAL_PROJECT_ID } from '@leadflow-ai/domain';
import type { AgentRouteDependencies } from './agent-route.js';
import { createApp } from './app.js';
import type { PhaseOneStartup } from './startup.js';

const apps = new Set<ReturnType<typeof createApp>>();
afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

const startup: PhaseOneStartup = {
  status: 'ready',
  configuration: {
    mode: 'local',
    configurationVersion: 'phase-2-local-v1',
    projectId: LEADFLOW_LOCAL_PROJECT_ID,
    firestoreHost: '127.0.0.1:8080',
    apiHost: 'localhost',
    localResetEnabled: false,
    enrichmentMode: 'recorded',
    agents: 'claude',
    webOrigin: 'http://127.0.0.1:5173',
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
} as PhaseOneStartup;

function control(available: boolean): AgentRouteDependencies {
  let hasKey = available;
  let enabled = false;
  const settings = () => ({
    schemaVersion: 'agent-settings-v1' as const,
    available: hasKey,
    enabled: hasKey && enabled,
    leadCapUsd: 0.3,
    processCapUsd: 8,
    spentUsd: 0,
  });
  return {
    settings,
    setEnabled: (value) => {
      enabled = hasKey && value;
      return settings();
    },
    saveApiKey: async () => {
      hasKey = true;
      enabled = true;
      return settings();
    },
  };
}

describe('agent switch route', () => {
  it('reports the switch and turns it on and off', async () => {
    const app = createApp({ phaseOne: startup, agents: control(true) });
    apps.add(app);
    const initial = await app.inject({ method: 'GET', url: '/v1/agents' });
    expect(initial.json()).toMatchObject({ available: true, enabled: false });
    const on = await app.inject({
      method: 'PUT',
      url: '/v1/agents',
      payload: { enabled: true },
    });
    expect(on.json()).toMatchObject({ enabled: true });
    const off = await app.inject({
      method: 'PUT',
      url: '/v1/agents',
      payload: { enabled: false },
    });
    expect(off.json()).toMatchObject({ enabled: false });
  });

  it('refuses to turn on without a key and rejects unknown fields', async () => {
    const app = createApp({ phaseOne: startup, agents: control(false) });
    apps.add(app);
    const refused = await app.inject({
      method: 'PUT',
      url: '/v1/agents',
      payload: { enabled: true },
    });
    expect(refused.statusCode).toBe(409);
    const malformed = await app.inject({
      method: 'PUT',
      url: '/v1/agents',
      payload: { enabled: true, cap: 100 },
    });
    expect(malformed.statusCode).toBe(400);
  });

  it('accepts a bounded key without echoing it and enables the team', async () => {
    const agents = control(false);
    const app = createApp({ phaseOne: startup, agents });
    apps.add(app);
    const apiKey = `sk-ant-${'a'.repeat(24)}`;
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/agents/key',
      payload: { apiKey },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(apiKey);
    expect(response.json()).toMatchObject({ available: true, enabled: true });
  });

  it('rejects malformed and dotenv-injecting keys', async () => {
    const app = createApp({ phaseOne: startup, agents: control(false) });
    apps.add(app);
    for (const apiKey of [
      '',
      `sk-ant-${'a'.repeat(20)}\nHOST=attacker`,
      `sk-ant-${'a'.repeat(20)}"`,
      `not-anthropic-${'a'.repeat(20)}`,
    ]) {
      const response = await app.inject({
        method: 'PUT',
        url: '/v1/agents/key',
        payload: { apiKey },
      });
      expect(response.statusCode).toBe(400);
      if (apiKey.length > 0) expect(response.body).not.toContain(apiKey);
    }
  });

  it('keeps the team unavailable when key persistence fails', async () => {
    const agents = control(false);
    agents.saveApiKey = async () => {
      throw new Error('fixture write failure');
    };
    const app = createApp({ phaseOne: startup, agents });
    apps.add(app);
    const apiKey = `sk-ant-${'a'.repeat(24)}`;
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/agents/key',
      payload: { apiKey },
    });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain(apiKey);
    const settings = await app.inject({ method: 'GET', url: '/v1/agents' });
    expect(settings.json()).toMatchObject({ available: false, enabled: false });
  });

  it('is absent without local agent dependencies', async () => {
    const app = createApp({ phaseOne: startup });
    apps.add(app);
    const response = await app.inject({ method: 'GET', url: '/v1/agents' });
    expect(response.statusCode).toBe(404);
    const keyResponse = await app.inject({
      method: 'PUT',
      url: '/v1/agents/key',
      payload: { apiKey: `sk-ant-${'a'.repeat(24)}` },
    });
    expect(keyResponse.statusCode).toBe(404);
  });
});
