import { z } from 'zod';

// Phase 4 simulated acquisition. Attribution is synthetic demo data carried
// on the lead; it is read only by metrics and the run dossier and never by
// scoring, drafting, verification, events or logs.

export const ACQUISITION_VERSIONS = {
  channelRules: 'channel-rules-v1',
} as const;

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
