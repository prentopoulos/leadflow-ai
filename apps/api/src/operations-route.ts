import {
  ErrorResponseSchema,
  METRICS_DEFINITIONS,
  MetricsResponseSchema,
  RunListFilterSchema,
  RunListResponseSchema,
  type SafeError,
} from '@leadflow-ai/domain';
import {
  MetricsWindowExceededError,
  OperationsIntegrityError,
  type OperationsService,
} from '@leadflow-ai/runtime';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createErrorResponse, type RequestIdFactory } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

const RunListQuerySchema = z
  .object({
    filter: RunListFilterSchema.default('all'),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

export interface OperationsRouteDependencies {
  operations: Pick<OperationsService, 'list' | 'metrics'>;
  systemBundleId: string;
}

function safeError(
  code: SafeError['code'],
  category: SafeError['category'],
  retryable: boolean,
  message: string,
): SafeError {
  return { code, category, retryable, message };
}

function unavailable(reply: FastifyReply, requestIdFactory?: RequestIdFactory) {
  return reply
    .code(503)
    .send(
      createErrorResponse(
        safeError(
          'storage_unavailable',
          'storage',
          true,
          'Local operations data is unavailable.',
        ),
        requestIdFactory,
      ),
    );
}

export function registerOperationsRoutes(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  dependencies: OperationsRouteDependencies | undefined,
  requestIdFactory?: RequestIdFactory,
): void {
  app.get(
    '/v1/runs',
    {
      schema: {
        querystring: RunListQuerySchema,
        response: {
          200: RunListResponseSchema,
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (phaseOne.status !== 'ready' || dependencies === undefined) {
        return unavailable(reply, requestIdFactory);
      }
      const query = RunListQuerySchema.parse(request.query);
      try {
        return await dependencies.operations.list({
          filter: query.filter,
          cursor: query.cursor ?? null,
          limit: query.limit,
        });
      } catch (error) {
        if (error instanceof OperationsIntegrityError) {
          return reply
            .code(409)
            .send(
              createErrorResponse(
                safeError(
                  'revision_conflict',
                  'conflict',
                  false,
                  'The requested run-list snapshot is unavailable.',
                ),
                requestIdFactory,
              ),
            );
        }
        return unavailable(reply, requestIdFactory);
      }
    },
  );

  app.get(
    '/v1/metrics',
    {
      schema: {
        response: {
          200: MetricsResponseSchema,
          409: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      if (phaseOne.status !== 'ready' || dependencies === undefined) {
        return unavailable(reply, requestIdFactory);
      }
      try {
        const report = await dependencies.operations.metrics(
          dependencies.systemBundleId,
        );
        return MetricsResponseSchema.parse({
          schemaVersion: 'metrics-response-v1',
          definitions: METRICS_DEFINITIONS,
          report,
          retrievedAt: report.generatedAt,
        });
      } catch (error) {
        if (error instanceof MetricsWindowExceededError) {
          return reply
            .code(409)
            .send(
              createErrorResponse(
                safeError(
                  'window_exceeded',
                  'conflict',
                  false,
                  'The metrics window exceeds 2,000 retained runs.',
                ),
                requestIdFactory,
              ),
            );
        }
        if (error instanceof OperationsIntegrityError) {
          return reply
            .code(503)
            .send(
              createErrorResponse(
                safeError(
                  'invariant_failed',
                  'runtime',
                  false,
                  'Stored metrics inputs failed integrity checks.',
                ),
                requestIdFactory,
              ),
            );
        }
        return unavailable(reply, requestIdFactory);
      }
    },
  );
}
