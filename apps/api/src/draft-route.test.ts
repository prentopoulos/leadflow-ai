import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftConflictError } from '@leadflow-ai/runtime';
import { createApp } from './app.js';
import type { PhaseOneStartup } from './startup.js';

const draftId = '11111111-1111-4111-8111-111111111111';
const revisionId = '22222222-2222-4222-8222-222222222222';
const digest = 'a'.repeat(64);
const requestId = '33333333-3333-4333-8333-333333333333';
const traceId = '44444444-4444-4444-8444-444444444444';
const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

function startup(): PhaseOneStartup {
  return {
    status: 'ready',
    configuration: {
      mode: 'local',
      configurationVersion: 'phase-2-local-v1',
      projectId: 'demo-leadflow-ai-local',
      firestoreHost: '127.0.0.1:8080',
      apiHost: 'localhost',
      localResetEnabled: false,
      enrichmentMode: 'recorded',
      agents: 'off',
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

function requestIds() {
  const values = [requestId, traceId];
  let index = 0;
  return () => values[index++] ?? requestId;
}

describe('Phase 2 draft routes', () => {
  it('maps stale or already-decided reviews to a fixed conflict', async () => {
    const review = vi.fn(async () => {
      throw new DraftConflictError();
    });
    const app = createApp({
      phaseOne: startup(),
      drafts: { review, revise: vi.fn() },
      requestIdFactory: requestIds(),
    });
    apps.add(app);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/drafts/${draftId}/reviews`,
      headers: { origin: 'http://127.0.0.1:5173' },
      payload: {
        revisionId,
        contentSha256: digest,
        decision: 'approved',
      },
    });

    expect(response.statusCode, response.body).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: 'draft_conflict', retryable: false },
      requestId,
    });
    expect(review).toHaveBeenCalledWith({
      draftId,
      revisionId,
      contentSha256: digest,
      decision: 'approved',
      requestId,
      traceId,
    });
  });

  it('rejects malformed edits before calling the draft service', async () => {
    const revise = vi.fn();
    const app = createApp({
      phaseOne: startup(),
      drafts: { review: vi.fn(), revise },
      requestIdFactory: requestIds(),
    });
    apps.add(app);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/drafts/${draftId}/revisions`,
      headers: { origin: 'http://127.0.0.1:5173' },
      payload: {
        baseRevisionId: revisionId,
        baseContentSha256: 'bad',
        subject: '',
        body: '',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(revise).not.toHaveBeenCalled();
  });
});
