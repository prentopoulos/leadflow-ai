import { randomUUID } from 'node:crypto';
import {
  DraftActionResponseSchema,
  DraftReviewRequestSchema,
  DraftRevisionRequestSchema,
  ErrorResponseSchema,
  type SafeError,
} from '@leadflow-ai/domain';
import {
  DraftConflictError,
  DraftIntegrityError,
  DraftNotFoundError,
  type DraftService,
} from '@leadflow-ai/runtime';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createErrorResponse, type RequestIdFactory } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

const DraftParametersSchema = z.object({ draftId: z.string().uuid() }).strict();

export type DraftRouteDependencies = Pick<DraftService, 'revise' | 'review'>;

function safeError(
  code: SafeError['code'],
  category: SafeError['category'],
  retryable: boolean,
  message: string,
): SafeError {
  return { code, category, retryable, message };
}

function mapDraftFailure(
  cause: unknown,
  reply: FastifyReply,
  requestId: string,
) {
  if (cause instanceof DraftNotFoundError) {
    return reply
      .code(404)
      .send(
        createErrorResponse(
          safeError(
            'draft_not_found',
            'validation',
            false,
            'The requested draft does not exist.',
          ),
          () => requestId,
        ),
      );
  }
  if (cause instanceof DraftConflictError) {
    return reply
      .code(409)
      .send(
        createErrorResponse(
          safeError(
            'draft_conflict',
            'conflict',
            false,
            'The draft changed or is not reviewable.',
          ),
          () => requestId,
        ),
      );
  }
  if (cause instanceof DraftIntegrityError) {
    return reply
      .code(503)
      .send(
        createErrorResponse(
          safeError(
            'invariant_failed',
            'runtime',
            false,
            'Stored draft history failed integrity checks.',
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
          'The draft action could not be stored.',
        ),
        () => requestId,
      ),
    );
}

export function registerDraftRoutes(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  dependencies: DraftRouteDependencies | undefined,
  requestIdFactory: RequestIdFactory = randomUUID,
): void {
  const unavailable = (requestId: string) =>
    createErrorResponse(
      safeError(
        'storage_unavailable',
        'storage',
        true,
        'Local draft actions are unavailable.',
      ),
      () => requestId,
    );

  app.post(
    '/v1/drafts/:draftId/revisions',
    {
      schema: {
        params: DraftParametersSchema,
        body: DraftRevisionRequestSchema,
        response: {
          200: DraftActionResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const requestId = requestIdFactory();
      if (phaseOne.status !== 'ready' || dependencies === undefined) {
        return reply.code(503).send(unavailable(requestId));
      }
      const { draftId } = DraftParametersSchema.parse(request.params);
      const body = DraftRevisionRequestSchema.parse(request.body);
      try {
        const draft = await dependencies.revise({
          draftId,
          ...body,
          traceId: requestIdFactory(),
          requestId,
        });
        const runId = draft.revisions.at(-1)?.revision.runId;
        if (runId === undefined) throw new DraftIntegrityError();
        return DraftActionResponseSchema.parse({
          schemaVersion: 'draft-action-response-v1',
          runId,
          draft,
        });
      } catch (cause) {
        return mapDraftFailure(cause, reply, requestId);
      }
    },
  );

  app.post(
    '/v1/drafts/:draftId/reviews',
    {
      schema: {
        params: DraftParametersSchema,
        body: DraftReviewRequestSchema,
        response: {
          200: DraftActionResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const requestId = requestIdFactory();
      if (phaseOne.status !== 'ready' || dependencies === undefined) {
        return reply.code(503).send(unavailable(requestId));
      }
      const { draftId } = DraftParametersSchema.parse(request.params);
      const body = DraftReviewRequestSchema.parse(request.body);
      try {
        const draft = await dependencies.review({
          draftId,
          ...body,
          traceId: requestIdFactory(),
          requestId,
        });
        const runId = draft.revisions.at(-1)?.revision.runId;
        if (runId === undefined) throw new DraftIntegrityError();
        return DraftActionResponseSchema.parse({
          schemaVersion: 'draft-action-response-v1',
          runId,
          draft,
        });
      } catch (cause) {
        return mapDraftFailure(cause, reply, requestId);
      }
    },
  );
}
