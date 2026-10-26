import {
  ErrorResponseSchema,
  LocalResetRequestSchema,
  LocalResetResponseSchema,
  type SafeError,
} from '@leadflow-ai/domain';
import {
  LocalResetDeniedError,
  resetLocalEmulatorData,
  type LocalResetRequest,
  type LocalResetResult,
} from '@leadflow-ai/runtime';
import type { FastifyInstance } from 'fastify';
import { createErrorResponse, type RequestIdFactory } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

export interface ResetRouteDependencies {
  reset(request: LocalResetRequest): Promise<LocalResetResult>;
}

function error(
  code: SafeError['code'],
  category: SafeError['category'],
  retryable: boolean,
  message: string,
): SafeError {
  return { code, category, retryable, message };
}

export function registerResetRoute(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  requestIdFactory: RequestIdFactory,
  dependencies?: ResetRouteDependencies,
): void {
  if (
    phaseOne.status !== 'ready' ||
    phaseOne.configuration.mode !== 'local' ||
    !phaseOne.configuration.localResetEnabled
  ) {
    return;
  }
  const configuration = phaseOne.configuration;

  app.delete(
    '/v1/local-data',
    {
      schema: {
        body: LocalResetRequestSchema,
        response: {
          200: LocalResetResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = LocalResetRequestSchema.parse(request.body);
      try {
        const result = await (dependencies?.reset ?? resetLocalEmulatorData)({
          enabled: configuration.localResetEnabled,
          remoteAddress: request.ip,
          projectId: body.projectId,
          firestoreHost: configuration.firestoreHost,
          confirmation: body.confirmation,
        });
        return LocalResetResponseSchema.parse({
          schemaVersion: 'local-reset-response-v1',
          ...result,
        });
      } catch (cause) {
        if (cause instanceof LocalResetDeniedError) {
          return reply
            .code(403)
            .send(
              createErrorResponse(
                error(
                  'reset_denied',
                  'conflict',
                  false,
                  'Local synthetic-data reset was denied.',
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
                'The local emulator reset could not be confirmed.',
              ),
              requestIdFactory,
            ),
          );
      }
    },
  );
}
