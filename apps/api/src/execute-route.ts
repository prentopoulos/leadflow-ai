import {
  ErrorResponseSchema,
  ExecuteResponseSchema,
  type ExecuteResponse,
  type SafeError,
} from '@leadflow-ai/domain';
import {
  RunLeaseConflictError,
  RunNotFoundError,
  RunRevisionConflictError,
  RunStateConflictError,
} from '@leadflow-ai/runtime';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createErrorResponse, type RequestIdFactory } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

const RunParametersSchema = z.object({ runId: z.string().uuid() }).strict();
const ExecuteBodySchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict();
const RequestIdSchema = z.string().uuid();

export interface ExecuteRequest {
  runId: string;
  expectedRevision: number;
  traceId: string;
  requestId: string;
}

export interface ExecuteRouteDependencies {
  // Claims the persisted run and holds the request while bounded workflow work
  // proceeds; resolves with the stored outcome, never an invented success.
  execute(request: ExecuteRequest): Promise<ExecuteResponse>;
}

function error(
  code: SafeError['code'],
  category: SafeError['category'],
  retryable: boolean,
  message: string,
): SafeError {
  return { code, category, retryable, message };
}

// Hosted mode only. Intake commits and answers 202 without starting work; the
// authenticated browser then holds this request while polling stored state.
export function registerExecuteRoute(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  dependencies: ExecuteRouteDependencies | undefined,
  requestIdFactory: RequestIdFactory,
): void {
  if (phaseOne.status !== 'ready' || phaseOne.configuration.mode !== 'cloud') {
    return;
  }
  app.post(
    '/v1/runs/:runId/execute',
    {
      schema: {
        params: RunParametersSchema,
        body: ExecuteBodySchema,
        response: {
          200: ExecuteResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          503: ErrorResponseSchema,
          504: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const requestId = RequestIdSchema.parse(requestIdFactory());
      if (dependencies === undefined) {
        return reply
          .code(503)
          .send(
            createErrorResponse(
              error(
                'storage_unavailable',
                'storage',
                true,
                'The hosted runtime is unavailable.',
              ),
              () => requestId,
            ),
          );
      }
      const { runId } = RunParametersSchema.parse(request.params);
      const { expectedRevision } = ExecuteBodySchema.parse(request.body);
      const traceId = RequestIdSchema.parse(requestIdFactory());
      let outcome: ExecuteResponse;
      try {
        outcome = await dependencies.execute({
          runId,
          expectedRevision,
          traceId,
          requestId,
        });
      } catch (cause) {
        const mapped: { status: 404 | 409 | 503; error: SafeError } =
          cause instanceof RunNotFoundError
            ? {
                status: 404,
                error: error(
                  'run_not_found',
                  'validation',
                  false,
                  'The requested run does not exist.',
                ),
              }
            : cause instanceof RunRevisionConflictError
              ? {
                  // A duplicate or stale request: another request already
                  // claimed this revision, so the browser keeps polling.
                  status: 409,
                  error: error(
                    'revision_conflict',
                    'conflict',
                    false,
                    'The run already advanced past this revision.',
                  ),
                }
              : cause instanceof RunLeaseConflictError
                ? {
                    status: 409,
                    error: error(
                      'lease_active',
                      'conflict',
                      true,
                      'The run has an active execution lease.',
                    ),
                  }
                : cause instanceof RunStateConflictError
                  ? {
                      status: 409,
                      error: error(
                        'run_ineligible',
                        'conflict',
                        false,
                        'Only a newly persisted run can be executed.',
                      ),
                    }
                  : {
                      status: 503,
                      error: error(
                        'storage_unavailable',
                        'storage',
                        true,
                        'The execution request could not be completed.',
                      ),
                    };
        return reply
          .code(mapped.status)
          .send(createErrorResponse(mapped.error, () => requestId));
      }
      if (outcome.outcome === 'deadline') {
        return reply
          .code(504)
          .send(
            createErrorResponse(
              error(
                'execution_deadline',
                'runtime',
                true,
                'Execution stopped at its time limit; the run can be resumed.',
              ),
              () => requestId,
            ),
          );
      }
      return reply.code(200).send(outcome);
    },
  );
}
