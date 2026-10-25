import { randomUUID } from 'node:crypto';
import {
  ErrorResponseSchema,
  IdempotencyKeySchema,
  IntakeAcceptedResponseSchema,
  IntakeSubmissionSchema,
  type IntakeAcceptedResponse,
  type SafeError,
} from '@leadflow-ai/domain';
import {
  IdempotencyConflictError,
  type IntakePersistenceService,
  type PersistIntakeRequest,
} from '@leadflow-ai/runtime';
import type { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import type { PhaseOneStartup } from './startup.js';

const IntakeHeadersSchema = z
  .object({ 'idempotency-key': IdempotencyKeySchema })
  .loose();
const RequestIdSchema = z.string().uuid();

export interface IntakeProcessingContext {
  accepted: IntakeAcceptedResponse;
  traceId: string;
  requestId: string;
}

export interface IntakeRouteDependencies {
  persistence: Pick<IntakePersistenceService, 'persist'>;
  systemBundleId: string;
  processPersisted?: (context: IntakeProcessingContext) => Promise<void>;
  onPostCommitFailure?: (context: { runId: string; requestId: string }) => void;
}

export type RequestIdFactory = () => string;

function safeError(
  code: SafeError['code'],
  category: SafeError['category'],
  retryable: boolean,
  message: string,
): SafeError {
  return { code, category, retryable, message };
}

export function createErrorResponse(
  error: SafeError,
  requestIdFactory: RequestIdFactory = randomUUID,
) {
  return ErrorResponseSchema.parse({
    schemaVersion: 'error-response-v1',
    error,
    requestId: RequestIdSchema.parse(requestIdFactory()),
  });
}

function reportPostCommitFailure(
  dependencies: IntakeRouteDependencies,
  context: IntakeProcessingContext,
): void {
  try {
    dependencies.onPostCommitFailure?.({
      runId: context.accepted.runId,
      requestId: context.requestId,
    });
  } catch {
    // The durable run is authoritative; reporting failure cannot change the response.
  }
}

function beginPostCommitProcessing(
  dependencies: IntakeRouteDependencies,
  context: IntakeProcessingContext,
): void {
  if (dependencies.processPersisted === undefined) return;
  try {
    void dependencies
      .processPersisted(context)
      .catch(() => reportPostCommitFailure(dependencies, context));
  } catch {
    reportPostCommitFailure(dependencies, context);
  }
}

export function registerIntakeRoute(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  dependencies: IntakeRouteDependencies | undefined,
  requestIdFactory: RequestIdFactory = randomUUID,
): void {
  if (phaseOne.status === 'ready' && dependencies !== undefined) {
    RequestIdSchema.parse(dependencies.systemBundleId);
  }
  app.post(
    '/v1/intake',
    {
      schema: {
        headers: IntakeHeadersSchema,
        body: IntakeSubmissionSchema,
        response: {
          200: IntakeAcceptedResponseSchema,
          202: IntakeAcceptedResponseSchema,
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,
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
              safeError(
                'storage_unavailable',
                'storage',
                true,
                'Local stateful runtime is unavailable.',
              ),
              requestIdFactory,
            ),
          );
      }

      const requestId = RequestIdSchema.parse(requestIdFactory());
      const traceId = RequestIdSchema.parse(requestIdFactory());
      const headers = IntakeHeadersSchema.parse(request.headers);
      const intake = IntakeSubmissionSchema.parse(request.body);
      let accepted: IntakeAcceptedResponse;
      try {
        const persistenceRequest: PersistIntakeRequest = {
          idempotencyKey: headers['idempotency-key'],
          intake,
          systemBundleId: dependencies.systemBundleId,
          traceId,
          requestId,
        };
        accepted = await dependencies.persistence.persist(persistenceRequest);
      } catch (error) {
        if (error instanceof IdempotencyConflictError) {
          return reply
            .code(409)
            .send(
              createErrorResponse(
                safeError(
                  'idempotency_conflict',
                  'conflict',
                  false,
                  'The idempotency key is already bound to different intake content.',
                ),
                () => requestId,
              ),
            );
        }
        if (error instanceof ZodError) {
          return reply
            .code(400)
            .send(
              createErrorResponse(
                safeError(
                  'validation_failed',
                  'validation',
                  false,
                  'Request validation failed.',
                ),
                () => requestId,
              ),
            );
        }
        return reply
          .code(503)
          .send(
            createErrorResponse(
              safeError(
                'storage_unavailable',
                'storage',
                true,
                'The intake could not be persisted.',
              ),
              () => requestId,
            ),
          );
      }

      if (!accepted.replayed) {
        beginPostCommitProcessing(dependencies, {
          accepted,
          traceId,
          requestId,
        });
      }
      return reply.code(accepted.replayed ? 200 : 202).send(accepted);
    },
  );
}
