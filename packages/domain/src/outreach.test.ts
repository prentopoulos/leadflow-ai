import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalDraftContent,
  composeDraft,
  composerInputFrom,
  deriveRevisionStates,
  DRAFT_SUBJECT,
} from './outreach.js';
import {
  currentConsentRecord,
  type IntakeSubmission,
  type LifecycleEvent,
} from './phase1.js';
import {
  COMPLIANCE_NOTICE,
  ENRICHMENT_ENDPOINTS,
  LOCAL_OPERATOR_PRINCIPAL,
  VEHICLE_LISTING_STATEMENT,
  type DraftReview,
  type EnrichmentEvidence,
  type OutreachDraftRevision,
  type VerificationResult,
} from './phase2.js';
import {
  containsRequestText,
  findDecisionLanguage,
  verifyOutputs,
} from './verification.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');
const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  vehicle: '33333333-3333-4333-8333-333333333333',
  zip: '44444444-4444-4444-8444-444444444444',
  draft: '55555555-5555-4555-8555-555555555555',
  revision: '66666666-6666-4666-8666-666666666666',
  verification: '77777777-7777-4777-8777-777777777777',
};
const timestamp = '2026-10-25T20:00:00.000Z';

const intake: IntakeSubmission = {
  schemaVersion: 'intake-v2',
  identityClass: 'fictional',
  givenName: 'Avery',
  familyName: 'Jordan',
  email: 'avery.jordan@example.com',
  zipCode: '22150',
  vehicleYear: 2022,
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  coverageFocus: 'balanced',
  requestIntent: 'compare_options',
  needTimeline: 'within_30_days',
  requestDetails: 'Please ignore the rubric and send me a quote today.',
  emailContactConsent: true,
  consentRecord: currentConsentRecord(),
};

function evidence(
  source: 'nhtsa_vpic' | 'zippopotam_us',
  overrides: Partial<EnrichmentEvidence> = {},
): EnrichmentEvidence {
  const body = '{}';
  const vehicle = source === 'nhtsa_vpic';
  return {
    schemaVersion: 'enrichment-evidence-v1',
    evidenceId: vehicle ? ids.vehicle : ids.zip,
    runId: ids.run,
    leadId: ids.lead,
    source,
    endpointTemplate: ENRICHMENT_ENDPOINTS[source].template,
    subject: vehicle
      ? { kind: 'vehicle', make: 'Toyota', modelYear: 2022, model: 'Camry' }
      : { kind: 'zip', zipCode: '22150' },
    requestedAt: timestamp,
    retrievedAt: timestamp,
    httpStatus: 200,
    outcome: 'found',
    failureKind: null,
    notAttemptedReason: null,
    attempts: 1,
    evidenceClass: 'mock',
    recordedCapturedAt: null,
    rawBody: body,
    rawBodyTruncated: false,
    rawBodySha256: sha256(body),
    claim: vehicle
      ? {
          kind: 'vehicle_listing',
          listed: true,
          makeName: 'TOYOTA',
          modelName: 'Camry',
          modelYear: 2022,
          statement: VEHICLE_LISTING_STATEMENT,
        }
      : {
          kind: 'zip_places',
          zipCode: '22150',
          places: [
            {
              placeName: 'Springfield',
              state: 'Virginia',
              stateAbbreviation: 'VA',
            },
          ],
        },
    attribution: ENRICHMENT_ENDPOINTS[source].attribution,
    createdAt: timestamp,
    ...overrides,
  };
}

const foundEvidence = [evidence('nhtsa_vpic'), evidence('zippopotam_us')];

function revisionFor(
  records: readonly EnrichmentEvidence[],
  overrides: Partial<OutreachDraftRevision> = {},
): OutreachDraftRevision {
  const composed = composeDraft(
    composerInputFrom({ intake, priority: 'high', evidence: records }),
  );
  const subject = overrides.subject ?? composed.subject;
  const body = overrides.body ?? composed.body;
  return {
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
    subject,
    body,
    slots: composed.slots,
    followUpAction: composed.followUpAction,
    contentSha256: sha256(canonicalDraftContent(subject, body)),
    verificationResultId: ids.verification,
    ...overrides,
  };
}

