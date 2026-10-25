import {
  ErrorResponseSchema,
  RunDetailResponseSchema,
  type SafeError,
} from '@leadflow-ai/domain';
import {
  RunDetailIntegrityError,
  RunDetailSnapshotUnavailableError,
  RunNotFoundError,
  type RunDetailService,
} from '@leadflow-ai/runtime';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createErrorResponse, type RequestIdFactory } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

const RunParametersSchema = z.object({ runId: z.string().uuid() }).strict();

export interface RunRouteDependencies {
  details: Pick<RunDetailService, 'get'>;
}

function error(
  code: SafeError['code'],
  category: SafeError['category'],
  retryable: boolean,
  message: string,
): SafeError {
  return { code, category, retryable, message };
}

export function registerRunRoute(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  dependencies: RunRouteDependencies | undefined,
  requestIdFactory?: RequestIdFactory,
): void {
  app.get(
    '/v1/runs/:runId',
    {
      schema: {
        params: RunParametersSchema,
        response: {
          200: RunDetailResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (phaseOne.status !== 'ready' || dependencies === undefined) {
        return reply
          .code(503)
          .send(
            createErrorResponse(
              error(
                'storage_unavailable',
                'storage',
                true,
                'Local stateful runtime is unavailable.',
              ),
              requestIdFactory,
            ),
          );
      }
      const { runId } = RunParametersSchema.parse(request.params);
      try {
        return await dependencies.details.get(runId);
      } catch (cause) {
        if (cause instanceof RunNotFoundError) {
          return reply
            .code(404)
            .send(
              createErrorResponse(
                error(
                  'run_not_found',
                  'validation',
                  false,
                  'The requested run does not exist.',
                ),
                requestIdFactory,
              ),
            );
        }
        if (cause instanceof RunDetailSnapshotUnavailableError) {
          return reply
            .code(503)
            .send(
              createErrorResponse(
                error(
                  'storage_unavailable',
                  'storage',
                  true,
                  'A consistent stored run snapshot is temporarily unavailable.',
                ),
                requestIdFactory,
              ),
            );
        }
        if (cause instanceof RunDetailIntegrityError) {
          return reply
            .code(503)
            .send(
              createErrorResponse(
                error(
                  'invariant_failed',
                  'runtime',
                  false,
                  'Stored run detail failed integrity checks.',
                ),
                requestIdFactory,
              ),
            );
        }
        return reply
          .code(503)
          .send(
            createErrorResponse(
              error(
                'storage_unavailable',
                'storage',
                true,
                'Stored run detail is unavailable.',
              ),
              requestIdFactory,
            ),
          );
      }
    },
  );
}
