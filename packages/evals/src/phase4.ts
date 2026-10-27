// Phase 4 evaluation corpus additions (`phase-4.0`), fixed from the accepted
// OpenSpec change before implementation is measured and retaining every
// earlier case ID. Each task adds its cases before its own implementation:
// task 2.1 the attribution contract, 3.1 the traffic plan, 4.1 the spend
// fixture and acquisition metrics. Hosted Phase 4 cases stay not_run until
// the owner-authorized probe runs.
import {
  AttributionSchema,
  IdempotencyKeySchema,
  IntakeSubmissionSchema,
  PLANNED_TRAFFIC_LEADS,
  RECORDED_VEHICLE_SUBJECTS,
  RECORDED_ZIP_SUBJECTS,
  SYNTHETIC_SPEND,
  acquisitionReport,
  spendFixtureIssues,
  runTrafficPlan,
  trafficAttributionFor,
  trafficIdempotencyKey,
  trafficPlan,
  trafficRefusal,
  LeadDocumentSchema,
  channelFor,
  composeDraft,
  composerInputFrom,
  currentConsentRecord,
  scoreQualification,
  type IntakeSubmission,
} from '@leadflow-ai/domain';
import {
  DeterministicQualificationInterpreter,
  qualificationProjectionFromLead,
} from '@leadflow-ai/runtime';
import { DATASET_VERSION, type EvalCase } from './schemas.js';

function runnable(
  id: string,
  requirement: string,
  check: string,
  expected: Record<string, unknown>,
  cohort: EvalCase['cohort'] = 'normal',
): EvalCase {
  return {
    id,
    datasetVersion: DATASET_VERSION,
    cohort,
    evidenceClass: 'synthetic',
    applicability: 'runnable',
    evidenceScope: 'pure-synthetic',
    requirement,
    kind: 'phase4-contract',
    candidate: { check },
    expected,
  };
}

