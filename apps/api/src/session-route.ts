import {
  ErrorResponseSchema,
  SessionResponseSchema,
  type SessionResponse,
} from '@leadflow-ai/domain';
import type { FastifyInstance } from 'fastify';
import { createErrorResponse, type RequestIdFactory } from './intake-route.js';
import type { PhaseOneStartup } from './startup.js';

// The browser reads its access mode here before rendering. In hosted mode the
// route is reachable only after the IAP hook accepted the request, and it
// reports authenticated private access without any identity value.
export function registerSessionRoute(
  app: FastifyInstance,
  phaseOne: PhaseOneStartup,
  requestIdFactory: RequestIdFactory,
): void {
  app.get(
    '/v1/session',
    {
      schema: {
        response: {
          200: SessionResponseSchema,
          401: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (phaseOne.status !== 'ready') {
        return reply.code(503).send(
          createErrorResponse(
            {
              code: 'storage_unavailable',
              category: 'storage',
              retryable: true,
              message: 'The stateful runtime is unavailable.',
            },
            requestIdFactory,
          ),
        );
      }
      if (
        phaseOne.configuration.mode === 'cloud' &&
        request.operator?.authenticated !== true
      ) {
        // Unreachable behind the IAP hook; refuse rather than report local.
        return reply.code(401).send(
          createErrorResponse(
            {
              code: 'authentication_required',
              category: 'access',
              retryable: true,
              message: 'Sign in again to continue.',
            },
            requestIdFactory,
          ),
        );
      }
      const session: SessionResponse =
        phaseOne.configuration.mode === 'cloud'
          ? {
              schemaVersion: 'session-response-v1',
              mode: 'cloud',
              operator: 'private-owner',
              authentication: 'iap-verified',
              enrichmentMode: 'recorded',
            }
          : {
              schemaVersion: 'session-response-v1',
              mode: 'local',
              operator: 'local-operator',
              authentication: 'none-loopback',
            };
      return session;
    },
  );
}
