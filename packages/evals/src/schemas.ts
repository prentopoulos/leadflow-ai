import { z } from 'zod';
import { SystemBundleDocumentSchema } from '@leadflow-ai/domain';

export const DATASET_VERSION = 'phase-0.1' as const;
export const EVALUATOR_VERSION = 'phase-0.1' as const;
export const CONFIGURATION_VERSION = 'phase-0.1' as const;

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
]);

export const EvalCaseSchema = z.object({
  id: z.string().regex(/^p0-[a-z0-9-]+$/u),
  datasetVersion: z.literal(DATASET_VERSION),
  cohort: z.enum(['normal', 'edge', 'adversarial', 'failure']),
  evidenceClass: z.literal('synthetic'),
  applicability: z.enum(['runnable', 'future']),
  requirement: z.string().min(1),
  kind: CaseKindSchema,
  candidate: z.unknown(),
  expected: z.record(z.string(), z.unknown()),
});
export type EvalCase = z.infer<typeof EvalCaseSchema>;

export const EvalResultSchema = z.object({
  caseId: z.string(),
  status: z.enum(['pass', 'fail', 'not_run']),
  evidenceClass: z.literal('synthetic-local'),
  assertions: z.array(z.string()),
  reason: z.string().nullable(),
});
export type EvalResult = z.infer<typeof EvalResultSchema>;

export const SystemBundleSchema = SystemBundleDocumentSchema;
export type SystemBundle = z.infer<typeof SystemBundleSchema>;

export const EvalReportSchema = z.object({
  label: z.literal('synthetic-local'),
  generatedAt: z.iso.datetime(),
  bundle: SystemBundleSchema,
  summary: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    notRun: z.number().int().nonnegative(),
  }),
  results: z.array(EvalResultSchema),
});
