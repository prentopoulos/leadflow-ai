import { z } from 'zod';
import { SystemBundleDocumentSchema } from '@leadflow-ai/domain';

export const DATASET_VERSION = 'phase-1.0' as const;
export const EVALUATOR_VERSION = 'phase-1.0' as const;
export const CONFIGURATION_VERSION = 'phase-1-local-v1' as const;

export const EvidenceScopeSchema = z.enum([
  'pure-synthetic',
  'local-emulator',
  'rendered-local',
  'not-run',
]);

export const CaseKindSchema = z.enum([
  'score-valid',
  'score-invalid',
  'schema-invalid',
  'consent-contract',
  'injection-contract',
  'enrichment-contract',
  'run-state-contract',
  'event-sequence-contract',
  'evidence-label-contract',
  'future-runtime',
  'phase1-intake-contract',
  'phase1-persistence-contract',
  'phase1-rubric-contract',
  'phase1-recovery-contract',
  'phase1-simulator-contract',
  'phase1-privacy-contract',
  'phase1-reset-contract',
  'phase1-ui-contract',
  'bundle-freshness-contract',
]);

export const EvalCaseSchema = z
  .object({
    id: z.string().regex(/^p[01]-[a-z0-9-]+$/u),
    datasetVersion: z.literal(DATASET_VERSION),
    cohort: z.enum(['normal', 'edge', 'adversarial', 'failure']),
    evidenceClass: z.literal('synthetic'),
    applicability: z.enum(['runnable', 'future']),
    evidenceScope: EvidenceScopeSchema.optional(),
    requirement: z.string().min(1),
    kind: CaseKindSchema,
    candidate: z.unknown(),
    expected: z.record(z.string(), z.unknown()),
  })
  .strict();
export type EvalCase = z.infer<typeof EvalCaseSchema>;

export const EvalResultSchema = z
  .object({
    caseId: z.string(),
    status: z.enum(['pass', 'fail', 'not_run', 'stale']),
    evidenceClass: z.literal('synthetic-local'),
    evidenceScope: EvidenceScopeSchema,
    datasetVersion: z.literal(DATASET_VERSION),
    evaluatorVersion: z.literal(EVALUATOR_VERSION),
    assertions: z.array(z.string()),
    reason: z.string().nullable(),
  })
  .strict();
export type EvalResult = z.infer<typeof EvalResultSchema>;

export const SystemBundleSchema = SystemBundleDocumentSchema;
export type SystemBundle = z.infer<typeof SystemBundleSchema>;

export const EvalReportSchema = z
  .object({
    label: z.literal('synthetic-local'),
    generatedAt: z.iso.datetime(),
    bundle: SystemBundleSchema,
    summary: z
      .object({
        total: z.number().int().nonnegative(),
        passed: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        notRun: z.number().int().nonnegative(),
        stale: z.number().int().nonnegative(),
        byScope: z.record(EvidenceScopeSchema, z.number().int().nonnegative()),
      })
      .strict(),
    results: z.array(EvalResultSchema),
  })
  .strict()
  .superRefine((report, context) => {
    const statusTotal =
      report.summary.passed +
      report.summary.failed +
      report.summary.notRun +
      report.summary.stale;
    if (statusTotal !== report.summary.total) {
      context.addIssue({
        code: 'custom',
        path: ['summary', 'total'],
        message: `summary total must equal status counts (${statusTotal})`,
      });
    }
    const scopeTotal = Object.values(report.summary.byScope).reduce(
      (total, count) => total + count,
      0,
    );
    if (scopeTotal !== report.summary.total) {
      context.addIssue({
        code: 'custom',
        path: ['summary', 'byScope'],
        message: `scope counts must equal summary total (${report.summary.total})`,
      });
    }
  });
