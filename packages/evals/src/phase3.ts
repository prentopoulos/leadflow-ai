// Phase 3 evaluation corpus additions (`phase-3.0`), fixed before any hosted
// measurement and retaining every earlier case ID. Runnable cases call the
// real runtime and domain boundaries with synthetic values; emulator cases
// are measured by `pnpm emulator:runtime`; every case that depends on actual
// IAP, Cloud Run, Firestore, IAM, billing, logging or rollback stays not_run
// and names the owner-authorized probe that can establish it.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_VERSIONS,
  HOSTED_TARGET,
  IapAudienceSchema,
  IapSubjectSchema,
} from '@leadflow-ai/domain';
import {
  HOSTED_PURGE_CONFIRMATION,
  HostedPurgeDeniedError,
  assertRetentionStamp,
  bindHostedSystemBundle,
  isRetentionTimestamp,
  purgeHostedData,
  registerRetentionPolicy,
  hostedRetentionPolicy,
  stampRetention,
  validateCloudFirestoreConfiguration,
  withoutRetention,
  type HostedPurgeRequest,
} from '@leadflow-ai/runtime';
import { DeploymentEvidenceIndexSchema, deploymentReady } from './evidence.js';
import { DATASET_VERSION, type EvalCase } from './schemas.js';

const repoRoot = path.resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);

function runnable(
  id: string,
  requirement: string,
  check: string,
  expected: Record<string, unknown>,
  cohort: EvalCase['cohort'] = 'adversarial',
): EvalCase {
  return {
    id,
    datasetVersion: DATASET_VERSION,
    cohort,
    evidenceClass: 'synthetic',
    applicability: 'runnable',
    evidenceScope: 'pure-synthetic',
    requirement,
    kind: 'phase3-contract',
    candidate: { check },
    expected,
  };
}

function emulator(
  id: string,
  requirement: string,
  observations: string[],
): EvalCase {
  return {
    id,
    datasetVersion: DATASET_VERSION,
    cohort: 'failure',
    evidenceClass: 'synthetic',
    applicability: 'runnable',
    evidenceScope: 'local-emulator',
    requirement,
    kind: 'phase3-contract',
    candidate: { check: 'declared', observations },
    expected: { observations: observations.length },
  };
}

function deployed(id: string, requirement: string, probe: string): EvalCase {
  return {
    id,
    datasetVersion: DATASET_VERSION,
    cohort: 'adversarial',
    evidenceClass: 'synthetic',
    applicability: 'future',
    evidenceScope: 'not-run',
    requirement: `${requirement} Measured only by the owner-authorized deployed probe (${probe}).`,
    kind: 'future-runtime',
    candidate: null,
    expected: { status: 'not_run' },
  };
}

const SYNTHETIC_PROJECT = 'synthetic-hosted-project';
const DAY_MS = 24 * 60 * 60 * 1000;

