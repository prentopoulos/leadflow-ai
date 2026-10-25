// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRunClient } from './run-client.js';

describe('run client', () => {
  it('posts the expected revision and accepts only the shared resume response', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        schemaVersion: 'resume-response-v1',
        runId: '22222222-2222-4222-8222-222222222222',
        revision: 5,
        status: 'running',
        replayed: false,
      }),
    );
    const client = createRunClient(fetcher);

    await expect(
      client.resume('22222222-2222-4222-8222-222222222222', 4),
    ).resolves.toMatchObject({
      status: 'ok',
      value: { revision: 5, status: 'running' },
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/v1/runs/22222222-2222-4222-8222-222222222222/resume',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expectedRevision: 4 }),
      }),
    );
  });

  it('keeps malformed and unavailable run responses out of the UI contract', async () => {
    const malformed = createRunClient(
      vi.fn(async () => Response.json({ raw: 'backend detail' })),
    );
    const unavailable = createRunClient(
      vi.fn(async () => {
        throw new Error('raw network detail');
      }),
    );

    await expect(malformed.get('run-id')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'storage_unavailable' },
    });
    await expect(unavailable.get('run-id')).resolves.toMatchObject({
      status: 'error',
      error: { code: 'storage_unavailable', retryable: true },
    });
  });
});