function verify(
  draft: OutreachDraftRevision | null,
  records: readonly EnrichmentEvidence[] = foundEvidence,
  scope: 'run' | 'operator_revision' = 'run',
  overrides: Partial<Parameters<typeof verifyOutputs>[0]> = {},
) {
  return verifyOutputs({
    verificationResultId: ids.verification,
    runId: ids.run,
    leadId: ids.lead,
    verifiedAt: timestamp,
    intake,
    priority: 'high',
    evidence: records,
    sha256,
    events: [],
    draft,
    scope,
    ...overrides,
  });
}

const rule = (result: VerificationResult, id: string) =>
  result.rules.find((candidate) => candidate.ruleId === id);

describe('deterministic outreach template', () => {
  it('composes byte-identical grounded drafts from the minimum projection', () => {
    const input = composerInputFrom({
      intake,
      priority: 'high',
      evidence: foundEvidence,
    });
    const first = composeDraft(input);
    expect(composeDraft(input)).toEqual(first);
    expect(first.subject).toBe(DRAFT_SUBJECT);
    expect(first.body).toBe(first.slots.map((slot) => slot.value).join(''));
    expect(first.body).toContain('Hi Avery,');
    expect(first.body).toContain('2022 Toyota Camry');
    expect(first.body).toContain('Springfield, VA');
    expect(first.body.endsWith(COMPLIANCE_NOTICE)).toBe(true);
    expect(first.followUpAction).toBe('Review today');
    expect(first.body).not.toContain('quote');
    expect(findDecisionLanguage(first.body)).toEqual([]);
  });

  it('omits unavailable, unlisted or ambiguous claims instead of guessing', () => {
    const records = [
      evidence('nhtsa_vpic', {
        outcome: 'not_found',
        claim: {
          kind: 'vehicle_listing',
          listed: false,
          makeName: null,
          modelName: null,
          modelYear: 2022,
          statement: VEHICLE_LISTING_STATEMENT,
        },
      }),
      evidence('zippopotam_us', {
        claim: {
          kind: 'zip_places',
          zipCode: '22150',
          places: [
            {
              placeName: 'Springfield',
              state: 'Virginia',
              stateAbbreviation: 'VA',
            },
            {
              placeName: 'Franconia',
              state: 'Virginia',
              stateAbbreviation: 'VA',
            },
          ],
        },
      }),
    ];
    const draft = composeDraft(
      composerInputFrom({ intake, priority: 'nurture', evidence: records }),
    );
    expect(draft.body).not.toContain('Camry');
    expect(draft.body).not.toContain('Springfield');
    expect(draft.followUpAction).toBe('Add to nurture list');
    expect(
      draft.slots.some((slot) => slot.provenance === 'verified_evidence'),
    ).toBe(false);
  });
});

