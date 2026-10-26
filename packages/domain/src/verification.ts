import {
  canonicalDraftContent,
  composeDraft,
  composerInputFrom,
  DRAFT_SUBJECT,
} from './outreach.js';
import {
  ConsentRecordSchema,
  CONTRACT_VERSIONS,
  type IntakeSubmission,
  type LifecycleEvent,
} from './phase1.js';
import {
  COMPLIANCE_NOTICE,
  DECISION_LANGUAGE_TERMS,
  ENRICHMENT_ENDPOINTS,
  EnrichmentEvidenceSchema,
  VERIFICATION_RULE_IDS,
  VerificationResultSchema,
  type EnrichmentEvidence,
  type OutreachDraftRevision,
  type RuleResult,
  type VerificationResult,
  type VerificationRuleId,
} from './phase2.js';

export const REQUEST_TEXT_WINDOW = 12;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const decisionPatterns = DECISION_LANGUAGE_TERMS.map((term) => ({
  term,
  pattern: new RegExp(
    `\\b${escapeRegExp(term).replace(/ /gu, '\\s+')}\\b`,
    'iu',
  ),
}));

export function findDecisionLanguage(text: string): string[] {
  return decisionPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ term }) => term);
}

const normalizeText = (value: string) =>
  value.toLocaleLowerCase('en-US').replace(/\s+/gu, ' ').trim();

// True when any run of REQUEST_TEXT_WINDOW characters from the request text
// appears in the draft, after whitespace and case normalization.
export function containsRequestText(
  draft: string,
  requestDetails: string | null,
): boolean {
  if (requestDetails === null) return false;
  const request = normalizeText(requestDetails);
  const haystack = normalizeText(draft);
  if (request.length < REQUEST_TEXT_WINDOW) return false;
  for (let start = 0; start + REQUEST_TEXT_WINDOW <= request.length; start++) {
    if (haystack.includes(request.slice(start, start + REQUEST_TEXT_WINDOW))) {
      return true;
    }
  }
  return false;
}

export interface VerificationInput {
  verificationResultId: string;
  runId: string;
  leadId: string;
  verifiedAt: string;
  intake: IntakeSubmission;
  priority: 'high' | 'standard' | 'nurture' | null;
  evidence: readonly EnrichmentEvidence[];
  // sha256 is injected so the domain stays free of Node crypto.
  sha256: (value: string) => string;
  events: readonly LifecycleEvent[];
  draft: OutreachDraftRevision | null;
  scope: 'run' | 'operator_revision';
}

type Outcome = Pick<RuleResult, 'outcome' | 'detail'> & { matches?: string[] };

const pass = (detail = 'checked'): Outcome => ({ outcome: 'pass', detail });
const fail = (detail: string, matches: string[] = []): Outcome => ({
  outcome: 'fail',
  detail,
  matches,
});
const notApplicable = (detail = 'no_draft'): Outcome => ({
  outcome: 'not_applicable',
  detail,
});

function evidenceComplete(input: VerificationInput): Outcome {
  for (const record of input.evidence) {
    if (!EnrichmentEvidenceSchema.safeParse(record).success) {
      return fail('evidence_schema_invalid');
    }
    if (record.runId !== input.runId || record.leadId !== input.leadId) {
      return fail('evidence_identity_mismatch');
    }
    if (
      record.endpointTemplate !== ENRICHMENT_ENDPOINTS[record.source].template
    ) {
      return fail('evidence_endpoint_mismatch');
    }
    if (
      record.rawBody !== null &&
      !record.rawBodyTruncated &&
      input.sha256(record.rawBody) !== record.rawBodySha256
    ) {
      return fail('evidence_digest_mismatch');
    }
    const subject = record.subject;
    const matchesLead =
      subject.kind === 'zip'
        ? subject.zipCode === input.intake.zipCode
        : subject.make === input.intake.vehicleMake &&
          subject.modelYear === input.intake.vehicleYear &&
          subject.model === input.intake.vehicleModel;
    if (!matchesLead) return fail('evidence_subject_mismatch');
  }
  const sources = input.evidence.map((record) => record.source).sort();
  if (sources.join(',') !== 'nhtsa_vpic,zippopotam_us') {
    return fail('evidence_set_incomplete');
  }
  return pass();
}

function eventsPrivate(input: VerificationInput): Outcome {
  const serialized = JSON.stringify(input.events).toLocaleLowerCase('en-US');
  const sensitive = [
    input.intake.email,
    input.intake.givenName,
    input.intake.familyName,
    input.intake.vehicleMake,
    input.intake.vehicleModel,
  ]
    .filter((value): value is string => value !== null && value.length >= 4)
    .map((value) => value.toLocaleLowerCase('en-US'));
  if (sensitive.some((value) => serialized.includes(value))) {
    return fail('event_contains_lead_value');
  }
  if (containsRequestText(serialized, input.intake.requestDetails)) {
    return fail('event_contains_request_text');
  }
  return pass();
}