export const PHASE_FOUR_CASES = [
  runnable(
    'p4-channel-rules-table',
    'channel-rules-v1 maps source/medium in fixed order; no attribution is Unattributed and no match is Unassigned',
    'channel-rules-table',
    {
      channels: [
        'paid_search',
        'paid_search',
        'paid_social',
        'paid_social',
        'email',
        'email',
        'affiliates',
        'organic_search',
        'direct',
        'unassigned',
        'unassigned',
        'unattributed',
      ],
    },
  ),
  runnable(
    'p4-click-id-shapes',
    'Only `sim-` + 20 lowercase hex click IDs marked synthetic are accepted; gclid/fbclid-shaped and unmarked values are refused',
    'click-id-shapes',
    { accepted: [true, true], refused: [true, true, true, true, true, true] },
    'adversarial',
  ),
  runnable(
    'p4-attribution-malformed',
    'Attribution rejects unknown keys, a client channel, uppercase, overlong and unsafe characters',
    'attribution-malformed',
    { refused: [true, true, true, true, true, true] },
    'adversarial',
  ),
  runnable(
    'p4-intake-version-gate',
    'Only intake-v3 is accepted; intake-v1 and intake-v2 are refused; an omitted attribution defaults to null',
    'intake-version-gate',
    { v1: false, v2: false, v3: true, defaultAttribution: null },
  ),
  runnable(
    'p4-lead-provenance',
    'A lead-v3 labels attribution as LeadFlow simulated data, not a demo or Military.com field',
    'lead-provenance',
    {
      simulatedFields: ['attribution'],
      demoHasAttribution: false,
      exactSourceFields: ['zipCode'],
    },
  ),
  runnable(
    'p4-score-independent-of-attribution',
    'Attribution never changes interpretation, score, priority or the composed draft',
    'score-independence',
    { sameInterpretation: true, sameScore: true, sameDraft: true },
    'adversarial',
  ),
  // Task 3.1: traffic-plan-v1 and the paced runner.
  runnable(
    'p4-traffic-plan-determinism',
    'traffic-plan-v1 yields the same 60 valid fictional intakes with the fixed channel mix and unique synthetic click IDs only on paid leads',
    'traffic-plan-determinism',
    {
      identical: true,
      count: 60,
      allValid: true,
      mix: {
        affiliates: 9,
        direct: 6,
        email: 6,
        organic_search: 9,
        paid_search: 18,
        paid_social: 12,
      },
      clickIdsOnlyOnPaid: true,
      uniqueClickIds: 30,
    },
  ),
  runnable(
    'p4-traffic-plan-content-independent',
    'Each planned attribution is a function of the plan index alone, never of lead content',
    'traffic-plan-content-independent',
    { attributionMatchesIndexOnly: true, indexOnlyArity: 1 },
    'adversarial',
  ),
  runnable(
    'p4-traffic-plan-recorded-subjects',
    'Planned leads use only recorded enrichment subjects, fictional identities and example.org addresses',
    'traffic-plan-recorded-subjects',
    { recordedVehicles: true, recordedZips: true, fictional: true },
  ),
  runnable(
    'p4-traffic-idempotency-keys',
    'Idempotency keys are per system bundle and plan index, unique and valid',
    'traffic-idempotency-keys',
    { first: 'traffic-v1-abcdef12-01', unique: 60, valid: true },
  ),
  runnable(
    'p4-traffic-runner-pacing',
    'The runner submits in order, waits the interval between leads only, stops on request and counts created and replayed leads',
    'traffic-runner-pacing',
    {
      paced: { submitted: [0, 1, 2], sleeps: [10000, 10000], created: 3 },
      stopped: { submitted: [0], created: 1, stopped: true },
      replayed: { created: 0, replayed: 3 },
    },
  ),
  runnable(
    'p4-traffic-recorded-guard',
    'Simulated traffic is refused unless the running system bundle uses recorded enrichment',
    'traffic-recorded-guard',
    { recorded: false, live: true, mock: true, unknown: true },
    'adversarial',
  ),
  // Task 4.1: synthetic-spend-v1 and the acquisition block.
  runnable(
    'p4-spend-fixture-integrity',
    'synthetic-spend-v1 is valid; negative, fractional, duplicate and channel-mismatched entries are refused',
    'spend-fixture-integrity',
    {
      fixtureIssues: 0,
      totalCents: 255000,
      refused: [true, true, true, true],
    },
    'adversarial',
  ),
  runnable(
    'p4-cost-known-answer',
    'Blended, per-channel and per-campaign CPL and CPQL match a hand-calculated answer in cents, with no_spend and insufficient_data where defined',
    'cost-known-answer',
    {
      blended: { leads: 8, qualified: 4, cpl: 5000, cpql: 10000 },
      paidSearch: { leads: 3, qualified: 2, cpl: 10000, cpql: 15000 },
      paidSocial: {
        leads: 2,
        qualified: 0,
        cpl: 5000,
        cpql: 'insufficient_data',
      },
      organic: { leads: 1, cpl: 'no_spend' },
      email: { leads: 0, cpl: 'no_spend' },
      unattributed: { leads: 2, cpl: 'no_spend' },
      searchCampaign: { leads: 3, cpl: 10000, cpql: 15000 },
      counts: { stored: 8, planned: 60, unattributed: 2, failedRuns: 1 },
    },
  ),
  runnable(
    'p4-acquisition-extensions',
    'Qualified-lead rate, cost per contactable (consented) lead, and spend share against lead share match a hand-calculated answer',
    'acquisition-extensions',
    {
      blended: { contactable: 5, qualifiedRate: 0.5, cpcl: 8000 },
      paidSearch: {
        contactable: 2,
        qualifiedRate: 2 / 3,
        cpcl: 15000,
        spendShare: 0.75,
        leadShare: 0.375,
      },
      paidSocial: { qualifiedRate: 0, spendShare: 0.25, leadShare: 0.25 },
      email: { qualifiedRate: 'insufficient_data', leadShare: 0 },
      unattributed: { spendShare: 0, leadShare: 0.25 },
    },
  ),
  runnable(
    'p4-cost-empty-window',
    'An empty window reports insufficient_data for blended CPL and CPQL, never zero',
    'cost-empty-window',
    { stored: 0, cpl: 'insufficient_data', cpql: 'insufficient_data' },
    'edge',
  ),
] satisfies EvalCase[];

