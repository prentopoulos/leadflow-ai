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

export interface CreateAppOptions {
  phaseOne?: PhaseOneStartup;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  const phaseOne = options.phaseOne ?? PHASE_ONE_UNAVAILABLE;
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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

  return app;
}