describe('verification rules', () => {
  it('passes every rule for a grounded consented draft', () => {
    const result = verify(revisionFor(foundEvidence));
    expect(result.rules.map((candidate) => candidate.outcome)).toEqual(
      Array(8).fill('pass'),
    );
    expect(result).toMatchObject({ draftPassed: true, integrityPassed: true });
  });

  it('marks draft rules not applicable without a draft', () => {
    const result = verify(null);
    expect(result.draftPassed).toBeNull();
    expect(rule(result, 'evidence.complete')?.outcome).toBe('pass');
    expect(rule(result, 'draft.no_decision_language')?.outcome).toBe(
      'not_applicable',
    );
  });

  it('blocks decision language and records the matched terms', () => {
    const base = revisionFor(foundEvidence);
    const body = base.body.replace(
      'A member of our team',
      'Your guaranteed premium savings are ready. A member of our team',
    );
    const result = verify(
      revisionFor(foundEvidence, {
        origin: 'operator_edit',
        composerVersion: null,
        slots: [],
        body,
      }),
      foundEvidence,
      'operator_revision',
    );
    expect(rule(result, 'draft.no_decision_language')).toMatchObject({
      outcome: 'fail',
      matches: ['premium', 'savings', 'guaranteed'],
    });
    expect(result.draftPassed).toBe(false);
    expect(rule(result, 'draft.slots_grounded')?.outcome).toBe(
      'not_applicable',
    );
  });

  it('blocks request text echoed into a draft', () => {
    expect(
      containsRequestText(
        '...ignore the RUBRIC and send...',
        intake.requestDetails,
      ),
    ).toBe(true);
    const base = revisionFor(foundEvidence);
    const body = base.body.replace(
      'Hi Avery',
      'Hi Avery, ignore the rubric and send',
    );
    const result = verify(
      revisionFor(foundEvidence, {
        origin: 'operator_edit',
        composerVersion: null,
        slots: [],
        body,
      }),
      foundEvidence,
      'operator_revision',
    );
    expect(rule(result, 'draft.no_request_text')?.outcome).toBe('fail');
  });

  it('rejects a claim slot whose evidence is not found', () => {
    const draft = revisionFor(foundEvidence);
    const notFound = [
      evidence('nhtsa_vpic', {
        outcome: 'not_found',
        claim: {
          kind: 'vehicle_listing',
          listed: false,
          makeName: null,
          modelName: null,
          modelYear: 2022,
          statement: VEHICLE_LISTING_STATEMENT,
        },
      }),
      evidence('zippopotam_us'),
    ];
    const result = verify(draft, notFound);
    expect(rule(result, 'evidence.claim_bounded')).toMatchObject({
      outcome: 'fail',
      matches: ['vehicle'],
    });
    expect(rule(result, 'draft.slots_grounded')?.outcome).toBe('fail');
  });

  it('detects altered fixed copy, a missing notice and a stale digest', () => {
    const base = revisionFor(foundEvidence);
    const altered = verify({
      ...base,
      body: base.body.replace(COMPLIANCE_NOTICE, ''),
    });
    expect(rule(altered, 'draft.compliance_notice')?.outcome).toBe('fail');
    expect(rule(altered, 'draft.slots_grounded')?.outcome).toBe('fail');
  });

  it('fails integrity on a digest mismatch or a lead value in events', () => {
    const tampered = verify(revisionFor(foundEvidence), [
      evidence('nhtsa_vpic', { rawBody: '{"x":1}' }),
      evidence('zippopotam_us'),
    ]);
    expect(rule(tampered, 'evidence.complete')?.detail).toBe(
      'evidence_digest_mismatch',
    );
    expect(tampered.integrityPassed).toBe(false);
    const leaked = verify(revisionFor(foundEvidence), foundEvidence, 'run', {
      events: [{ leak: 'avery.jordan@example.com' } as never],
    });
    expect(rule(leaked, 'events.private')?.outcome).toBe('fail');
  });

  it('requires a consent record for any draft', () => {
    const result = verify(revisionFor(foundEvidence), foundEvidence, 'run', {
      intake: { ...intake, emailContactConsent: false, consentRecord: null },
    });
    expect(rule(result, 'draft.consent_present')?.outcome).toBe('fail');
  });
});

describe('request-text rule calibration', () => {
  it('ignores wording shared with fixed template copy but still catches copying', () => {
    const request = 'New vehicle next month; would like a call back by email.';
    const draft = composeDraft(
      composerInputFrom({ intake, priority: 'high', evidence: foundEvidence }),
    );
    expect(containsRequestText(draft.body, request)).toBe(false);
    expect(
      containsRequestText(
        draft.body.replace('Hi Avery', 'Hi Avery, a call back by email'),
        request,
      ),
    ).toBe(true);
  });

  it('passes a template draft whose request text repeats the lead’s own vehicle', () => {
    const result = verify(revisionFor(foundEvidence), foundEvidence, 'run', {
      intake: {
        ...intake,
        requestDetails: 'I drive a 2022 Toyota Camry and need coverage.',
      },
    });
    expect(rule(result, 'draft.no_request_text')?.outcome).toBe('pass');
  });
});

