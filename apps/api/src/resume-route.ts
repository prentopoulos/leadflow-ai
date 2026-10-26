import {
  ErrorResponseSchema,
  ResumeResponseSchema,
  type ResumeResponse,
  type RunDetailResponse,
  type SafeError,
} from '@leadflow-ai/domain';
import {
  CheckpointIncompatibleError,
  CheckpointMissingError,
  RunLeaseConflictError,
  RunNotFoundError,
  RunRevisionConflictError,
  RunStateConflictError,
  type QualificationResumeService,
  type RunDetailService,
} from '@leadflow-ai/runtime';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createErrorResponse, type RequestIdFactory } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

const RunParametersSchema = z.object({ runId: z.string().uuid() }).strict();
const ResumeBodySchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict();
const RequestIdSchema = z.string().uuid();

export interface ResumeRouteDependencies {
  resume: Pick<QualificationResumeService, 'begin'>;
  details: Pick<RunDetailService, 'get'>;
  // Runs the committed continuation in the background executor.
  schedule: (runId: string, continuation: () => Promise<unknown>) => void;
}

function error(
  code: SafeError['code'],
  category: SafeError['category'],
  retryable: boolean,
  message: string,
): SafeError {
  return { code, category, retryable, message };
}

function responseFromDetail(
  detail: RunDetailResponse,
  replayed: boolean,
): ResumeResponse {
  return ResumeResponseSchema.parse({
    schemaVersion: 'resume-response-v1',
    runId: detail.run.runId,
    revision: detail.run.revision,
    status: detail.run.status,
    replayed,
  });
}

function provesResumeReplay(
  detail: RunDetailResponse,
  expectedRevision: number,
): boolean {
  return detail.events.some(
    (event) =>
      event.name === 'run.resume_requested' &&
      event.runRevision === expectedRevision + 1,
  );
}

export function registerResumeRoute(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  dependencies: ResumeRouteDependencies | undefined,
  requestIdFactory: RequestIdFactory,
): void {
  app.post(
    '/v1/runs/:runId/resume',
    {
      schema: {
        params: RunParametersSchema,
        body: ResumeBodySchema,
        response: {
          200: ResumeResponseSchema,
          202: ResumeResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
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
      const { expectedRevision } = ResumeBodySchema.parse(request.body);
      const requestId = RequestIdSchema.parse(requestIdFactory());
      const traceId = RequestIdSchema.parse(requestIdFactory());
      try {
        const started = await dependencies.resume.begin({
          runId,
          expectedRevision,
          ownerId: `api:${requestId}`,
          leaseDurationMs: 300_000,
          traceId,
          requestId,
          authorization: 'allowed',
        });
        // The resume request is durable; the workflow continues in the
        // background and its progress is read from stored run state.
        dependencies.schedule(runId, started.continuation);
        return reply.code(202).send(
          ResumeResponseSchema.parse({
            schemaVersion: 'resume-response-v1',
            runId,
            revision: started.run.revision,
            status: started.run.status,
            replayed: false,
          }),
        );
      } catch (cause) {
        if (cause instanceof RunRevisionConflictError) {
          try {
            const detail = await dependencies.details.get(runId);
            if (provesResumeReplay(detail, expectedRevision)) {
              return responseFromDetail(detail, true);
            }
          } catch {
            // The revision conflict remains authoritative when replay proof is unavailable.
          }
          return reply
            .code(409)
            .send(
              createErrorResponse(
                error(
                  'revision_conflict',
                  'conflict',
                  false,
                  'The run revision changed before resume could commit.',
                ),
                () => requestId,
              ),
            );
        }
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
                () => requestId,
              ),
            );
        }
        const mapped =
          cause instanceof RunLeaseConflictError
            ? error(
                'lease_active',
                'conflict',
                true,
                'The run has an active execution lease.',
              )
            : cause instanceof RunStateConflictError
              ? error(
                  'run_ineligible',
                  'conflict',
                  false,
                  'The run is not eligible for resume.',
                )
              : cause instanceof CheckpointMissingError
                ? error(
                    'checkpoint_missing',
                    'runtime',
                    false,
                    'A durable checkpoint is required to resume this run.',
                  )
                : cause instanceof CheckpointIncompatibleError
                  ? error(
                      'checkpoint_incompatible',
                      'runtime',
                      false,
                      'The durable checkpoint is incompatible with this run.',
                    )
                  : error(
                      'storage_unavailable',
                      'storage',
                      true,
                      'The resume request could not be completed.',
                    );
        const status =
          cause instanceof RunLeaseConflictError ||
          cause instanceof RunStateConflictError ||
          cause instanceof CheckpointMissingError ||
          cause instanceof CheckpointIncompatibleError
            ? 409
            : 503;
        return reply
          .code(status)
          .send(createErrorResponse(mapped, () => requestId));
      }
    },
  );
}