const NOW = '2026-10-27T12:00:00.000Z';
const LEAD_ID = '00000000-0000-4000-8000-000000000041';

const baseIntake: IntakeSubmission = {
  schemaVersion: 'intake-v3',
  identityClass: 'fictional',
  givenName: 'Avery',
  familyName: 'Example',
  email: 'avery.example@example.org',
  zipCode: '22150',
  vehicleYear: 2022,
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  coverageFocus: 'balanced',
  requestIntent: 'compare_options',
  needTimeline: 'within_30_days',
  requestDetails: 'Comparing options before renewal.',
  emailContactConsent: true,
  consentRecord: currentConsentRecord(),
  attribution: null,
};

const paidAttribution = {
  source: 'google',
  medium: 'cpc',
  campaign: 'sim-search-auto-insurance-q4',
  clickId: 'sim-0123456789abcdef0123',
  clickIdClass: 'synthetic',
} as const;

function lead(intake: IntakeSubmission) {
  return LeadDocumentSchema.parse({
    schemaVersion: 'lead-v3',
    leadId: LEAD_ID,
    createdAt: NOW,
    intake,
    provenance: {
      sourceId: 'military-com-auto-landing',
      sourceUrl: 'https://auto.military.com/',
      retrievedAt: '2026-10-24',
      exactSourceFields: ['zipCode'],
      demoFields: ['givenName', 'familyName', 'email'],
      simulatedFields: ['attribution'],
      parityVerified: false,
    },
    evidenceClass: 'synthetic',
  });
}

const refused = (value: unknown) => !AttributionSchema.safeParse(value).success;

async function qualify(intake: IntakeSubmission) {
  const interpretation = await new DeterministicQualificationInterpreter(
    () => NOW,
  ).interpret(qualificationProjectionFromLead(lead(intake)));
  const result = scoreQualification(interpretation, {
    resultId: '00000000-0000-4000-8000-000000000042',
    runId: '00000000-0000-4000-8000-000000000043',
    leadId: LEAD_ID,
    generatedAt: NOW,
  });
  if (result.priority === null) throw new Error('fixture lead must be scored');
  const draft = composeDraft(
    composerInputFrom({ intake, priority: result.priority, evidence: [] }),
  );
  return { interpretation, result, draft };
}

function knownAnswerReport() {
  const search = {
    source: 'google',
    medium: 'cpc',
    campaign: 'sim-search',
    clickId: null,
    clickIdClass: null,
  };
  const social = {
    ...search,
    source: 'facebook',
    medium: 'paid_social',
    campaign: 'sim-social',
  };
  const organic = { ...search, medium: 'organic', campaign: '(organic)' };
  const fixture = {
    version: 'synthetic-spend-v1' as const,
    currency: 'USD' as const,
    label: SYNTHETIC_SPEND.label,
    entries: [
      {
        source: 'google',
        medium: 'cpc',
        campaign: 'sim-search',
        channel: 'paid_search' as const,
        spendCents: 30000,
      },
      {
        source: 'facebook',
        medium: 'paid_social',
        campaign: 'sim-social',
        channel: 'paid_social' as const,
        spendCents: 10000,
      },
      {
        source: 'google',
        medium: 'organic',
        campaign: '(organic)',
        channel: 'organic_search' as const,
        spendCents: 0,
      },
    ],
  };
  return acquisitionReport(
    [
      { attribution: search, priority: 'high', failed: false, consented: true },
      {
        attribution: search,
        priority: 'standard',
        failed: false,
        consented: true,
      },
      {
        attribution: search,
        priority: 'nurture',
        failed: false,
        consented: false,
      },
      {
        attribution: social,
        priority: 'nurture',
        failed: false,
        consented: true,
      },
      {
        attribution: social,
        priority: 'held',
        failed: false,
        consented: false,
      },
      {
        attribution: organic,
        priority: 'high',
        failed: false,
        consented: true,
      },
      {
        attribution: null,
        priority: 'not_scored',
        failed: true,
        consented: false,
      },
      {
        attribution: null,
        priority: 'standard',
        failed: false,
        consented: true,
      },
    ],
    fixture,
  );
}

