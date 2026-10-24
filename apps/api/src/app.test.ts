import { HealthResponseSchema } from '@leadflow-ai/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadServerConfig } from './config.js';

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
});
