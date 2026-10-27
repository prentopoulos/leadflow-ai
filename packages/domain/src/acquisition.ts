import { z } from 'zod';

// Phase 4 simulated acquisition. Attribution is synthetic demo data carried
// on the lead; it is read only by metrics and the run dossier and never by
// scoring, drafting, verification, events or logs.

export const ACQUISITION_VERSIONS = {
  channelRules: 'channel-rules-v1',
  spendFixture: 'synthetic-spend-v1',
  trafficPlan: 'traffic-plan-v1',
} as const;

// The fixed flight size: traffic-plan-v1 plans this many leads and the
// acquisition block reports progress against it.
export const PLANNED_TRAFFIC_LEADS = 60;

// Lowercase slugs in the GA4 utm style; parentheses allow `(direct)`,
// `(none)` and `(organic)`. Values are not normalized, so a stored value is
// exactly what was validated.
export const AttributionSlugSchema = z
  .string()
  .regex(
    /^[a-z0-9()][a-z0-9._()-]{0,63}$/u,
    'attribution values are lowercase slugs of at most 64 characters',
  );

// A schema-enforced prefix makes a real advertising click ID impossible to
// store; Google documents no GCLID format, so no real shape is imitated.
export const SyntheticClickIdSchema = z
  .string()
  .regex(/^sim-[a-f0-9]{20}$/u, 'click IDs are synthetic `sim-` identifiers');

export const AttributionSchema = z
  .object({
    source: AttributionSlugSchema,
    medium: AttributionSlugSchema,
    campaign: AttributionSlugSchema,
    clickId: SyntheticClickIdSchema.nullable().default(null),
    clickIdClass: z.literal('synthetic').nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.clickId === null) !== (value.clickIdClass === null)) {
      context.addIssue({
        code: 'custom',
        path: ['clickIdClass'],
        message: 'a click ID is present exactly when it is marked synthetic',
      });
    }
  });
export type Attribution = z.infer<typeof AttributionSchema>;

export const ChannelSchema = z.enum([
  'direct',
  'paid_search',
  'paid_social',
  'email',
  'affiliates',
  'organic_search',
  'unassigned',
  'unattributed',
]);
export type Channel = z.infer<typeof ChannelSchema>;

export const CHANNEL_LABELS: Record<Channel, string> = {
  direct: 'Direct',
  paid_search: 'Paid Search',
  paid_social: 'Paid Social',
  email: 'Email',
  affiliates: 'Affiliates',
  organic_search: 'Organic Search',
  unassigned: 'Unassigned',
  unattributed: 'Unattributed',
};

export const CHANNEL_RULES_NOTICE =
  "Rules adapted from GA4's default channel group; not GA4 data." as const;

const SEARCH_SOURCES = new Set(['google', 'bing']);
const SOCIAL_SOURCES = new Set(['facebook', 'instagram', 'linkedin']);
const PAID_MEDIUM = /^(cpc|ppc|retargeting|paid.*)$/u;

// `channel-rules-v1`: evaluated in order, first match wins. Leads without
// attribution are Unattributed, LeadFlow's own label rather than a GA4
// channel; attribution that matches no rule is Unassigned.
export function channelFor(attribution: Attribution | null): Channel {
  if (attribution === null) return 'unattributed';
  const { source, medium } = attribution;
  // GA4 also accepts `(not set)`, but its space is outside the slug rule.
  if (source === '(direct)' && medium === '(none)') return 'direct';
  const paid = PAID_MEDIUM.test(medium);
  if (paid && SEARCH_SOURCES.has(source)) return 'paid_search';
  if (paid && SOCIAL_SOURCES.has(source)) return 'paid_social';
  if (source === 'email' || medium === 'email' || medium === 'newsletter')
    return 'email';
  if (medium === 'affiliate') return 'affiliates';
  if (medium === 'organic') return 'organic_search';
  return 'unassigned';
}

// `synthetic-spend-v1`: checked-in flight spend per simulated campaign for the
// fixed traffic plan, in integer simulated-USD cents. Illustrative only.
export const SpendEntrySchema = z
  .object({
    source: AttributionSlugSchema,
    medium: AttributionSlugSchema,
    campaign: AttributionSlugSchema,
    channel: ChannelSchema,
    spendCents: z.number().int().nonnegative(),
  })
  .strict();
export type SpendEntry = z.infer<typeof SpendEntrySchema>;

export interface SpendFixture {
  version: 'synthetic-spend-v1';
  currency: 'USD';
  label: string;
  entries: readonly SpendEntry[];
}

