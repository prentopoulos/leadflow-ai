// Phase 4 evaluation corpus additions (`phase-4.0`), fixed from the accepted
// OpenSpec change before implementation is measured and retaining every
// earlier case ID. Each task adds its cases before its own implementation:
// task 2.1 the attribution contract, 3.1 the traffic plan, 4.1 the spend
// fixture and acquisition metrics. Hosted Phase 4 cases stay not_run until
// the owner-authorized probe runs.
import {
  AttributionSchema,
  IntakeSubmissionSchema,
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
    default:
      throw new Error(`unknown Phase 4 check: ${check}`);
  }
}
