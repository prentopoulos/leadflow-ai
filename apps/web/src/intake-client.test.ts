// @vitest-environment jsdom
import type { IntakeSubmission } from '@leadflow-ai/domain';
import { describe, expect, it, vi } from 'vitest';
import { submitIntake } from './intake-client.js';

const intake: IntakeSubmission = {
  schemaVersion: 'intake-v2',
  identityClass: 'fictional',
  givenName: 'Avery',
  familyName: 'Jordan',
  email: 'avery.jordan@example.com',
  zipCode: '22150',
  vehicleYear: 2021,
  vehicleMake: 'Subaru',
  vehicleModel: 'Outback',
  coverageFocus: 'balanced',
  requestIntent: 'compare_options',
  needTimeline: 'days_31_to_90',
  requestDetails: 'Synthetic test request.',
  emailContactConsent: false,
  consentRecord: null,
};

const accepted = {
  schemaVersion: 'intake-response-v1',
  leadId: '11111111-1111-4111-8111-111111111111',
  runId: '22222222-2222-4222-8222-222222222222',
  runRevision: 0,
  replayed: false,
  committedAt: '2026-10-25T18:00:00.000Z',
  evidenceClass: 'synthetic-local',
} as const;

describe('intake client', () => {
  it('sends the shared intake contract with the caller-owned idempotency key', async () => {
    const fetcher = vi.fn(async () => Response.json(accepted, { status: 202 }));

    await expect(
      submitIntake(intake, 'stable-intake-key', fetcher),
    ).resolves.toEqual({ status: 'accepted', value: accepted });
    expect(fetcher).toHaveBeenCalledWith(
      '/v1/intake',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'stable-intake-key',
        },
        body: JSON.stringify(intake),
      }),
    );
  });

  it('returns only schema-valid safe API errors', async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          schemaVersion: 'error-response-v1',
          error: {
            code: 'storage_unavailable',
            category: 'storage',
            retryable: true,
            message: 'The intake could not be persisted.',
          },
          requestId: '33333333-3333-4333-8333-333333333333',
        },
        { status: 503 },
      ),
    );

    await expect(
      submitIntake(intake, 'stable-intake-key', fetcher),
    ).resolves.toEqual({
      status: 'rejected',
      error: {
        code: 'storage_unavailable',
        category: 'storage',
        retryable: true,
        message: 'The intake could not be persisted.',
      },
    });
  });

  it('replaces network and malformed responses with fixed local errors', async () => {
    const unavailable = vi.fn(async () => {
      throw new Error('raw network detail');
    });
    const malformed = vi.fn(async () => Response.json({ raw: 'detail' }));

    await expect(
      submitIntake(intake, 'stable-intake-key', unavailable),
    ).resolves.toMatchObject({
      status: 'rejected',
      error: { code: 'storage_unavailable', retryable: true },
    });
    await expect(
      submitIntake(intake, 'stable-intake-key', malformed),
    ).resolves.toMatchObject({
      status: 'rejected',
      error: { code: 'unknown_failure', retryable: false },
    });
  });
});