export const SYNTHETIC_SPEND: SpendFixture = {
  version: 'synthetic-spend-v1',
  currency: 'USD',
  label: 'Simulated, illustrative, not a benchmark.',
  entries: [
    {
      source: 'google',
      medium: 'cpc',
      campaign: 'sim-search-auto-insurance-q4',
      channel: 'paid_search',
      spendCents: 120_000,
    },
    {
      source: 'facebook',
      medium: 'paid_social',
      campaign: 'sim-social-pcs-move',
      channel: 'paid_social',
      spendCents: 80_000,
    },
    {
      source: 'milspouse-blog',
      medium: 'affiliate',
      campaign: 'sim-affiliate-partner-guide',
      channel: 'affiliates',
      spendCents: 40_000,
    },
    {
      source: 'newsletter',
      medium: 'email',
      campaign: 'sim-email-veterans-day',
      channel: 'email',
      spendCents: 15_000,
    },
    {
      source: 'google',
      medium: 'organic',
      campaign: '(organic)',
      channel: 'organic_search',
      spendCents: 0,
    },
    {
      source: '(direct)',
      medium: '(none)',
      campaign: '(direct)',
      channel: 'direct',
      spendCents: 0,
    },
  ],
};

export function spendFixtureIssues(fixture: SpendFixture): string[] {
  const issues: string[] = [];
  const campaigns = new Set<string>();
  for (const entry of fixture.entries) {
    if (!SpendEntrySchema.safeParse(entry).success) {
      issues.push(`${entry.campaign}: invalid entry`);
      continue;
    }
    if (campaigns.has(entry.campaign)) {
      issues.push(`${entry.campaign}: duplicate campaign`);
    }
    campaigns.add(entry.campaign);
    const derived = channelFor(
      AttributionSchema.parse({
        source: entry.source,
        medium: entry.medium,
        campaign: entry.campaign,
      }),
    );
    if (derived !== entry.channel) {
      issues.push(`${entry.campaign}: channel rules give ${derived}`);
    }
  }
  return issues;
}

// Cost values are fractional cents (display rounds); `no_spend` wins over an
// empty denominator so a free channel never reads as zero cost.
export const CostValueSchema = z
  .object({
    valueCents: z.number().nonnegative().nullable(),
    numeratorCents: z.number().int().nonnegative(),
    denominator: z.number().int().nonnegative(),
    reason: z.enum(['no_spend', 'insufficient_data']).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedReason =
      value.numeratorCents === 0
        ? 'no_spend'
        : value.denominator === 0
          ? 'insufficient_data'
          : null;
    const expectedValue =
      expectedReason === null ? value.numeratorCents / value.denominator : null;
    if (value.reason !== expectedReason || value.valueCents !== expectedValue) {
      context.addIssue({
        code: 'custom',
        message: 'cost must match its spend, denominator and reason',
      });
    }
  });
export type CostValue = z.infer<typeof CostValueSchema>;

function cost(spendCents: number, denominator: number): CostValue {
  const reason =
    spendCents === 0
      ? ('no_spend' as const)
      : denominator === 0
        ? ('insufficient_data' as const)
        : null;
  return {
    valueCents: reason === null ? spendCents / denominator : null,
    numeratorCents: spendCents,
    denominator,
    reason,
  };
}

// A share or rate; null with insufficient_data when the denominator is empty.
export const AcquisitionRatioSchema = z
  .object({
    value: z.number().min(0).max(1).nullable(),
    numerator: z.number().int().nonnegative(),
    denominator: z.number().int().nonnegative(),
    reason: z.literal('insufficient_data').nullable(),
  })
  .strict()
  .superRefine((ratio, context) => {
    const expected =
      ratio.denominator === 0 ? null : ratio.numerator / ratio.denominator;
    if (
      ratio.value !== expected ||
      (ratio.denominator === 0) !== (ratio.reason === 'insufficient_data') ||
      ratio.numerator > ratio.denominator
    ) {
      context.addIssue({
        code: 'custom',
        message: 'ratio must match its numerator and denominator',
      });
    }
  });
export type AcquisitionRatio = z.infer<typeof AcquisitionRatioSchema>;

function ratio(numerator: number, denominator: number): AcquisitionRatio {
  return {
    value: denominator === 0 ? null : numerator / denominator,
    numerator,
    denominator,
    reason: denominator === 0 ? 'insufficient_data' : null,
  };
}

