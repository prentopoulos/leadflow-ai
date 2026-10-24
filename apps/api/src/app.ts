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

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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
