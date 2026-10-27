import {
  ErrorResponseSchema,
  ExecuteResponseSchema,
  ResumeResponseSchema,
  RunDetailResponseSchema,
  type ExecuteResponse,
  type ResumeResponse,
  type RunDetailResponse,
  type SafeError,
} from '@leadflow-ai/domain';
import { apiFetch } from './session-context.js';

export type RunResult<T> =
  { status: 'ok'; value: T } | { status: 'error'; error: SafeError };

export interface RunClient {
  get(runId: string): Promise<RunResult<RunDetailResponse>>;
  resume(
    runId: string,
    expectedRevision: number,
  ): Promise<RunResult<ResumeResponse>>;
  // Hosted only: holds the request while the stored run executes.
  execute?(
    runId: string,
    expectedRevision: number,
  ): Promise<RunResult<ExecuteResponse>>;
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

export function createRunClient(fetcher: Fetcher = apiFetch): RunClient {
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
            // Hosted resume answers after its bounded continuation stops
            // (under 60 s); polling still reflects committed state if this
            // request gives up.
            signal: AbortSignal.timeout(65_000),
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
    async execute(runId, expectedRevision) {
      try {
        const response = await fetcher(
          `/v1/runs/${encodeURIComponent(runId)}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedRevision }),
            // The platform deadline is 60 s; stored state stays authoritative.
            signal: AbortSignal.timeout(65_000),
          },
        );
        return await parseResponse(response, (payload) => {
          const parsed = ExecuteResponseSchema.safeParse(payload);
          return parsed.success
            ? { success: true, data: parsed.data }
            : { success: false };
        });
      } catch {
        return unavailable(
          'The execution request ended early; stored progress is still shown.',
        );
      }
    },
  };
}

export const runClient = createRunClient();
