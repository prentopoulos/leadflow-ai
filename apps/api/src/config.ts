import { z } from 'zod';
import { LEADFLOW_LOCAL_PROJECT_ID } from '@leadflow-ai/domain';
import { LEADFLOW_FIRESTORE_EMULATOR_HOST } from '@leadflow-ai/runtime';

const ServerConfigSchema = z.object({
  host: z.literal('127.0.0.1').default('127.0.0.1'),
  port: z.coerce.number().int().min(0).max(65_535).default(3001),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

const PhaseOneConfigSchema = z
  .object({
    configurationVersion: z.literal('phase-2-local-v1'),
    projectId: z.literal(LEADFLOW_LOCAL_PROJECT_ID),
    firestoreHost: z.literal(LEADFLOW_FIRESTORE_EMULATOR_HOST),
    localResetEnabled: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .strict();

export type PhaseOneConfig = z.infer<typeof PhaseOneConfigSchema>;

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  return ServerConfigSchema.parse({
    host: environment.HOST,
    port: environment.PORT,
  });
}

export function loadPhaseOneConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PhaseOneConfig {
  return PhaseOneConfigSchema.parse({
    configurationVersion: 'phase-2-local-v1',
    projectId: environment.GCLOUD_PROJECT,
    firestoreHost: environment.FIRESTORE_EMULATOR_HOST,
    localResetEnabled: environment.LEADFLOW_LOCAL_RESET_ENABLED,
  });
}
