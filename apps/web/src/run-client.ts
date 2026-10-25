import {
  ErrorResponseSchema,
  ResumeResponseSchema,
  RunDetailResponseSchema,
  type ResumeResponse,
  type RunDetailResponse,
  type SafeError,
} from '@leadflow-ai/domain';

export type RunResult<T> =
  { status: 'ok'; value: T } | { status: 'error'; error: SafeError };

export interface RunClient {
  get(runId: string): Promise<RunResult<RunDetailResponse>>;
  resume(
    runId: string,
    expectedRevision: number,
  ): Promise<RunResult<ResumeResponse>>;
}

type Fetcher = typeof fetch;

function unavailable(message: string): RunResult<never> {
  return {
    status: 'error',
    error: {
      code: 'storage_unavailable',
      category: 'storage',
      retryable: true,
      message,
    },
  };
}

async function parseResponse<T>(
  response: Response,
  parseSuccess: (
    payload: unknown,
  ) => { success: true; data: T } | { success: false },
): Promise<RunResult<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return unavailable('The local run service returned an invalid response.');
  }
  if (response.ok) {
    const parsed = parseSuccess(payload);
    return parsed.success
      ? { status: 'ok', value: parsed.data }
      : unavailable('The local run service returned an invalid response.');
  }
  const rejected = ErrorResponseSchema.safeParse(payload);
  return rejected.success
    ? { status: 'error', error: rejected.data.error }
    : unavailable('The local run request could not be completed.');
}

export function createRunClient(fetcher: Fetcher = fetch): RunClient {
  return {
    async get(runId) {
      try {
        const response = await fetcher(
          `/v1/runs/${encodeURIComponent(runId)}`,
          {
            signal: AbortSignal.timeout(5_000),
          },
        );
        return await parseResponse(response, (payload) => {
          const parsed = RunDetailResponseSchema.safeParse(payload);
          return parsed.success
            ? { success: true, data: parsed.data }
            : { success: false };
        });
      } catch {
        return unavailable(
          'Newer stored run state is temporarily unavailable.',
        );
      }
    },
    async resume(runId, expectedRevision) {
      try {
        const response = await fetcher(
          `/v1/runs/${encodeURIComponent(runId)}/resume`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedRevision }),
            // The route runs the resumed workflow before answering; polling
            // still reflects committed state if this request gives up.
            signal: AbortSignal.timeout(30_000),
          },
        );
        return await parseResponse(response, (payload) => {
          const parsed = ResumeResponseSchema.safeParse(payload);
          return parsed.success
            ? { success: true, data: parsed.data }
            : { success: false };
        });
      } catch {
        return unavailable('The resume request could not be completed.');
      }
    },
  };
}

export const runClient = createRunClient();
