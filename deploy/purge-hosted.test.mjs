import { describe, expect, it, vi } from 'vitest';
import { verifyPurgeAuthority } from './purge-hosted.mjs';

describe('hosted purge authority', () => {
  const projectId = 'synthetic-hosted-project';
  const requiredAccount = 'owner@example.com';

  it('requires the active gcloud project, account and ADC owner to agree', async () => {
    const runGcloud = vi
      .fn()
      .mockResolvedValueOnce(requiredAccount)
      .mockResolvedValueOnce(projectId)
      .mockResolvedValueOnce('private-token');
    const fetcher = vi.fn(async (_url, init) => {
      expect(init.headers.authorization).toBe('Bearer private-token');
      return new globalThis.Response(
        JSON.stringify({ email: requiredAccount, email_verified: true }),
        { status: 200 },
      );
    });
    await expect(
      verifyPurgeAuthority({
        projectId,
        requiredAccount,
        runGcloud,
        fetcher,
      }),
    ).resolves.toBe(requiredAccount);
  });

  it('refuses a different active owner before requesting an ADC token', async () => {
    const runGcloud = vi
      .fn()
      .mockResolvedValueOnce('other@example.com')
      .mockResolvedValueOnce(projectId);
    await expect(
      verifyPurgeAuthority({ projectId, requiredAccount, runGcloud }),
    ).rejects.toThrow(/does not match/u);
    expect(runGcloud).toHaveBeenCalledTimes(2);
  });

  it('refuses a different ADC owner', async () => {
    const runGcloud = vi
      .fn()
      .mockResolvedValueOnce(requiredAccount)
      .mockResolvedValueOnce(projectId)
      .mockResolvedValueOnce('private-token');
    const fetcher = vi.fn(
      async () =>
        new globalThis.Response(
          JSON.stringify({ email: 'other@example.com', email_verified: true }),
          { status: 200 },
        ),
    );
    await expect(
      verifyPurgeAuthority({
        projectId,
        requiredAccount,
        runGcloud,
        fetcher,
      }),
    ).rejects.toThrow(/not the required owner/u);
  });
});
