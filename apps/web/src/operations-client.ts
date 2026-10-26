import {
  DraftActionResponseSchema,
  ErrorResponseSchema,
  MetricsResponseSchema,
  RunListResponseSchema,
  type DraftActionResponse,
  type MetricsResponse,
  type RunListFilter,
  type RunListResponse,
  type SafeError,
} from '@leadflow-ai/domain';
import type { RunResult } from './run-client.js';

type Fetcher = typeof fetch;

export interface DraftRevisionInput {
  baseRevisionId: string;
  baseContentSha256: string;
  subject: string;
  body: string;
}

export interface DraftReviewInput {
  revisionId: string;
  contentSha256: string;
  decision: 'approved' | 'rejected';
}

export interface OperationsClient {
  list(
    filter: RunListFilter,
    cursor?: string,
    limit?: number,
  ): Promise<RunResult<RunListResponse>>;
  metrics(): Promise<RunResult<MetricsResponse>>;
  revise(
    draftId: string,
    input: DraftRevisionInput,
  ): Promise<RunResult<DraftActionResponse>>;
  review(
    draftId: string,
    input: DraftReviewInput,
  ): Promise<RunResult<DraftActionResponse>>;
}

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
  parser: { safeParse(payload: unknown): { success: boolean; data?: T } },
): Promise<RunResult<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return unavailable(
      'The local operations service returned an invalid response.',
    );
  }
  if (response.ok) {
    const parsed = parser.safeParse(payload);
    return parsed.success && parsed.data !== undefined
      ? { status: 'ok', value: parsed.data }
      : unavailable(
          'The local operations service returned an invalid response.',
        );
  }
  const rejected = ErrorResponseSchema.safeParse(payload);
  return rejected.success
    ? { status: 'error', error: rejected.data.error }
    : unavailable('The local operations request could not be completed.');
}

async function request<T>(
  fetcher: Fetcher,
  path: string,
  parser: { safeParse(payload: unknown): { success: boolean; data?: T } },
  init?: RequestInit,
): Promise<RunResult<T>> {
  try {
    const response = await fetcher(path, {
      ...init,
      signal: AbortSignal.timeout(5_000),
    });
    return await parseResponse(response, parser);
  } catch {
    return unavailable('Stored operations data is temporarily unavailable.');
  }
}

export function createOperationsClient(
  fetcher: Fetcher = fetch,
): OperationsClient {
  return {
    list(filter, cursor, limit = 12) {
      const query = new URLSearchParams({ filter, limit: String(limit) });
      if (cursor !== undefined) query.set('cursor', cursor);
      return request(
        fetcher,
        `/v1/runs?${query.toString()}`,
        RunListResponseSchema,
      );
    },
    metrics() {
      return request(fetcher, '/v1/metrics', MetricsResponseSchema);
    },
    revise(draftId, input) {
      return request(
        fetcher,
        `/v1/drafts/${encodeURIComponent(draftId)}/revisions`,
        DraftActionResponseSchema,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
    },
    review(draftId, input) {
      return request(
        fetcher,
        `/v1/drafts/${encodeURIComponent(draftId)}/reviews`,
        DraftActionResponseSchema,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
    },
  };
}

export const operationsClient = createOperationsClient();

export type { SafeError };
