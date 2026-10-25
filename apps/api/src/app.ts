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

export interface CreateAppOptions {
  phaseOne?: PhaseOneStartup;
  intake?: IntakeRouteDependencies;
  runs?: RunRouteDependencies;
  requestIdFactory?: RequestIdFactory;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  const phaseOne = options.phaseOne ?? PHASE_ONE_UNAVAILABLE;
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler((error, _request, reply) => {
    const validation =
      typeof error === 'object' &&
      error !== null &&
      'validation' in error &&
      error.validation !== undefined;
    const response = createErrorResponse(
      validation
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
    return reply.code(validation ? 400 : 500).send(response);
  });

  if (phaseOne.status === 'ready') {
    app.addHook('onClose', async () => phaseOne.firestore.close());
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

  return app;
}