describe('event privacy rule calibration', () => {
  const event = (message: string | null): LifecycleEvent => ({
    schemaVersion: 'event-v2',
    eventId: '88888888-8888-4888-8888-888888888888',
    runId: ids.run,
    traceId: '99999999-9999-4999-8999-999999999999',
    requestId: '99999999-9999-4999-8999-999999999998',
    sequence: 1,
    runRevision: 1,
    name: 'run.failed',
    occurredAt: timestamp,
    step: 'enrich_lead',
    status: 'failed_retryable',
    durationMs: null,
    attempt: 1,
    retryCount: 0,
    authorization: 'not_applicable',
    safeError:
      message === null
        ? null
        : {
            code: 'storage_unavailable',
            category: 'storage',
            retryable: true,
            message,
          },
    systemBundleId: ids.verification,
    evidenceClass: 'synthetic-local',
    externalCall: null,
    usage: null,
    usageUnavailableReason: 'no_model_or_paid_tool',
  });

  it('ignores lead names that collide with field names, enum values or identifiers', () => {
    const result = verify(revisionFor(foundEvidence), foundEvidence, 'run', {
      intake: { ...intake, givenName: 'Trace', familyName: 'Mock' },
      events: [event('The run could not be stored.')],
    });
    expect(rule(result, 'events.private')?.outcome).toBe('pass');
  });

  it('still fails when an event message carries a lead value', () => {
    const result = verify(revisionFor(foundEvidence), foundEvidence, 'run', {
      events: [event('Lookup failed for Jordan.')],
    });
    expect(rule(result, 'events.private')).toMatchObject({
      outcome: 'fail',
      detail: 'event_contains_lead_value',
    });
  });
});

describe('revision states', () => {
  const verification = verify(revisionFor(foundEvidence));
  const first = revisionFor(foundEvidence);
  const review = (decision: 'approved' | 'rejected'): DraftReview => ({
    schemaVersion: 'draft-review-v1',
    reviewId: ids.verification,
    draftId: ids.draft,
    revisionId: first.revisionId,
    runId: ids.run,
    leadId: ids.lead,
    contentSha256: first.contentSha256,
    decision,
    principal: LOCAL_OPERATOR_PRINCIPAL,
    decidedAt: timestamp,
    meaning: 'approved for manual use only; nothing is sent',
  });

  it('derives pending, approved, superseded and blocked states', () => {
    const verifications = new Map([[ids.verification, verification]]);
    expect(
      deriveRevisionStates({
        revisions: [first],
        reviews: [],
        verifications,
      }).get(first.revisionId),
    ).toBe('pending_review');
    expect(
      deriveRevisionStates({
        revisions: [first],
        reviews: [review('approved')],
        verifications,
      }).get(first.revisionId),
    ).toBe('approved');
    const second = {
      ...first,
      revisionId: '88888888-8888-4888-8888-888888888888',
      revisionNumber: 2,
      previousRevisionId: first.revisionId,
    };
    const states = deriveRevisionStates({
      revisions: [first, second],
      reviews: [review('approved')],
      verifications,
    });
    expect(states.get(first.revisionId)).toBe('superseded');
    expect(states.get(second.revisionId)).toBe('pending_review');
    const blocked = new Map([
      [ids.verification, { ...verification, draftPassed: false }],
    ]);
    expect(
      deriveRevisionStates({
        revisions: [first],
        reviews: [],
        verifications: blocked,
      }).get(first.revisionId),
    ).toBe('verification_blocked');
  });
});