export const PHASE_THREE_CASES = [
  runnable(
    'p3-cloud-firestore-boundary',
    'Hosted Firestore accepts only ADC against a non-demo project and the default database, refusing emulator hosts and key files',
    'cloud-firestore-boundary',
    {
      accepted: true,
      refused: [
        'emulator-host',
        'key-file',
        'demo-project',
        'named-database',
        'malformed-project',
      ],
    },
  ),
  runnable(
    'p3-iap-claim-shapes',
    'Only stable IAP subjects and the exact Toronto service audience are accepted; email, display and other-service values are not',
    'iap-claim-shapes',
    {
      subjects: [true, false, false, false],
      audiences: [true, false, false],
    },
  ),
  runnable(
    'p3-ttl-timestamp-stamp',
    'Hosted writes carry a seven-day Firestore Timestamp expiry; text, null and numeric expiries are refused and reads remove only a Timestamp',
    'ttl-timestamp-stamp',
    {
      offsetDays: 7,
      timestamp: true,
      refused: [true, true, true],
      stripped: true,
      textKept: true,
    },
  ),
  runnable(
    'p3-purge-guard',
    'The hosted purge issues no delete without the authenticated owner, matching project/database, a non-demo target and the exact confirmation, and stops on unknown collections',
    'purge-guard',
    {
      denied: 5,
      deletesWhileDenied: 0,
      unknownStops: true,
      allowedDeletes: ['leads', 'runs'],
    },
  ),
  runnable(
    'p3-release-identity',
    'A hosted bundle binds the build manifest to an immutable digest and revision, changes identity with either, and refuses mutable tags or dirty builds',
    'release-identity',
    {
      revisionChangesId: true,
      digestChangesId: true,
      stableOnRestart: true,
      refused: ['mutable-tag', 'dirty-build', 'live-enrichment'],
      projectInRecord: false,
    },
  ),
  runnable(
    'p3-hosted-limits',
    'The accepted limits keep the workflow deadline inside the platform timeout and the lease beyond it',
    'hosted-limits',
    {
      deadlineBeforeTimeout: true,
      leaseBeyondTimeout: true,
      maxInstances: 1,
      concurrency: 8,
      region: 'northamerica-northeast2',
    },
    'normal',
  ),
  runnable(
    'p3-evidence-index',
    'The deployment evidence index is schema-valid, holds readiness while deployed checks have not run, refuses pending passes and unbound deployed results',
    'evidence-index',
    {
      valid: true,
      ready: false,
      pendingPassRefused: true,
      unboundResultRefused: true,
    },
  ),
  runnable(
    'p3-methodology-unchanged',
    'Phase 3 leaves the rubric, metric definitions, composer, verification rules and enrichment adapters at their Phase 2 versions',
    'methodology-unchanged',
    {
      rubric: 'rubric-v1',
      metricsDefinitions: 'metrics-definitions-v1',
      composer: 'deterministic-template-v1',
      verificationRules: 'verification-rules-v1',
      enrichmentAdapters: 'enrichment-adapters-v1',
    },
    'normal',
  ),
  emulator(
    'p3-hosted-execution-emulator',
    'Hosted intake starts no post-response work; one held request completes the run; duplicates conflict; a deadline leaves a leased non-complete run that lease reclaim completes',
    [
      'run stays persisted without an execution request',
      'held execution returns finished and complete',
      'duplicate execution raises a revision conflict',
      'one-millisecond deadline returns deadline with a 75-second lease',
      'expired-lease reclaim completes the run',
    ],
  ),
  emulator(
    'p3-hosted-retention-emulator',
    'Real emulator writes carry Timestamp expiries, strict reads strip only them, text expiries fail, unauthenticated clients are denied and the purge guard refuses the emulator',
    [
      'lead, run and events carry a seven-day Timestamp',
      'repository reads return the exact domain record',
      'text expiresAt is rejected on read',
      'unauthenticated GET and PATCH receive 403',
      'hosted purge refuses the emulator project',
    ],
  ),
  deployed(
    'p3-deployed-iap-access',
    'The owner reaches the service through IAP; unauthenticated, forged, expired and non-allowlisted requests are denied before state.',
    'runbook smoke 1-3',
  ),
  deployed(
    'p3-deployed-firestore-client-denial',
    'A browser cannot read or write Toronto Firestore directly.',
    'runbook smoke 4',
  ),
  deployed(
    'p3-deployed-request-bound-execution',
    'Persist-before-202, held execution, polling, duplicates and lease recovery behave as on the emulator.',
    'runbook smoke 5',
  ),
  deployed(
    'p3-deployed-log-privacy',
    'Platform logs carry no contact value, assertion, subject, cookie or IAM list.',
    'runbook smoke 7',
  ),
  deployed(
    'p3-deployed-cost-controls',
    'The Cloud Run cap and project alert budget are configured and spend is recorded or pending.',
    'runbook smoke 8',
  ),
  deployed(
    'p3-deployed-rollback',
    'Traffic returns to the verified previous revision and representative smoke passes there.',
    'runbook rollback',
  ),
  deployed(
    'p3-deployed-teardown',
    'The seven-day and 30-day teardown removes exactly the recorded resources.',
    'runbook teardown',
  ),
] satisfies EvalCase[];

