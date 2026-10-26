import { z } from 'zod';

export * from './phase1.js';
export * from './qualification.js';
export * from './lifecycle.js';
export * from './simulator.js';
export * from './phase2.js';
export * from './metrics.js';

export const EvidenceClassSchema = z.enum([
  'synthetic',
  'mocked',
  'local-live',
  'deployed-live',
]);
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('leadflow-api'),
  scope: z.literal('process'),
  evidence: z.literal('local-process'),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export function createHealthResponse(): HealthResponse {
  return {
    status: 'ok',
    service: 'leadflow-api',
    scope: 'process',
    evidence: 'local-process',
  };
}

function criterionSchema(maximum: number) {
  return z
    .object({
      points: z.number().finite().min(0).max(maximum),
      evidence: z.array(z.string().min(1)),
    })
    .superRefine((value, context) => {
      if (value.points > 0 && value.evidence.length === 0) {
        context.addIssue({
          code: 'custom',
          message: 'positive points require criterion evidence',
          path: ['evidence'],
        });
      }
    });
}

export const MarketingReadinessScoreSchema = z
  .object({
    classification: z.literal('marketing_readiness'),
    criteria: z.object({
      needTimeline: criterionSchema(40),
      requestClarity: criterionSchema(30),
      completeness: criterionSchema(30),
    }),
    total: z.number().finite().min(0).max(100),
  })
  .superRefine((value, context) => {
    const expected =
      value.criteria.needTimeline.points +
      value.criteria.requestClarity.points +
      value.criteria.completeness.points;
    if (value.total !== expected) {
      context.addIssue({
        code: 'custom',
        message: `total must equal criterion sum (${expected})`,
        path: ['total'],
      });
    }
  });
export type MarketingReadinessScore = z.infer<
  typeof MarketingReadinessScoreSchema
>;

export const OutreachExpectationSchema = z
  .object({
    consent: z.boolean().optional(),
    draft: z
      .object({
        status: z.literal('awaiting_human_approval'),
      })
      .nullable(),
    sent: z.literal(false),
  })
  .superRefine((value, context) => {
    if (value.consent !== true && value.draft !== null) {
      context.addIssue({
        code: 'custom',
        message: 'draft must be absent without recorded consent',
        path: ['draft'],
      });
    }
  });

export const Phase0EnrichmentEvidenceSchema = z.object({
  status: z.enum(['available', 'unavailable', 'failed']),
  provider: z.string().min(1),
  subject: z.string().min(1),
  retrievedAt: z.iso.datetime().nullable(),
  evidenceClass: EvidenceClassSchema,
  detail: z.string().min(1),
});

export const RunStateSchema = z.object({
  status: z.enum(['persisted', 'in_progress', 'partial', 'failed', 'complete']),
  failures: z.array(z.string().min(1)),
  completedSteps: z.array(z.string().min(1)),
});

export function exportHealthJsonSchema(): z.core.JSONSchema.JSONSchema {
  return z.toJSONSchema(HealthResponseSchema, { target: 'draft-2020-12' });
}
