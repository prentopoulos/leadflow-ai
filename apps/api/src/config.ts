import { z } from 'zod';
import {
  CLOUD_CONFIGURATION_VERSION,
  EnrichmentModeSchema,
  GoogleCloudProjectIdSchema,
  HOSTED_TARGET,
  IapAudienceSchema,
  IapSubjectSchema,
  LEADFLOW_LOCAL_PROJECT_ID,
  LOCAL_CONFIGURATION_VERSION,
  RETENTION_POLICY_VERSION,
} from '@leadflow-ai/domain';
import { LEADFLOW_FIRESTORE_EMULATOR_HOST } from '@leadflow-ai/runtime';

// Exactly one runtime mode is selected at startup. Local is the default so
// the credential-free gate can never select hosted state by omission.
const RuntimeModeEnvironmentSchema = z
  .enum(['local', 'cloud'])
  .default('local');

const LocalServerConfigSchema = z.object({
  host: z.literal('127.0.0.1').default('127.0.0.1'),
  port: z.coerce.number().int().min(0).max(65_535).default(3001),
});

// Cloud Run supplies PORT; the container listens on every interface because
// Cloud Run's front end, not the container, is the network boundary.
const CloudServerConfigSchema = z.object({
  host: z.literal('0.0.0.0'),
  port: z.coerce.number().int().min(1).max(65_535),
});

export type ServerConfig = z.infer<typeof LocalServerConfigSchema>;

const LocalConfigSchema = z
  .object({
    mode: z.literal('local'),
    configurationVersion: z.literal(LOCAL_CONFIGURATION_VERSION),
    projectId: z.literal(LEADFLOW_LOCAL_PROJECT_ID),
    firestoreHost: z.literal(LEADFLOW_FIRESTORE_EMULATOR_HOST),
    // Hostname only: the listener port may be selected dynamically in local
    // probes, while DNS-rebinding protection still requires an exact host.
    apiHost: z.enum(['127.0.0.1', 'localhost']).default('127.0.0.1'),
    localResetEnabled: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // Required with no default: the evidence class of every lookup must be
    // an explicit operator choice (live, recorded or mock).
    enrichmentMode: EnrichmentModeSchema,
    // Opt-in Phase 5 agent team; off unless the launch script enables it.
    agents: z.enum(['off', 'claude']).default('off'),
    // The only browser origin allowed to send state-changing requests.
    webOrigin: z
      .string()
      .regex(/^http:\/\/(?:127\.0\.0\.1|localhost):\d{2,5}$/u)
      .default('http://127.0.0.1:5173'),
  })
  .strict();

const AllowedSubjectsSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((subject) => subject.trim())
      .filter(Boolean),
  )
  .pipe(z.array(IapSubjectSchema).min(1).max(4));

const CloudConfigSchema = z
  .object({
    mode: z.literal('cloud'),
    configurationVersion: z.literal(CLOUD_CONFIGURATION_VERSION),
    projectId: GoogleCloudProjectIdSchema,
    databaseId: z.literal(HOSTED_TARGET.firestore.database),
    firestoreLocation: z.literal(HOSTED_TARGET.firestore.location),
    retentionPolicy: z.literal(RETENTION_POLICY_VERSION),
    // Deployed demonstrations use recorded enrichment only.
    enrichmentMode: z.literal('recorded'),
    localResetEnabled: z.literal(false),
    iapAudience: IapAudienceSchema,
    allowedSubjects: AllowedSubjectsSchema,
    service: z.literal(HOSTED_TARGET.service),
    revision: z.string().min(1),
    imageDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  })
  .strict();

export type LocalConfig = z.infer<typeof LocalConfigSchema>;
export type CloudConfig = z.infer<typeof CloudConfigSchema>;
export type PhaseOneConfig = LocalConfig | CloudConfig;

export function loadRuntimeMode(
  environment: NodeJS.ProcessEnv = process.env,
): 'local' | 'cloud' {
  return RuntimeModeEnvironmentSchema.parse(environment.LEADFLOW_RUNTIME_MODE);
}

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig | z.infer<typeof CloudServerConfigSchema> {
  if (loadRuntimeMode(environment) === 'cloud') {
    return CloudServerConfigSchema.parse({
      host: '0.0.0.0',
      port: environment.PORT,
    });
  }
  return LocalServerConfigSchema.parse({
    host: environment.HOST,
    port: environment.PORT,
  });
}

export function loadPhaseOneConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PhaseOneConfig {
  if (loadRuntimeMode(environment) === 'cloud') {
    // Mixing modes is refused rather than resolved: an emulator host or a
    // reset flag in a hosted environment indicates the wrong configuration.
    if (
      environment.FIRESTORE_EMULATOR_HOST !== undefined ||
      environment.LEADFLOW_LOCAL_RESET_ENABLED !== undefined ||
      environment.GOOGLE_APPLICATION_CREDENTIALS !== undefined ||
      // Hosted stays template-only (PROJECT.md, Phase 5 decisions).
      environment.LEADFLOW_AGENTS !== undefined
    ) {
      throw new Error('Hosted configuration contains local-only settings.');
    }
    return CloudConfigSchema.parse({
      mode: 'cloud',
      configurationVersion: CLOUD_CONFIGURATION_VERSION,
      projectId: environment.GOOGLE_CLOUD_PROJECT,
      databaseId: environment.LEADFLOW_FIRESTORE_DATABASE,
      firestoreLocation: environment.LEADFLOW_FIRESTORE_LOCATION,
      retentionPolicy: environment.LEADFLOW_RETENTION_POLICY,
      enrichmentMode: environment.LEADFLOW_ENRICHMENT_MODE,
      localResetEnabled: false,
      iapAudience: environment.LEADFLOW_IAP_AUDIENCE,
      allowedSubjects: environment.LEADFLOW_ALLOWED_SUBJECTS,
      service: environment.K_SERVICE,
      revision: environment.K_REVISION,
      imageDigest: environment.LEADFLOW_IMAGE_DIGEST,
    });
  }
  return LocalConfigSchema.parse({
    mode: 'local',
    configurationVersion: LOCAL_CONFIGURATION_VERSION,
    projectId: environment.GCLOUD_PROJECT,
    firestoreHost: environment.FIRESTORE_EMULATOR_HOST,
    apiHost: environment.LEADFLOW_API_HOST,
    localResetEnabled: environment.LEADFLOW_LOCAL_RESET_ENABLED,
    enrichmentMode: environment.LEADFLOW_ENRICHMENT_MODE,
    agents: environment.LEADFLOW_AGENTS,
    webOrigin: environment.LEADFLOW_WEB_ORIGIN,
  });
}
