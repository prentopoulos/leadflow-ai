import { randomUUID } from 'node:crypto';
import {
  createHealthResponse,
  HealthResponseSchema,
} from '@leadflow-ai/domain';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  type ZodTypeProvider,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { PHASE_ONE_UNAVAILABLE, type PhaseOneStartup } from './startup.js';
import {
  createErrorResponse,
  registerIntakeRoute,
  type IntakeRouteDependencies,
  type RequestIdFactory,
} from './intake-route.js';
import { registerRunRoute, type RunRouteDependencies } from './run-route.js';
import {
  registerResumeRoute,
  type ResumeRouteDependencies,
} from './resume-route.js';
import {
  registerResetRoute,
  type ResetRouteDependencies,
} from './reset-route.js';
import {
  registerOperationsRoutes,
  type OperationsRouteDependencies,
} from './operations-route.js';
import {
  registerDraftRoutes,
  type DraftRouteDependencies,
} from './draft-route.js';

export interface CreateAppOptions {
  phaseOne?: PhaseOneStartup;
  intake?: IntakeRouteDependencies;
  runs?: RunRouteDependencies;
  resume?: ResumeRouteDependencies;
  reset?: ResetRouteDependencies;
  operations?: OperationsRouteDependencies;
  drafts?: DraftRouteDependencies;
  executor?: { idle(): Promise<void> };
  requestIdFactory?: RequestIdFactory;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  const phaseOne = options.phaseOne ?? PHASE_ONE_UNAVAILABLE;
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  if (phaseOne.status === 'ready') {
    app.addHook('onRequest', async (request, reply) => {
      const host = request.headers.host?.split(':', 1)[0]?.toLowerCase();
      const origin = request.headers.origin;
      const stateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(
        request.method,
      );
      if (
        host !== phaseOne.configuration.apiHost ||
        (stateChanging &&
          origin !== undefined &&
          origin !== phaseOne.configuration.webOrigin)
      ) {
        return reply.code(403).send(
          createErrorResponse(
            {
              code: 'access_denied',
              category: 'validation',
              retryable: false,
              message: 'Request host or origin is not allowed.',
            },
            options.requestIdFactory,
          ),
        );
      }
    });
  }
  app.setErrorHandler((error, _request, reply) => {
    const validation =
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      error.validation !== undefined;
    // Fastify's own client errors (malformed JSON, unsupported media type,
    // oversized body) carry a 4xx statusCode and stay client errors.
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    const clientError = validation || (statusCode >= 400 && statusCode < 500);
    const response = createErrorResponse(
      clientError
        ? {
            code: 'validation_failed',
            category: 'validation',
            retryable: false,
            message: 'Request validation failed.',
          }
        : {
            code: 'unknown_failure',
            category: 'runtime',
            retryable: false,
            message: 'The request could not be completed.',
          },
      options.requestIdFactory,
    );
    return reply
      .code(validation ? 400 : clientError ? statusCode : 500)
      .send(response);
  });

  if (phaseOne.status === 'ready') {
    app.addHook('onClose', async () => {
      await options.executor?.idle();
      await phaseOne.firestore.close();
    });
  }

  app.get(
    '/health',
    {
      schema: {
        response: { 200: HealthResponseSchema },
      },
    },
    async () => createHealthResponse(),
  );

  registerIntakeRoute(app, phaseOne, options.intake, options.requestIdFactory);
  registerRunRoute(app, phaseOne, options.runs, options.requestIdFactory);
  registerOperationsRoutes(
    app,
    phaseOne,
    options.operations,
    options.requestIdFactory,
  );
  registerDraftRoutes(
    app,
    phaseOne,
    options.drafts,
    options.requestIdFactory ?? randomUUID,
  );
  registerResumeRoute(
    app,
    phaseOne,
    options.resume,
    options.requestIdFactory ?? randomUUID,
  );
  registerResetRoute(
    app,
    phaseOne,
    options.requestIdFactory ?? randomUUID,
    options.reset,
  );

  return app;
}
