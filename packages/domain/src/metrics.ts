import { z } from 'zod';
import {
  AcquisitionReportSchema,
  CHANNEL_RULES_NOTICE,
} from './acquisition.js';
import { CONTRACT_VERSIONS, WorkflowStepSchema } from './phase1.js';

const UtcTimestampSchema = z.iso.datetime();
const IdentifierSchema = z.string().uuid();

export const METRICS_WINDOW_LIMIT = 2_000;

// Owner-accepted definitions (PROJECT.md "Phase 2 decisions", 2026-10-25).
// The API serves these strings beside every value.
export const METRICS_DEFINITIONS = {
  version: CONTRACT_VERSIONS.metricsDefinitions,
  window:
    'All retained local runs recorded under the current system bundle; runs from other bundles are counted separately and excluded.',
  leadVolume: {
    numerator: 'Persisted leads in the window.',
    denominator: 'None (count).',
    exclusions: 'Leads from other system bundles.',
  },
  priorityDistribution: {
    numerator: 'Leads whose latest qualification has each label.',
    denominator: 'Leads in the window.',
    exclusions:
      'None; leads without a qualification yet are counted as not scored.',
  },
  processingTime: {
    numerator:
      'Milliseconds from lead.persisted to the latest run.completed or run.failed event.',
    denominator: 'Finished runs (complete, failed_retryable, failed_terminal).',
    exclusions:
      'Active runs are excluded and counted; human review time is excluded and reported as review latency.',
  },
  reviewLatency: {
    numerator:
      'Milliseconds from the run finishing to the first review decision on its draft.',
    denominator: 'Drafts with at least one review decision.',
    exclusions: 'Drafts never reviewed.',
  },
  enrichmentSuccess: {
    numerator:
      'Lookups whose source returned a valid answer (found or not found).',
    denominator: 'Attempted lookups.',
    exclusions:
      'Lookups not attempted (missing input) are excluded and counted. Unavailable, timeout, 429, 5xx and malformed answers are failures. Retries collapse into the final outcome. Live and recorded/mock evidence are never combined.',
  },
  enrichmentFoundRate: {
    numerator: 'Lookups with outcome found.',
    denominator: 'Attempted lookups.',
    exclusions: 'Lookups not attempted are excluded and counted.',
  },
  agentFailures: {
    numerator:
      'Runs whose latest status is failed_retryable or failed_terminal.',
    denominator: 'Finished runs (complete, failed_retryable, failed_terminal).',
    exclusions:
      'Active runs. A retry that later succeeded is not a failure. Unavailable enrichment is not an agent failure.',
  },
  approvalQueue: {
    numerator: 'Drafts whose latest revision is pending_review.',
    denominator: 'None (count).',
    exclusions:
      'Verification-blocked, approved, rejected and superseded revisions.',
  },
  simulation: {
    numerator: 'Synthetic simulator outcomes.',
    denominator: 'Runs with a simulation record.',
    exclusions:
      'SYNTHETIC: fixed-seed, score-independent, not live and not predictive. Never part of an operational metric.',
  },
  // Phase 4 (PROJECT.md "Phase 4 decisions", 2026-10-27). SIMULATED: spend is
  // the checked-in synthetic-spend-v1 fixture and leads are fictional.
  blendedCostPerLead: {
    numerator: 'Total synthetic-spend-v1 flight spend (simulated USD).',
    denominator:
      'Every persisted lead in the window, including unattributed leads and failed runs.',
    exclusions:
      'None; unattributed and failed-run leads are counted and reported.',
  },
  channelCostPerLead: {
    numerator: "Fixture spend of the channel's or campaign's entries.",
    denominator: 'Leads attributed to that channel or campaign.',
    exclusions: `Zero-spend groups report no_spend, never 0.00. ${CHANNEL_RULES_NOTICE}`,
  },
  costPerQualifiedLead: {
    numerator: 'The same spend as the matching cost per lead.',
    denominator:
      'Marketing-qualified leads: latest priority high or standard (marketing readiness only).',
    exclusions: 'Nurture, held and not-scored leads.',
  },
  costPerContactableLead: {
    numerator: 'The same spend as the matching cost per lead.',
    denominator:
      'Contactable leads: those with recorded email-contact consent, the only leads that can be followed up.',
    exclusions: 'Leads without consent.',
  },
  qualifiedLeadRate: {
    numerator: 'Marketing-qualified leads (high or standard readiness).',
    denominator: 'Leads in the channel, campaign or window.',
    exclusions:
      'None. Channels are assigned at random, so differences are chance, not channel quality.',
  },
  spendAndLeadShare: {
    numerator: "The channel's fixture spend, or its lead count.",
    denominator: 'Total fixture spend, or every lead in the window.',
    exclusions: 'None; unattributed leads have a lead share and no spend.',
  },
} as const;