function refusedBy(action: () => unknown): boolean {
  try {
    action();
    return false;
  } catch {
    return true;
  }
}

const releaseBase = {
  schemaVersion: 'system-bundle-v4',
  code: {
    revision: 'c'.repeat(40),
    dirty: false,
    sourceDigest: 'b'.repeat(64),
    patchDigest: null,
  },
  lockfileDigest: 'b'.repeat(64),
  fixtures: { version: DATASET_VERSION, digest: 'b'.repeat(64) },
  versions: {
    intake: CONTRACT_VERSIONS.intake,
    lead: CONTRACT_VERSIONS.lead,
    run: CONTRACT_VERSIONS.run,
    event: CONTRACT_VERSIONS.event,
    checkpoint: CONTRACT_VERSIONS.checkpoint,
    rubric: CONTRACT_VERSIONS.rubric,
    interpreter: 'deterministic-interpreter-v1',
    graph: CONTRACT_VERSIONS.graph,
    checkpointer: 'firestore-checkpointer-v1',
    simulator: CONTRACT_VERSIONS.simulator,
    enrichmentAdapters: CONTRACT_VERSIONS.enrichmentAdapters,
    composer: CONTRACT_VERSIONS.composer,
    verificationRules: CONTRACT_VERSIONS.verificationRules,
    decisionLanguage: CONTRACT_VERSIONS.decisionLanguage,
    metricsDefinitions: CONTRACT_VERSIONS.metricsDefinitions,
    channelRules: CONTRACT_VERSIONS.channelRules,
    evaluator: DATASET_VERSION,
    configuration: 'phase-3-cloud-v1',
  },
  environment: {
    node: '24.22.1',
    pnpm: '12.15.0',
    java: '21.0.12.1',
    firebaseCli: '15.34.1',
    firestoreEmulator: '1.22.0',
    structurizrCli: '2025.11.09',
    platform: 'linux',
    architecture: 'x64',
  },
  provider: { value: null, reason: 'provider gate unresolved' },
  model: { value: null, reason: 'model gate unresolved' },
  prompt: { value: null, reason: 'no model prompt' },
  enrichmentMode: 'recorded',
  liveToolContracts: {
    hosts: ['vpic.nhtsa.dot.gov', 'api.zippopotam.us'],
    authorization:
      'owner-authorized read-only GET, 2026-10-25 (PROJECT.md Phase 2 decisions)',
  },
};
const hostedInput = {
  projectId: SYNTHETIC_PROJECT,
  revision: 'leadflow-ai-demo-00001-eval',
  imageDigest: `sha256:${'a'.repeat(64)}`,
};
const manifest = (base: Record<string, unknown> = releaseBase) => ({
  schemaVersion: 'release-manifest-v1',
  base,
});

