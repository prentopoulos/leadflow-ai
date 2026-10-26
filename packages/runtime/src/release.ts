import { createHash } from 'node:crypto';
import {
  CLOUD_CONFIGURATION_VERSION,
  DEPLOYMENT_EVIDENCE_VERSION,
  GoogleCloudProjectIdSchema,
  HOSTED_TARGET,
  IAP_POLICY_VERSION,
  RETENTION_POLICY_VERSION,
  SystemBundleDocumentSchema,
  CloudRunRevisionSchema,
  ImageDigestSchema,
  type DeploymentIdentity,
  type SystemBundleDocument,
} from '@leadflow-ai/domain';
import { z } from 'zod';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function uuidFromDigest(digest: string): string {
  const characters = digest.slice(0, 32).split('');
  characters[12] = '4';
  characters[16] = (
    (Number.parseInt(characters[16] ?? '0', 16) & 0x3) |
    0x8
  ).toString(16);
  const value = characters.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

// Every system-bundle field except the three bound at run time: the derived
// identifier, the record time and the deployment that serves the code.
export type SystemBundleBase = Omit<
  SystemBundleDocument,
  'systemBundleId' | 'createdAt' | 'deployment'
>;

export const LOCAL_DEPLOYMENT: DeploymentIdentity = {
  mode: 'local',
  projectId: 'demo-leadflow-ai-local',
  reason: 'local emulator; no hosted deployment',
};

// A bundle's identifier is a digest of everything that can change its
// results, now including the deployment (image digest, revision, policies).
export function bindSystemBundle(
  base: SystemBundleBase,
  deployment: DeploymentIdentity,
  createdAt: string = new Date().toISOString(),
): SystemBundleDocument {
  const identityDigest = sha256(
    JSON.stringify({
      codeRevision: base.code.revision,
      dirty: base.code.dirty,
      currentSourceDigest: base.code.sourceDigest,
      currentPatchDigest: base.code.patchDigest,
      lockfileDigest: base.lockfileDigest,
      fixtureDigest: base.fixtures.digest,
      evaluator: base.versions.evaluator,
      enrichmentMode: base.enrichmentMode,
      configuration: base.versions.configuration,
      deployment,
    }),
  );
  return SystemBundleDocumentSchema.parse({
    ...base,
    systemBundleId: uuidFromDigest(identityDigest),
    createdAt,
    deployment,
  });
}

// The build stage writes this manifest into the image; the hosted process
// binds it to the revision that serves it.
export const ReleaseManifestSchema = z
  .object({
    schemaVersion: z.literal('release-manifest-v1'),
    base: z
      .record(z.string(), z.unknown())
      .refine(
        (value) =>
          !('systemBundleId' in value) &&
          !('createdAt' in value) &&
          !('deployment' in value),
        { message: 'a release manifest carries no deployment binding' },
      ),
  })
  .strict();
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;

export interface HostedDeploymentInput {
  projectId: string;
  revision: string | undefined;
  imageDigest: string | undefined;
}

export function cloudDeploymentIdentity(
  input: HostedDeploymentInput,
): DeploymentIdentity {
  return {
    mode: 'cloud',
    projectDigest: sha256(GoogleCloudProjectIdSchema.parse(input.projectId)),
    service: HOSTED_TARGET.service,
    region: HOSTED_TARGET.region,
    revision: CloudRunRevisionSchema.parse(input.revision),
    imageDigest: ImageDigestSchema.parse(input.imageDigest),
    iapPolicy: IAP_POLICY_VERSION,
    firestore: {
      ...HOSTED_TARGET.firestore,
      retentionPolicy: RETENTION_POLICY_VERSION,
    },
    evidenceIndex: DEPLOYMENT_EVIDENCE_VERSION,
  };
}

export function bindHostedSystemBundle(
  manifest: unknown,
  input: HostedDeploymentInput,
  createdAt?: string,
): SystemBundleDocument {
  const parsed = ReleaseManifestSchema.parse(manifest);
  const bundle = bindSystemBundle(
    parsed.base as unknown as SystemBundleBase,
    cloudDeploymentIdentity(input),
    createdAt,
  );
  if (bundle.versions.configuration !== CLOUD_CONFIGURATION_VERSION) {
    throw new Error('The release manifest is not a hosted build.');
  }
  return bundle;
}

export function projectDigest(projectId: string): string {
  return sha256(projectId);
}