export const RateValueSchema = z
  .object({
    value: z.number().min(0).max(1).nullable(),
    numerator: z.number().int().nonnegative(),
    denominator: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    reason: z.literal('insufficient_data').nullable(),
  })
  .strict()
  .superRefine((metric, context) => {
    const expected =
      metric.denominator === 0 ? null : metric.numerator / metric.denominator;
    if (metric.value !== expected) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'rate must match its numerator and denominator',
      });
    }
    if (
      (metric.denominator === 0) !==
      (metric.reason === 'insufficient_data')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'an empty denominator requires insufficient_data',
      });
    }
    if (metric.numerator > metric.denominator) {
      context.addIssue({
        code: 'custom',
        path: ['numerator'],
        message: 'numerator cannot exceed denominator',
      });
    }
  });
export type RateValue = z.infer<typeof RateValueSchema>;

export const DurationSummarySchema = z
  .object({
    n: z.number().int().nonnegative(),
    medianMs: z.number().nonnegative().nullable(),
    p90Ms: z.number().nonnegative().nullable(),
    meanMs: z.number().nonnegative().nullable(),
    excluded: z.number().int().nonnegative(),
    reason: z.literal('insufficient_data').nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const empty = value.n === 0;
    if (
      empty !== (value.reason === 'insufficient_data') ||
      empty !== (value.medianMs === null) ||
      empty !== (value.p90Ms === null) ||
      empty !== (value.meanMs === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'durations are null exactly when there is no data',
      });
    }
  });
export type DurationSummary = z.infer<typeof DurationSummarySchema>;

export const EnrichmentClassGroupSchema = z.enum(['live', 'recorded_or_mock']);
export const EnrichmentMetricSchema = z
  .object({
    classGroup: EnrichmentClassGroupSchema,
    source: z.enum(['all', 'nhtsa_vpic', 'zippopotam_us']),
    success: RateValueSchema,
    foundRate: RateValueSchema,
    notAttempted: z.number().int().nonnegative(),
  })
  .strict();
export type EnrichmentMetric = z.infer<typeof EnrichmentMetricSchema>;

const CountSchema = z.number().int().nonnegative();

export const MetricsReportSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.metricsReport),
    definitionsVersion: z.literal(CONTRACT_VERSIONS.metricsDefinitions),
    generatedAt: UtcTimestampSchema,
    systemBundleId: IdentifierSchema,
    window: z
      .object({
        runsInWindow: CountSchema,
        activeRuns: CountSchema,
        otherBundleRuns: CountSchema,
      })
      .strict(),
    leadVolume: CountSchema,
    priorityDistribution: z
      .object({
        high: CountSchema,
        standard: CountSchema,
        nurture: CountSchema,
        held: CountSchema,
        not_scored: CountSchema,
      })
      .strict(),
    processingTime: DurationSummarySchema,
    reviewLatency: DurationSummarySchema,
    enrichment: z.array(EnrichmentMetricSchema).length(6),
    agentFailures: RateValueSchema,
    failuresByStep: z.record(WorkflowStepSchema, CountSchema),
    approvalQueue: CountSchema,
    simulation: z
      .object({
        label: z.literal('SYNTHETIC'),
        runs: CountSchema,
        contacted: CountSchema,
        responded: CountSchema,
        appointment: CountSchema,
      })
      .strict(),
    acquisition: AcquisitionReportSchema,
    evidenceClass: z.literal('synthetic-local'),
  })
  .strict()
  .superRefine((report, context) => {
    if (report.acquisition.storedLeads !== report.leadVolume) {
      context.addIssue({
        code: 'custom',
        path: ['acquisition', 'storedLeads'],
        message: 'acquisition must cover every lead in the window',
      });
    }
    const distribution = Object.values(report.priorityDistribution).reduce(
      (total, count) => total + count,
      0,
    );
    if (distribution !== report.leadVolume) {
      context.addIssue({
        code: 'custom',
        path: ['priorityDistribution'],
        message: 'priority distribution must cover every lead',
      });
    }
    if (report.leadVolume !== report.window.runsInWindow) {
      context.addIssue({
        code: 'custom',
        path: ['leadVolume'],
        message: 'each lead has exactly one run',
      });
    }
  });
export type MetricsReport = z.infer<typeof MetricsReportSchema>;

export const MetricsResponseSchema = z
  .object({
    schemaVersion: z.literal('metrics-response-v1'),
    definitions: z.unknown(),
    report: MetricsReportSchema,
    retrievedAt: UtcTimestampSchema,
  })
  .strict();
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;