export async function observePhaseThree(check: string): Promise<unknown> {
  switch (check) {
    case 'cloud-firestore-boundary': {
      const valid = { projectId: SYNTHETIC_PROJECT, databaseId: '(default)' };
      const cases: [string, () => unknown][] = [
        [
          'emulator-host',
          () =>
            validateCloudFirestoreConfiguration(valid, {
              FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
            }),
        ],
        [
          'key-file',
          () =>
            validateCloudFirestoreConfiguration(valid, {
              GOOGLE_APPLICATION_CREDENTIALS: '/tmp/key.json',
            }),
        ],
        [
          'demo-project',
          () =>
            validateCloudFirestoreConfiguration(
              { ...valid, projectId: 'demo-leadflow-ai-local' },
              {},
            ),
        ],
        [
          'named-database',
          () =>
            validateCloudFirestoreConfiguration(
              { ...valid, databaseId: 'leadflow' },
              {},
            ),
        ],
        [
          'malformed-project',
          () =>
            validateCloudFirestoreConfiguration(
              { ...valid, projectId: 'Bad_Project' },
              {},
            ),
        ],
      ];
      return {
        accepted: !refusedBy(() =>
          validateCloudFirestoreConfiguration(valid, {}),
        ),
        refused: cases
          .filter(([, action]) => refusedBy(action))
          .map(([label]) => label),
      };
    }
    case 'iap-claim-shapes':
      return {
        subjects: [
          'accounts.google.com:100000000000000000001',
          'owner@example.com',
          'accounts.google.com:owner@example.com',
          'Owner Name',
        ].map((value) => IapSubjectSchema.safeParse(value).success),
        audiences: [
          '/projects/123456789012/locations/northamerica-northeast2/services/leadflow-ai-demo',
          '/projects/123456789012/locations/us-central1/services/leadflow-ai-demo',
          '/projects/123456789012/apps/leadflow-ai-demo',
        ].map((value) => IapAudienceSchema.safeParse(value).success),
      };
    case 'ttl-timestamp-stamp': {
      const database = {} as never;
      registerRetentionPolicy(
        database,
        hostedRetentionPolicy(() => 0),
      );
      const stamped = stampRetention(database, { value: 1 });
      const expiry = stamped.expiresAt as { toMillis(): number };
      return {
        offsetDays: expiry.toMillis() / DAY_MS,
        timestamp: isRetentionTimestamp(stamped.expiresAt),
        refused: ['2026-11-02T00:00:00.000Z', null, 1_765_000_000_000].map(
          (value) =>
            refusedBy(() => assertRetentionStamp({ expiresAt: value })),
        ),
        stripped: !('expiresAt' in (withoutRetention(stamped) as object)),
        textKept:
          'expiresAt' in
          (withoutRetention({ value: 1, expiresAt: 'text' }) as object),
      };
    }
    case 'purge-guard': {
      const allowed: HostedPurgeRequest = {
        configured: { projectId: SYNTHETIC_PROJECT, databaseId: '(default)' },
        requested: { projectId: SYNTHETIC_PROJECT, databaseId: '(default)' },
        confirmation: HOSTED_PURGE_CONFIRMATION,
        operator: {
          requiredAccount: 'owner@example.com',
          authenticatedAccount: 'owner@example.com',
        },
      };
      const deleted: string[] = [];
      const database = (ids: string[]) => ({
        target: { projectId: SYNTHETIC_PROJECT, databaseId: '(default)' },
        listCollections: async () => ids.map((id) => ({ id })),
        recursiveDelete: async ({ id }: { id: string }) => {
          deleted.push(id);
        },
      });
      const denials: Partial<HostedPurgeRequest>[] = [
        {
          operator: {
            requiredAccount: 'owner@example.com',
            authenticatedAccount: null,
          },
        },
        {
          requested: { projectId: 'other-project-x', databaseId: '(default)' },
        },
        {
          configured: { projectId: SYNTHETIC_PROJECT, databaseId: 'other' },
          requested: { projectId: SYNTHETIC_PROJECT, databaseId: 'other' },
        },
        {
          configured: {
            projectId: 'demo-leadflow-ai-local',
            databaseId: '(default)',
          },
          requested: {
            projectId: 'demo-leadflow-ai-local',
            databaseId: '(default)',
          },
        },
        { confirmation: 'yes' },
      ];
      let denied = 0;
      for (const change of denials) {
        try {
          await purgeHostedData(database(['leads']), { ...allowed, ...change });
        } catch (error) {
          if (error instanceof HostedPurgeDeniedError) denied += 1;
        }
      }
      const deletesWhileDenied = deleted.length;
      const unknown = await purgeHostedData(
        database(['leads', 'billingExports']),
        allowed,
      );
      const unknownStops =
        unknown.deletedCollections.length === 0 && deleted.length === 0;
      const permitted = await purgeHostedData(
        database(['runs', 'leads']),
        allowed,
      );
      return {
        denied,
        deletesWhileDenied,
        unknownStops,
        allowedDeletes: permitted.deletedCollections,
      };
    }
    case 'release-identity': {
      const first = bindHostedSystemBundle(manifest(), hostedInput);
      const revision = bindHostedSystemBundle(manifest(), {
        ...hostedInput,
        revision: 'leadflow-ai-demo-00002-eval',
      });
      const digest = bindHostedSystemBundle(manifest(), {
        ...hostedInput,
        imageDigest: `sha256:${'d'.repeat(64)}`,
      });
      const refused: string[] = [];
      if (
        refusedBy(() =>
          bindHostedSystemBundle(manifest(), {
            ...hostedInput,
            imageDigest: 'leadflow-ai-demo:latest',
          }),
        )
      ) {
        refused.push('mutable-tag');
      }
      if (
        refusedBy(() =>
          bindHostedSystemBundle(
            manifest({
              ...releaseBase,
              code: { ...releaseBase.code, dirty: true },
            }),
            hostedInput,
          ),
        )
      ) {
        refused.push('dirty-build');
      }
      if (
        refusedBy(() =>
          bindHostedSystemBundle(
            manifest({ ...releaseBase, enrichmentMode: 'live' }),
            hostedInput,
          ),
        )
      ) {
        refused.push('live-enrichment');
      }
      return {
        revisionChangesId: revision.systemBundleId !== first.systemBundleId,
        digestChangesId: digest.systemBundleId !== first.systemBundleId,
        stableOnRestart:
          bindHostedSystemBundle(manifest(), hostedInput).systemBundleId ===
          first.systemBundleId,
        refused,
        projectInRecord: JSON.stringify(first).includes(SYNTHETIC_PROJECT),
      };
    }
    case 'hosted-limits': {
      const timeoutMs = HOSTED_TARGET.limits.requestTimeoutSeconds * 1000;
      return {
        deadlineBeforeTimeout: HOSTED_TARGET.executionDeadlineMs < timeoutMs,
        leaseBeyondTimeout: HOSTED_TARGET.executionLeaseMs > timeoutMs,
        maxInstances: HOSTED_TARGET.limits.maxInstances,
        concurrency: HOSTED_TARGET.limits.concurrency,
        region: HOSTED_TARGET.region,
      };
    }
    case 'evidence-index': {
      const index = DeploymentEvidenceIndexSchema.parse(
        JSON.parse(
          await readFile(
            path.join(repoRoot, 'docs', 'evidence', 'phase-3', 'index.json'),
            'utf8',
          ),
        ),
      );
      const [first] = index.checks;
      // An explicitly unbound pass: it must be refused whether or not the
      // recorded index already holds real, bound results.
      const passed = {
        ...first,
        outcome: 'pass',
        recordedAt: '2026-10-26T00:00:00.000Z',
        observed: 'synthetic observation',
        reason: null,
        candidateFingerprint: null,
      };
      return {
        valid: true,
        ready: deploymentReady(index),
        pendingPassRefused: !DeploymentEvidenceIndexSchema.safeParse({
          ...index,
          checks: [{ ...passed, pending: true }, ...index.checks.slice(1)],
        }).success,
        unboundResultRefused: !DeploymentEvidenceIndexSchema.safeParse({
          ...index,
          checks: [passed, ...index.checks.slice(1)],
        }).success,
      };
    }
    case 'methodology-unchanged':
      return {
        rubric: CONTRACT_VERSIONS.rubric,
        metricsDefinitions: CONTRACT_VERSIONS.metricsDefinitions,
        composer: CONTRACT_VERSIONS.composer,
        verificationRules: CONTRACT_VERSIONS.verificationRules,
        enrichmentAdapters: CONTRACT_VERSIONS.enrichmentAdapters,
      };
    default:
      throw new Error(`Unknown Phase 3 check: ${check}`);
  }
}