const CountSchema = z.number().int().nonnegative();
const AcquisitionRowShape = {
  leads: CountSchema,
  qualified: CountSchema,
  contactable: CountSchema,
  spendCents: CountSchema,
  qualifiedRate: AcquisitionRatioSchema,
  cpl: CostValueSchema,
  cpql: CostValueSchema,
  cpcl: CostValueSchema,
};

export const AcquisitionReportSchema = z
  .object({
    label: z.literal('SIMULATED'),
    evidenceClass: z.literal('synthetic'),
    spendFixtureVersion: z.literal('synthetic-spend-v1'),
    channelRulesVersion: z.literal(ACQUISITION_VERSIONS.channelRules),
    currency: z.literal('USD'),
    spendLabel: z.string().min(1),
    plannedLeads: CountSchema,
    storedLeads: CountSchema,
    unattributedLeads: CountSchema,
    failedRunLeads: CountSchema,
    blended: z.object(AcquisitionRowShape).strict(),
    channels: z
      .array(
        z
          .object({
            channel: ChannelSchema,
            ...AcquisitionRowShape,
            spendShare: AcquisitionRatioSchema,
            leadShare: AcquisitionRatioSchema,
          })
          .strict(),
      )
      .length(ChannelSchema.options.length),
    campaigns: z.array(
      z
        .object({
          campaign: AttributionSlugSchema,
          channel: ChannelSchema,
          ...AcquisitionRowShape,
        })
        .strict(),
    ),
  })
  .strict();
export type AcquisitionReport = z.infer<typeof AcquisitionReportSchema>;

export type AcquisitionPriority =
  'high' | 'standard' | 'nurture' | 'held' | 'not_scored';

export interface AcquisitionLead {
  attribution: Attribution | null;
  priority: AcquisitionPriority;
  failed: boolean;
  // Recorded email-contact consent: only these leads can be followed up.
  consented: boolean;
}

// A marketing-qualified lead has high or standard readiness under rubric-v1.
export const QUALIFIED_PRIORITIES: ReadonlySet<AcquisitionPriority> = new Set([
  'high',
  'standard',
]);

function row(leads: readonly AcquisitionLead[], spendCents: number) {
  const qualified = leads.filter((lead) =>
    QUALIFIED_PRIORITIES.has(lead.priority),
  ).length;
  const contactable = leads.filter((lead) => lead.consented).length;
  return {
    leads: leads.length,
    qualified,
    contactable,
    spendCents,
    qualifiedRate: ratio(qualified, leads.length),
    cpl: cost(spendCents, leads.length),
    cpql: cost(spendCents, qualified),
    cpcl: cost(spendCents, contactable),
  };
}

// Blended figures divide total fixture spend by every stored lead in the
// window, attributed or not and whatever its run outcome.
export function acquisitionReport(
  leads: readonly AcquisitionLead[],
  fixture: SpendFixture = SYNTHETIC_SPEND,
  plannedLeads = PLANNED_TRAFFIC_LEADS,
): AcquisitionReport {
  const totalSpend = fixture.entries.reduce(
    (total, entry) => total + entry.spendCents,
    0,
  );
  return AcquisitionReportSchema.parse({
    label: 'SIMULATED',
    evidenceClass: 'synthetic',
    spendFixtureVersion: fixture.version,
    channelRulesVersion: ACQUISITION_VERSIONS.channelRules,
    currency: fixture.currency,
    spendLabel: fixture.label,
    plannedLeads,
    storedLeads: leads.length,
    unattributedLeads: leads.filter((lead) => lead.attribution === null).length,
    failedRunLeads: leads.filter((lead) => lead.failed).length,
    blended: row(leads, totalSpend),
    channels: ChannelSchema.options.map((channel) => {
      const channelLeads = leads.filter(
        (lead) => channelFor(lead.attribution) === channel,
      );
      const spendCents = fixture.entries
        .filter((entry) => entry.channel === channel)
        .reduce((total, entry) => total + entry.spendCents, 0);
      return {
        channel,
        ...row(channelLeads, spendCents),
        spendShare: ratio(spendCents, totalSpend),
        leadShare: ratio(channelLeads.length, leads.length),
      };
    }),
    campaigns: fixture.entries.map((entry) => ({
      campaign: entry.campaign,
      channel: entry.channel,
      ...row(
        leads.filter(
          (lead) =>
            lead.attribution?.source === entry.source &&
            lead.attribution.medium === entry.medium &&
            lead.attribution.campaign === entry.campaign,
        ),
        entry.spendCents,
      ),
    })),
  });
}