export async function observePhaseFour(check: string): Promise<unknown> {
  switch (check) {
    case 'channel-rules-table': {
      const pairs: [string, string][] = [
        ['google', 'cpc'],
        ['bing', 'ppc'],
        ['facebook', 'paid_social'],
        ['instagram', 'paid'],
        ['newsletter', 'email'],
        ['email', 'referral'],
        ['milspouse-blog', 'affiliate'],
        ['google', 'organic'],
        ['(direct)', '(none)'],
        ['facebook', 'referral'],
        ['google', 'display'],
      ];
      return {
        channels: [
          ...pairs.map(([source, medium]) =>
            channelFor(
              AttributionSchema.parse({ source, medium, campaign: 'sim-x' }),
            ),
          ),
          channelFor(null),
        ],
      };
    }
    case 'click-id-shapes': {
      const accepted = [
        paidAttribution,
        { source: '(direct)', medium: '(none)', campaign: '(direct)' },
      ].map((value) => AttributionSchema.safeParse(value).success);
      return {
        accepted,
        refused: [
          { ...paidAttribution, clickId: 'Cj0KCQjw-sim-like-gclid_value' },
          { ...paidAttribution, clickId: 'IwAR0abcdefghijklmnop' },
          { ...paidAttribution, clickId: 'sim-0123456789ABCDEF0123' },
          { ...paidAttribution, clickId: 'sim-0123' },
          { ...paidAttribution, clickIdClass: null },
          { ...paidAttribution, clickId: null },
        ].map(refused),
      };
    }
    case 'attribution-malformed':
      return {
        refused: [
          { ...paidAttribution, extra: 'x' },
          { ...paidAttribution, channel: 'paid_search' },
          { ...paidAttribution, source: 'Google' },
          { ...paidAttribution, campaign: `sim-${'x'.repeat(64)}` },
          { ...paidAttribution, medium: 'cpc<script>' },
          { ...paidAttribution, source: 'google ads' },
        ].map(refused),
      };
    case 'intake-version-gate': {
      const withoutAttribution: Record<string, unknown> = { ...baseIntake };
      delete withoutAttribution.attribution;
      const parsed = IntakeSubmissionSchema.safeParse(withoutAttribution);
      return {
        v1: IntakeSubmissionSchema.safeParse({
          ...baseIntake,
          schemaVersion: 'intake-v1',
        }).success,
        v2: IntakeSubmissionSchema.safeParse({
          ...baseIntake,
          schemaVersion: 'intake-v2',
        }).success,
        v3: parsed.success,
        defaultAttribution: parsed.success
          ? parsed.data.attribution
          : 'refused',
      };
    }
    case 'lead-provenance': {
      const stored = lead({ ...baseIntake, attribution: paidAttribution });
      return {
        simulatedFields: stored.provenance.simulatedFields,
        demoHasAttribution: (stored.provenance.demoFields as string[]).includes(
          'attribution',
        ),
        exactSourceFields: stored.provenance.exactSourceFields,
      };
    }
    case 'score-independence': {
      const without = await qualify(baseIntake);
      const withPaid = await qualify({
        ...baseIntake,
        attribution: paidAttribution,
      });
      const same = (left: unknown, right: unknown) =>
        JSON.stringify(left) === JSON.stringify(right);
      return {
        sameInterpretation: same(
          without.interpretation,
          withPaid.interpretation,
        ),
        sameScore:
          without.result.total === withPaid.result.total &&
          without.result.priority === withPaid.result.priority &&
          same(without.result.criteria, withPaid.result.criteria),
        sameDraft: same(without.draft, withPaid.draft),
      };
    }
    case 'traffic-plan-determinism': {
      const plan = trafficPlan();
      const clickIds = plan
        .map((entry) => entry.intake.attribution?.clickId ?? null)
        .filter((value) => value !== null);
      const mix: Record<string, number> = {};
      for (const entry of plan) {
        const channel = channelFor(entry.intake.attribution);
        mix[channel] = (mix[channel] ?? 0) + 1;
      }
      return {
        identical: JSON.stringify(plan) === JSON.stringify(trafficPlan()),
        count: plan.length,
        allValid: plan.every(
          (entry) => IntakeSubmissionSchema.safeParse(entry.intake).success,
        ),
        mix: Object.fromEntries(
          Object.entries(mix).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
        clickIdsOnlyOnPaid: plan.every((entry) => {
          const channel = channelFor(entry.intake.attribution);
          const paid = channel === 'paid_search' || channel === 'paid_social';
          return paid === (entry.intake.attribution?.clickId != null);
        }),
        uniqueClickIds: new Set(clickIds).size,
      };
    }
    case 'traffic-plan-content-independent':
      return {
        attributionMatchesIndexOnly: trafficPlan().every(
          (entry, index) =>
            JSON.stringify(entry.intake.attribution) ===
            JSON.stringify(trafficAttributionFor(index)),
        ),
        indexOnlyArity: trafficAttributionFor.length,
      };
    case 'traffic-plan-recorded-subjects': {
      const plan = trafficPlan();
      const vehicles = new Set(
        RECORDED_VEHICLE_SUBJECTS.map((subject) => JSON.stringify(subject)),
      );
      return {
        recordedVehicles: plan.every(
          ({ intake }) =>
            intake.vehicleYear === null ||
            vehicles.has(
              JSON.stringify({
                vehicleYear: intake.vehicleYear,
                vehicleMake: intake.vehicleMake,
                vehicleModel: intake.vehicleModel,
              }),
            ),
        ),
        recordedZips: plan.every(({ intake }) =>
          RECORDED_ZIP_SUBJECTS.includes(intake.zipCode),
        ),
        fictional: plan.every(
          ({ intake }) =>
            intake.identityClass === 'fictional' &&
            intake.email.endsWith('@example.org'),
        ),
      };
    }
    case 'traffic-idempotency-keys': {
      const bundleId = 'abcdef12-0000-4000-8000-000000000000';
      const keys = Array.from({ length: PLANNED_TRAFFIC_LEADS }, (_, index) =>
        trafficIdempotencyKey(bundleId, index),
      );
      return {
        first: keys[0],
        unique: new Set(keys).size,
        valid: keys.every((key) => IdempotencyKeySchema.safeParse(key).success),
      };
    }
    case 'traffic-runner-pacing': {
      const run = async (
        count: number,
        outcome: 'created' | 'replayed',
        stopAfter: number | null,
      ) => {
        const submitted: number[] = [];
        const sleeps: number[] = [];
        const result = await runTrafficPlan({
          count,
          intervalMs: 10_000,
          submit: async (entry) => {
            submitted.push(entry.index);
            return outcome;
          },
          sleep: async (milliseconds) => {
            sleeps.push(milliseconds);
          },
          shouldStop: () => stopAfter !== null && submitted.length >= stopAfter,
        });
        return { submitted, sleeps, ...result };
      };
      const paced = await run(3, 'created', null);
      const stopped = await run(3, 'created', 1);
      const replayed = await run(3, 'replayed', null);
      return {
        paced: {
          submitted: paced.submitted,
          sleeps: paced.sleeps,
          created: paced.created,
        },
        stopped: {
          submitted: stopped.submitted,
          created: stopped.created,
          stopped: stopped.stopped,
        },
        replayed: { created: replayed.created, replayed: replayed.replayed },
      };
    }
    case 'traffic-recorded-guard':
      return {
        recorded: trafficRefusal('recorded') !== null,
        live: trafficRefusal('live') !== null,
        mock: trafficRefusal('mock') !== null,
        unknown: trafficRefusal(null) !== null,
      };
    case 'spend-fixture-integrity': {
      const [first, ...rest] = SYNTHETIC_SPEND.entries;
      const variant = (entries: unknown[]) =>
        spendFixtureIssues({ ...SYNTHETIC_SPEND, entries } as never).length > 0;
      return {
        fixtureIssues: spendFixtureIssues(SYNTHETIC_SPEND).length,
        totalCents: SYNTHETIC_SPEND.entries.reduce(
          (total, entry) => total + entry.spendCents,
          0,
        ),
        refused: [
          variant([{ ...first, spendCents: -1 }, ...rest]),
          variant([{ ...first, spendCents: 10.5 }, ...rest]),
          variant([first, first, ...rest]),
          variant([{ ...first, channel: 'email' }, ...rest]),
        ],
      };
    }
    case 'cost-known-answer': {
      const report = knownAnswerReport();
      const cost = (value: {
        valueCents: number | null;
        reason: string | null;
      }) => value.valueCents ?? value.reason;
      const channel = (name: string) =>
        report.channels.find((row) => row.channel === name)!;
      const campaign = report.campaigns.find(
        (row) => row.campaign === 'sim-search',
      )!;
      return {
        blended: {
          leads: report.blended.leads,
          qualified: report.blended.qualified,
          cpl: cost(report.blended.cpl),
          cpql: cost(report.blended.cpql),
        },
        paidSearch: {
          leads: channel('paid_search').leads,
          qualified: channel('paid_search').qualified,
          cpl: cost(channel('paid_search').cpl),
          cpql: cost(channel('paid_search').cpql),
        },
        paidSocial: {
          leads: channel('paid_social').leads,
          qualified: channel('paid_social').qualified,
          cpl: cost(channel('paid_social').cpl),
          cpql: cost(channel('paid_social').cpql),
        },
        organic: {
          leads: channel('organic_search').leads,
          cpl: cost(channel('organic_search').cpl),
        },
        email: {
          leads: channel('email').leads,
          cpl: cost(channel('email').cpl),
        },
        unattributed: {
          leads: channel('unattributed').leads,
          cpl: cost(channel('unattributed').cpl),
        },
        searchCampaign: {
          leads: campaign.leads,
          cpl: cost(campaign.cpl),
          cpql: cost(campaign.cpql),
        },
        counts: {
          stored: report.storedLeads,
          planned: report.plannedLeads,
          unattributed: report.unattributedLeads,
          failedRuns: report.failedRunLeads,
        },
      };
    }
    case 'acquisition-extensions': {
      const report = knownAnswerReport();
      const ratio = (value: { value: number | null; reason: string | null }) =>
        value.value ?? value.reason;
      const channel = (name: string) =>
        report.channels.find((row) => row.channel === name)!;
      return {
        blended: {
          contactable: report.blended.contactable,
          qualifiedRate: ratio(report.blended.qualifiedRate),
          cpcl: report.blended.cpcl.valueCents ?? report.blended.cpcl.reason,
        },
        paidSearch: {
          contactable: channel('paid_search').contactable,
          qualifiedRate: ratio(channel('paid_search').qualifiedRate),
          cpcl: channel('paid_search').cpcl.valueCents,
          spendShare: ratio(channel('paid_search').spendShare),
          leadShare: ratio(channel('paid_search').leadShare),
        },
        paidSocial: {
          qualifiedRate: ratio(channel('paid_social').qualifiedRate),
          spendShare: ratio(channel('paid_social').spendShare),
          leadShare: ratio(channel('paid_social').leadShare),
        },
        email: {
          qualifiedRate: ratio(channel('email').qualifiedRate),
          leadShare: ratio(channel('email').leadShare),
        },
        unattributed: {
          spendShare: ratio(channel('unattributed').spendShare),
          leadShare: ratio(channel('unattributed').leadShare),
        },
      };
    }
    case 'cost-empty-window': {
      const report = acquisitionReport([]);
      return {
        stored: report.storedLeads,
        cpl: report.blended.cpl.reason,
        cpql: report.blended.cpql.reason,
      };
    }
    default:
      throw new Error(`unknown Phase 4 check: ${check}`);
  }
}
