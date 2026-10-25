import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_RESET_CONFIRMATION,
  LocalResetDeniedError,
  resetLocalEmulatorData,
  type LocalResetRequest,
} from './local-reset.js';

const authorized: LocalResetRequest = {
  enabled: true,
  remoteAddress: '127.0.0.1',
  projectId: 'demo-leadflow-ai-local',
  firestoreHost: '127.0.0.1:8080',
  confirmation: LOCAL_RESET_CONFIRMATION,
};

describe('guarded local emulator reset', () => {
  it.each([
    { enabled: false },
    { remoteAddress: '192.0.2.10' },
    { remoteAddress: '::1' },
    { projectId: 'production-project' },
    { firestoreHost: 'localhost:8080' },
    { firestoreHost: '127.0.0.1:9090' },
    { confirmation: 'yes' },
  ])(
    'denies incomplete or unsafe guards without a delete call',
    async (patch) => {
      const fetchImplementation = vi.fn<typeof fetch>();
      await expect(
        resetLocalEmulatorData(
          { ...authorized, ...patch },
          fetchImplementation,
        ),
      ).rejects.toBeInstanceOf(LocalResetDeniedError);
      expect(fetchImplementation).not.toHaveBeenCalled();
    },
  );

  it('deletes only the exact local emulator database after every guard matches', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    await expect(
      resetLocalEmulatorData(authorized, fetchImplementation),
    ).resolves.toEqual({
      projectId: 'demo-leadflow-ai-local',
      firestoreHost: '127.0.0.1:8080',
      evidenceClass: 'synthetic-local',
      deleted: true,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/emulator/v1/projects/demo-leadflow-ai-local/databases/(default)/documents',
      { method: 'DELETE' },
    );
  });

  it('reports emulator refusal without claiming deletion', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      resetLocalEmulatorData(authorized, fetchImplementation),
    ).rejects.toThrow(/HTTP 503/u);
  });
});
