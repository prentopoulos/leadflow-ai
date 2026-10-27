import { describe, expect, it } from 'vitest';
import { RateValueSchema, DurationSummarySchema } from './metrics.js';
import {
  DraftReviewSchema,
  EmailCheckSchema,
  ENRICHMENT_ENDPOINTS,
  EnrichmentEvidenceSchema,
  LOCAL_OPERATOR_PRINCIPAL,
  OutreachDraftRevisionSchema,
  VERIFICATION_RULE_IDS,
  VEHICLE_LISTING_STATEMENT,
  VerificationResultSchema,
} from './phase2.js';

const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  evidence: '33333333-3333-4333-8333-333333333333',
  draft: '44444444-4444-4444-8444-444444444444',
  revision: '55555555-5555-4555-8555-555555555555',
  verification: '66666666-6666-4666-8666-666666666666',
  review: '77777777-7777-4777-8777-777777777777',
};
const timestamp = '2026-10-25T20:00:00.000Z';
const digest = 'b'.repeat(64);

const vehicleFound = {
  schemaVersion: 'enrichment-evidence-v1',
  evidenceId: ids.evidence,
  runId: ids.run,
  leadId: ids.lead,
  source: 'nhtsa_vpic',
  endpointTemplate: ENRICHMENT_ENDPOINTS.nhtsa_vpic.template,
  subject: { kind: 'vehicle', make: 'Toyota', modelYear: 2022, model: 'Camry' },
  requestedAt: timestamp,
  retrievedAt: timestamp,
  httpStatus: 200,
  outcome: 'found',
  failureKind: null,
  notAttemptedReason: null,
  attempts: 1,
  evidenceClass: 'mock',
  recordedCapturedAt: null,
  rawBody: '{"Results":[]}',
  rawBodyTruncated: false,
  rawBodySha256: digest,
  claim: {
    kind: 'vehicle_listing',
    listed: true,
    makeName: 'TOYOTA',
    modelName: 'Camry',
    modelYear: 2022,
    statement: VEHICLE_LISTING_STATEMENT,
  },
  attribution: ENRICHMENT_ENDPOINTS.nhtsa_vpic.attribution,
  createdAt: timestamp,
} as const;

const notAttempted = {
  ...vehicleFound,
  subject: { kind: 'vehicle', make: null, modelYear: null, model: null },
  requestedAt: null,
  retrievedAt: null,
  httpStatus: null,
  outcome: 'not_attempted',
  notAttemptedReason: 'missing_vehicle_fields',
  attempts: 0,
  rawBody: null,
  rawBodySha256: null,
  claim: null,
} as const;

const rules = (
  outcomes: Partial<
    Record<
      (typeof VERIFICATION_RULE_IDS)[number],
      'pass' | 'fail' | 'not_applicable'
    >
  > = {},
) =>
  VERIFICATION_RULE_IDS.map((ruleId) => ({
    ruleId,
    outcome: outcomes[ruleId] ?? 'pass',
    detail: 'checked',
    matches: [],
  }));

describe('Phase 2 enrichment evidence', () => {
  it('accepts a complete found vehicle listing', () => {
    expect(EnrichmentEvidenceSchema.parse(vehicleFound).outcome).toBe('found');
  });

  it('accepts not-attempted evidence only without a request, body or claim', () => {
    expect(EnrichmentEvidenceSchema.parse(notAttempted).attempts).toBe(0);
    expect(
      EnrichmentEvidenceSchema.safeParse({ ...notAttempted, attempts: 1 })
        .success,
    ).toBe(false);
  });

  it('rejects an unavailable lookup that still makes a claim', () => {
    expect(
      EnrichmentEvidenceSchema.safeParse({
        ...vehicleFound,
        outcome: 'unavailable',
        failureKind: 'timeout',
      }).success,
    ).toBe(false);
    expect(
      EnrichmentEvidenceSchema.parse({
        ...vehicleFound,
        outcome: 'unavailable',
        failureKind: 'timeout',
        retrievedAt: null,
        httpStatus: null,
        rawBody: null,
        rawBodySha256: null,
        attempts: 2,
        claim: null,
      }).failureKind,
    ).toBe('timeout');
  });

  it('keeps the listing claim consistent with the outcome', () => {
    expect(
      EnrichmentEvidenceSchema.safeParse({
        ...vehicleFound,
        outcome: 'not_found',
      }).success,
    ).toBe(false);
  });

  it('rejects an unauthorized endpoint, wrong subject or unlabelled recording', () => {
    expect(
      EnrichmentEvidenceSchema.safeParse({
        ...vehicleFound,
        endpointTemplate: 'https://example.com/{make}',
      }).success,
    ).toBe(false);
    expect(
      EnrichmentEvidenceSchema.safeParse({
        ...vehicleFound,
        subject: { kind: 'zip', zipCode: '90210' },
      }).success,
    ).toBe(false);
    expect(
      EnrichmentEvidenceSchema.safeParse({
        ...vehicleFound,
        evidenceClass: 'recorded',
      }).success,
    ).toBe(false);
  });

  it('records the email check as a local check with its fixed limitation', () => {
    expect(
      EmailCheckSchema.parse({
        schemaVersion: 'email-check-v1',
        emailCheckId: ids.evidence,
        runId: ids.run,
        leadId: ids.lead,
        checkedAt: timestamp,
        syntaxValid: true,
        reservedTestDomain: true,
        domain: 'example.com',
        limitation: 'no mailbox existence, deliverability or ownership claim',
        evidenceClass: 'local-check',
      }).domain,
    ).toBe('example.com');
  });
});

