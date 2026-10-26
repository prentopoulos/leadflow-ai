import { HOSTED_TARGET } from '@leadflow-ai/domain';
import { z } from 'zod';

// The sanitized Phase 3 deployment evidence index
// (docs/evidence/phase-3/index.json). It holds outcomes and immutable
// identifiers only; project, account, audience, subject, URL, token and
// billing values are excluded and the hygiene scan enforces that.

const Sha = z.string().regex(/^[a-f0-9]{40}$/u);
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/u);

export const EvidenceOutcomeSchema = z.enum([
  'pass',
  'fail',
  'not_run',
  'stale',
]);

export const DEPLOYED_CHECK_IDS = [
  'deployed-owner-access',
  'deployed-unauthenticated-denial',
  'deployed-assertion-negative',
  'deployed-allowlist-denial',
  'deployed-firestore-client-denial',
  'deployed-runtime-firestore-access',
  'deployed-persist-before-202',
  'deployed-request-bound-polling',
  'deployed-duplicate-execution',
  'deployed-resume-retry-conflict',
  'deployed-recorded-labels',
  'deployed-consent-and-no-send',
  'deployed-log-privacy',
  'deployed-configuration-match',
  'deployed-public-principal-absent',
  'deployed-cost-status',
  'deployed-rollback',
  'deployed-teardown',
] as const;

const CheckSchema = z
  .object({
    id: z.string().regex(/^(?:local|deployed)-[a-z0-9-]+$/u),
    scope: z.enum(['local', 'deployed']),
    probe: z.string().min(1).max(200),
    expected: z.string().min(1).max(400),
    outcome: EvidenceOutcomeSchema,
    recordedAt: z.iso.datetime().nullable(),
    observed: z.string().min(1).max(600).nullable(),
    reason: z.string().min(1).max(300).nullable(),
    // Delayed billing is pending with a reason, never zero.
    pending: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    const ran = value.outcome === 'pass' || value.outcome === 'fail';
    if (ran && (value.recordedAt === null || value.observed === null)) {
      context.addIssue({
        code: 'custom',
        message: 'a check that ran records its time and observation',
      });
    }
    if (!ran && value.reason === null) {
      context.addIssue({
        code: 'custom',
        message: 'a check that did not run or went stale says why',
      });
    }
    if (value.pending && value.outcome === 'pass') {
      context.addIssue({
        code: 'custom',
        message: 'pending evidence cannot pass',
      });
    }
  });

export const DeploymentEvidenceIndexSchema = z
  .object({
    schemaVersion: z.literal('deployment-evidence-v1'),
    phase: z.literal('phase-3'),
    candidate: z
      .object({
        sourceCommit: Sha.nullable(),
        lockfileDigest: Sha256.nullable(),
        systemBundleId: z.string().uuid().nullable(),
        buildId: z
          .string()
          .regex(/^[a-f0-9-]{36}$/u)
          .nullable(),
        imageDigest: z
          .string()
          .regex(/^sha256:[a-f0-9]{64}$/u)
          .nullable(),
        revision: z
          .string()
          .regex(/^leadflow-ai-demo-[a-z0-9-]{1,40}$/u)
          .nullable(),
        configuration: z.literal('phase-3-cloud-v1'),
        service: z.literal(HOSTED_TARGET.service),
        region: z.literal(HOSTED_TARGET.region),
        runtimeIdentity: z.literal(HOSTED_TARGET.runtimeServiceAccount),
        firestore: z
          .object({
            database: z.literal('(default)'),
            location: z.literal(HOSTED_TARGET.firestore.location),
            retentionPolicy: z.literal('retention-7d-v1'),
          })
          .strict(),
      })
      .strict(),
    checks: z.array(CheckSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.checks.map((check) => check.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'check IDs are unique' });
    }
    for (const required of DEPLOYED_CHECK_IDS) {
      if (!ids.includes(required)) {
        context.addIssue({
          code: 'custom',
          message: `missing deployed check ${required}`,
        });
      }
    }
    const deployedRan = value.checks.some(
      (check) =>
        check.scope === 'deployed' &&
        (check.outcome === 'pass' || check.outcome === 'fail'),
    );
    const { sourceCommit, imageDigest, revision, buildId } = value.candidate;
    if (
      deployedRan &&
      (sourceCommit === null ||
        imageDigest === null ||
        revision === null ||
        buildId === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'deployed results bind to the exact build, image and revision',
      });
    }
  });
export type DeploymentEvidenceIndex = z.infer<
  typeof DeploymentEvidenceIndexSchema
>;

// Readiness holds unless every required deployed check passed.
export function deploymentReady(index: DeploymentEvidenceIndex): boolean {
  return DEPLOYED_CHECK_IDS.every(
    (id) => index.checks.find((check) => check.id === id)?.outcome === 'pass',
  );
}
