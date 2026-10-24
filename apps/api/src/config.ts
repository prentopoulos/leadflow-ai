import { z } from 'zod';

const ServerConfigSchema = z.object({
  host: z.literal('127.0.0.1').default('127.0.0.1'),
  port: z.coerce.number().int().min(0).max(65_535).default(3001),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  return ServerConfigSchema.parse({
    host: environment.HOST,
    port: environment.PORT,
  });
}
