import {
  ErrorResponseSchema,
  IntakeAcceptedResponseSchema,
  type IntakeAcceptedResponse,
  type IntakeSubmission,
  type SafeError,
} from '@leadflow-ai/domain';
import { apiFetch } from './session-context.js';

export type IntakeClientResult =
  | { status: 'accepted'; value: IntakeAcceptedResponse }
  | { status: 'rejected'; error: SafeError };

export type IntakeClient = (
  intake: IntakeSubmission,
  idempotencyKey: string,
) => Promise<IntakeClientResult>;

type Fetcher = typeof fetch;

function fixedError(
  code: SafeError['code'],
  category: SafeError['category'],
  retryable: boolean,
  message: string,
): IntakeClientResult {
  return { status: 'rejected', error: { code, category, retryable, message } };
}

export async function submitIntake(
  intake: IntakeSubmission,
  idempotencyKey: string,
  fetcher: Fetcher = apiFetch,
): Promise<IntakeClientResult> {
  let response: Response;
  try {
    response = await fetcher('/v1/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(intake),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return fixedError(
      'storage_unavailable',
      'storage',
      true,
      'The local intake service is unavailable. Your input remains in this browser.',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return fixedError(
      'unknown_failure',
      'runtime',
      response.status >= 500,
      'The local intake service returned an invalid response.',
    );
  }

  if (response.ok) {
    const accepted = IntakeAcceptedResponseSchema.safeParse(payload);
    return accepted.success
      ? { status: 'accepted', value: accepted.data }
      : fixedError(
          'unknown_failure',
          'runtime',
          false,
          'The local intake service returned an invalid response.',
        );
  }

  const rejected = ErrorResponseSchema.safeParse(payload);
  return rejected.success
    ? { status: 'rejected', error: rejected.data.error }
    : fixedError(
        'unknown_failure',
        'runtime',
        response.status >= 500,
        'The local intake request could not be completed.',
      );
}