describe('Phase 2 drafts, reviews and verification', () => {
  const revision = {
    schemaVersion: 'outreach-draft-v1',
    draftId: ids.draft,
    revisionId: ids.revision,
    revisionNumber: 1,
    previousRevisionId: null,
    runId: ids.run,
    leadId: ids.lead,
    createdAt: timestamp,
    origin: 'template',
    composerVersion: 'deterministic-template-v1',
    channel: 'email',
    subject: 'Following up on your auto insurance inquiry',
    body: 'Hi Avery,',
    slots: [
      {
        key: 'greeting',
        value: 'Hi ',
        provenance: 'fixed_copy',
        evidenceId: null,
      },
      {
        key: 'givenName',
        value: 'Avery',
        provenance: 'intake',
        evidenceId: null,
      },
    ],
    followUpAction: 'Review today',
    contentSha256: digest,
    verificationResultId: ids.verification,
  } as const;

  it('requires slots for template revisions and none for operator edits', () => {
    expect(OutreachDraftRevisionSchema.parse(revision).revisionNumber).toBe(1);
    expect(
      OutreachDraftRevisionSchema.safeParse({ ...revision, slots: [] }).success,
    ).toBe(false);
    expect(
      OutreachDraftRevisionSchema.parse({
        ...revision,
        revisionNumber: 2,
        previousRevisionId: ids.review,
        origin: 'operator_edit',
        composerVersion: null,
        slots: [],
      }).origin,
    ).toBe('operator_edit');
  });

  it('cites evidence only from verified-evidence slots', () => {
    expect(
      OutreachDraftRevisionSchema.safeParse({
        ...revision,
        slots: [
          {
            key: 'vehicle',
            value: 'x',
            provenance: 'intake',
            evidenceId: ids.evidence,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('binds reviews to the unauthenticated local principal', () => {
    const review = {
      schemaVersion: 'draft-review-v1',
      reviewId: ids.review,
      draftId: ids.draft,
      revisionId: ids.revision,
      runId: ids.run,
      leadId: ids.lead,
      contentSha256: digest,
      decision: 'approved',
      principal: LOCAL_OPERATOR_PRINCIPAL,
      decidedAt: timestamp,
      meaning: 'approved for manual use only; nothing is sent',
    } as const;
    expect(DraftReviewSchema.parse(review).principal.authenticated).toBe(false);
    expect(
      DraftReviewSchema.safeParse({
        ...review,
        principal: { ...LOCAL_OPERATOR_PRINCIPAL, authenticated: true },
      }).success,
    ).toBe(false);
  });

  it('derives the draft and integrity verdicts from the rule outcomes', () => {
    const base = {
      schemaVersion: 'verification-result-v1',
      verificationResultId: ids.verification,
      runId: ids.run,
      leadId: ids.lead,
      scope: 'run',
      revisionId: null,
      rulesVersion: 'verification-rules-v2',
      decisionLanguageVersion: 'decision-language-v1',
      verifiedAt: timestamp,
    } as const;
    expect(
      VerificationResultSchema.parse({
        ...base,
        rules: rules(),
        draftPassed: true,
        integrityPassed: true,
      }).draftPassed,
    ).toBe(true);
    expect(
      VerificationResultSchema.safeParse({
        ...base,
        rules: rules({ 'draft.no_decision_language': 'fail' }),
        draftPassed: true,
        integrityPassed: true,
      }).success,
    ).toBe(false);
    const noDraft = Object.fromEntries(
      VERIFICATION_RULE_IDS.filter(
        (id) => id.startsWith('draft.') || id === 'evidence.claim_bounded',
      ).map((id) => [id, 'not_applicable' as const]),
    );
    expect(
      VerificationResultSchema.parse({
        ...base,
        rules: rules(noDraft),
        draftPassed: null,
        integrityPassed: true,
      }).draftPassed,
    ).toBeNull();
    expect(
      VerificationResultSchema.safeParse({
        ...base,
        rules: rules({ 'events.private': 'fail' }),
        draftPassed: true,
        integrityPassed: true,
      }).success,
    ).toBe(false);
  });
});

describe('metric value contracts', () => {
  it('reports insufficient data instead of zero for empty denominators', () => {
    expect(
      RateValueSchema.parse({
        value: null,
        numerator: 0,
        denominator: 0,
        excluded: 3,
        reason: 'insufficient_data',
      }).value,
    ).toBeNull();
    expect(
      RateValueSchema.safeParse({
        value: 0,
        numerator: 0,
        denominator: 0,
        excluded: 0,
        reason: null,
      }).success,
    ).toBe(false);
    expect(
      DurationSummarySchema.safeParse({
        n: 0,
        medianMs: 0,
        p90Ms: null,
        meanMs: null,
        excluded: 0,
        reason: 'insufficient_data',
      }).success,
    ).toBe(false);
  });
});