export function verifyOutputs(input: VerificationInput): VerificationResult {
  const draft = input.draft;
  const outcomes = new Map<VerificationRuleId, Outcome>();
  outcomes.set('evidence.complete', evidenceComplete(input));

  if (draft === null) {
    for (const id of VERIFICATION_RULE_IDS) {
      if (id.startsWith('draft.') || id === 'evidence.claim_bounded') {
        outcomes.set(id, notApplicable());
      }
    }
  } else {
    const text = `${draft.subject}\n${draft.body}`;
    const template = draft.origin === 'template';
    const recomposed =
      template && input.priority !== null
        ? composeDraft(
            composerInputFrom({
              intake: input.intake,
              priority: input.priority,
              evidence: input.evidence,
            }),
          )
        : null;

    if (!template) {
      outcomes.set('evidence.claim_bounded', notApplicable('operator_edited'));
      outcomes.set('draft.slots_grounded', notApplicable('operator_edited'));
    } else {
      const evidenceById = new Map(
        input.evidence.map((record) => [record.evidenceId, record]),
      );
      const unbounded = draft.slots.filter((slot) => {
        if (slot.provenance !== 'verified_evidence') return false;
        const record =
          slot.evidenceId === null
            ? undefined
            : evidenceById.get(slot.evidenceId);
        const expected = recomposed?.slots.find(
          (candidate) =>
            candidate.key === slot.key &&
            candidate.evidenceId === slot.evidenceId,
        );
        return (
          record === undefined ||
          record.outcome !== 'found' ||
          expected?.value !== slot.value
        );
      });
      outcomes.set(
        'evidence.claim_bounded',
        unbounded.length === 0
          ? pass()
          : fail(
              'unverified_claim',
              unbounded.map((slot) => slot.key),
            ),
      );
      const grounded =
        recomposed !== null &&
        draft.subject === DRAFT_SUBJECT &&
        draft.body === draft.slots.map((slot) => slot.value).join('') &&
        JSON.stringify(draft.slots) === JSON.stringify(recomposed.slots) &&
        draft.followUpAction === recomposed.followUpAction;
      outcomes.set(
        'draft.slots_grounded',
        grounded ? pass() : fail('slots_not_reproducible'),
      );
    }

    const terms = findDecisionLanguage(text);
    outcomes.set(
      'draft.no_decision_language',
      terms.length === 0
        ? pass()
        : fail('decision_language', terms.slice(0, 10)),
    );
    outcomes.set(
      'draft.no_request_text',
      containsRequestText(text, input.intake.requestDetails)
        ? fail('request_text_present')
        : pass(),
    );
    outcomes.set(
      'draft.consent_present',
      input.intake.emailContactConsent &&
        ConsentRecordSchema.safeParse(input.intake.consentRecord).success
        ? pass()
        : fail('consent_missing'),
    );
    outcomes.set(
      'draft.compliance_notice',
      draft.body.endsWith(COMPLIANCE_NOTICE) ? pass() : fail('notice_altered'),
    );
    if (
      input.sha256(canonicalDraftContent(draft.subject, draft.body)) !==
      draft.contentSha256
    ) {
      outcomes.set('draft.slots_grounded', fail('content_digest_mismatch'));
    }
  }
  outcomes.set('events.private', eventsPrivate(input));

  const rules: RuleResult[] = VERIFICATION_RULE_IDS.map((ruleId) => {
    const outcome = outcomes.get(ruleId) ?? notApplicable('not_evaluated');
    return {
      ruleId,
      outcome: outcome.outcome,
      detail: outcome.detail,
      matches: outcome.matches ?? [],
    };
  });
  const failed = (id: VerificationRuleId) =>
    rules.find((rule) => rule.ruleId === id)?.outcome === 'fail';
  const draftRules = VERIFICATION_RULE_IDS.filter(
    (id) => id.startsWith('draft.') || id === 'evidence.claim_bounded',
  );
  return VerificationResultSchema.parse({
    schemaVersion: CONTRACT_VERSIONS.verificationResult,
    verificationResultId: input.verificationResultId,
    runId: input.runId,
    leadId: input.leadId,
    scope: input.scope,
    revisionId:
      input.scope === 'operator_revision' ? (draft?.revisionId ?? null) : null,
    rulesVersion: CONTRACT_VERSIONS.verificationRules,
    decisionLanguageVersion: CONTRACT_VERSIONS.decisionLanguage,
    verifiedAt: input.verifiedAt,
    rules,
    draftPassed: draft === null ? null : !draftRules.some(failed),
    integrityPassed: !failed('evidence.complete') && !failed('events.private'),
  });
}
