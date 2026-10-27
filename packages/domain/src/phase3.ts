import { z } from 'zod';

// Phase 3 contracts for the private hosted proof of concept. This module stays
// free of other domain imports so the Phase 1 bundle schema can depend on it.

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const LOCAL_CONFIGURATION_VERSION = 'phase-2-local-v1' as const;
export const CLOUD_CONFIGURATION_VERSION = 'phase-3-cloud-v1' as const;
export const IAP_POLICY_VERSION = 'iap-direct-v1' as const;
export const RETENTION_POLICY_VERSION = 'retention-7d-v1' as const;
export const DEPLOYMENT_EVIDENCE_VERSION = 'deployment-evidence-v1' as const;
export const RETENTION_DAYS = 7 as const;
export const RETENTION_FIELD = 'expiresAt' as const;

// Accepted, owner-decided hosted values (PROJECT.md Phase 3 decisions). They
// are public design names, not private deployment parameters.
export const HOSTED_TARGET = {
  service: 'leadflow-ai-demo',
  region: 'northamerica-northeast2',
  artifactRepository: 'leadflow-ai-demo',
  image: 'app',
  runtimeServiceAccount: 'leadflow-ai-runtime',
  iapDisplayName: 'LeadFlow AI Demo',
  firestore: {
    database: '(default)',
    location: 'northamerica-northeast2',
    edition: 'standard',
    mode: 'native',
  },
  limits: {
    cpu: '1',
    memory: '512Mi',
    minInstances: 0,
    maxInstances: 1,
    concurrency: 8,
    requestTimeoutSeconds: 60,
    billing: 'request-based',
  },
  // Hosted workflow work stops starting new steps after this budget so it can
  // persist a recoverable state before the 60-second platform deadline.
  executionDeadlineMs: 45_000,
  // Slightly longer than the platform deadline: an interrupted request's
  // ownership expires on its own and the run becomes reclaimable.
  executionLeaseMs: 75_000,
} as const;

export const IAP_ISSUER = 'https://cloud.google.com/iap' as const;
export const IAP_ASSERTION_HEADER = 'x-goog-iap-jwt-assertion' as const;

// Direct IAP on Cloud Run signs this audience:
// /projects/PROJECT_NUMBER/locations/REGION/services/SERVICE_NAME
export const IapAudienceSchema = z
  .string()
  .regex(
    /^\/projects\/\d{6,20}\/locations\/northamerica-northeast2\/services\/leadflow-ai-demo$/u,
  );

// IAP's stable `sub` for a Google identity, for example
// `accounts.google.com:<numeric id>`. Email and display values never authorize.
export const IapSubjectSchema = z
  .string()
  .regex(/^accounts\.google\.com:\d{6,32}$/u);

export const GoogleCloudProjectIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u)
  .refine((value) => !value.startsWith('demo-'), {
    message: 'hosted mode never targets an emulator demo project',
  });

export const RuntimeModeSchema = z.enum(['local', 'cloud']);
export type RuntimeMode = z.infer<typeof RuntimeModeSchema>;

export const ImageDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export const CloudRunRevisionSchema = z
  .string()
  .regex(/^leadflow-ai-demo-[a-z0-9-]{1,40}$/u);

export const LocalDeploymentSchema = z
  .object({
    mode: z.literal('local'),
    projectId: z.literal('demo-leadflow-ai-local'),
    reason: z.literal('local emulator; no hosted deployment'),
  })
  .strict();

export const CloudDeploymentSchema = z
  .object({
    mode: z.literal('cloud'),
    // The private project ID is bound by digest so the record carries no
    // account value.
    projectDigest: Sha256Schema,
    service: z.literal(HOSTED_TARGET.service),
    region: z.literal(HOSTED_TARGET.region),
    revision: CloudRunRevisionSchema,
    imageDigest: ImageDigestSchema,
    iapPolicy: z.literal(IAP_POLICY_VERSION),
    firestore: z
      .object({
        database: z.literal(HOSTED_TARGET.firestore.database),
        location: z.literal(HOSTED_TARGET.firestore.location),
        edition: z.literal(HOSTED_TARGET.firestore.edition),
        mode: z.literal(HOSTED_TARGET.firestore.mode),
        retentionPolicy: z.literal(RETENTION_POLICY_VERSION),
      })
      .strict(),
    evidenceIndex: z.literal(DEPLOYMENT_EVIDENCE_VERSION),
  })
  .strict();

export const DeploymentIdentitySchema = z.discriminatedUnion('mode', [
  LocalDeploymentSchema,
  CloudDeploymentSchema,
]);
export type DeploymentIdentity = z.infer<typeof DeploymentIdentitySchema>;

// Session state the browser reads before rendering. Hosted mode never returns
// the owner email, stable subject, audience or token.
export const SessionResponseSchema = z.discriminatedUnion('mode', [
  z
    .object({
      schemaVersion: z.literal('session-response-v1'),
      mode: z.literal('local'),
      operator: z.literal('local-operator'),
      authentication: z.literal('none-loopback'),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal('session-response-v1'),
      mode: z.literal('cloud'),
      operator: z.literal('private-owner'),
      authentication: z.literal('iap-verified'),
      enrichmentMode: z.literal('recorded'),
    })
    .strict(),
]);
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
