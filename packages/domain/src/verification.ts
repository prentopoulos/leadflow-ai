import {
  canonicalDraftContent,
  composeDraft,
  composerInputFrom,
  DRAFT_SUBJECT,
  TEMPLATE_PHRASES,
} from './outreach.js';
import {
  ConsentRecordSchema,
  CONTRACT_VERSIONS,
  type IntakeSubmission,
  type LifecycleEvent,
  LifecycleEventSchema,
} from './phase1.js';
import {
  COMPLIANCE_NOTICE,
  ENRICHMENT_ENDPOINTS,
  EnrichmentEvidenceSchema,
  findDecisionLanguage,
  VERIFICATION_RULE_IDS,
  VerificationResultSchema,
  type EnrichmentEvidence,
  type OutreachDraftRevision,
  type RuleResult,
  type VerificationResult,
  type VerificationRuleId,
} from './phase2.js';
import { storedBriefFailures, type AgentBriefRecord } from './agents.js';

export const REQUEST_TEXT_WINDOW = 12;

const normalizeText = (value: string) =>
  value.toLocaleLowerCase('en-US').replace(/\s+/gu, ' ').trim();

const templateText = normalizeText(TEMPLATE_PHRASES.join(' | '));

// True when any run of REQUEST_TEXT_WINDOW characters from the request text
// appears in the draft, after whitespace and case normalization. Runs that the
// template's own fixed phrases contain are ignored: common wording such as
// " would like " proves nothing about copying. So are runs inside the lead's
// structured values (name, vehicle, ZIP) and grounded slot values, which a
// draft may repeat even when the request text mentions them too.
export function containsRequestText(
  draft: string,
  requestDetails: string | null,
  allowed: readonly string[] = [],
): boolean {
  if (requestDetails === null) return false;
  const request = normalizeText(requestDetails);
  const haystack = normalizeText(draft);
  if (request.length < REQUEST_TEXT_WINDOW) return false;
  const known = [templateText, ...allowed.map(normalizeText)].join(' | ');
  for (let start = 0; start + REQUEST_TEXT_WINDOW <= request.length; start++) {
    const window = request.slice(start, start + REQUEST_TEXT_WINDOW);
    if (haystack.includes(window) && !known.includes(window)) {
      return true;
    }
  }
  return false;
}

function structuredValues(intake: IntakeSubmission): string[] {
  const vehicle = [intake.vehicleYear, intake.vehicleMake, intake.vehicleModel]
    .filter((value) => value !== null)
    .join(' ');
  return [
    `${intake.givenName} ${intake.familyName}`,
    intake.email,
    intake.zipCode,
    vehicle,
  ];
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
  // The stored brief an agent slot cites; null when agents did not draft.
  agentBrief?: AgentBriefRecord | null;
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

function containsWord(text: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    'u',
  ).test(text);
}

// Events are strict: every string field except safeError.message is an enum,
// literal, identifier or timestamp, so only that message can carry a lead
// value. Matching whole words there avoids false hits on field names, enum
// values and hex identifiers (a lead named "Trace" or "Mock").
function eventsPrivate(input: VerificationInput): Outcome {
  if (
    input.events.some((event) => !LifecycleEventSchema.safeParse(event).success)
  ) {
    return fail('event_schema_invalid');
  }
  const messages = input.events
    .map((event) => event.safeError?.message ?? '')
    .join(' | ')
    .toLocaleLowerCase('en-US');
  const sensitive = [
    input.intake.email,
    input.intake.givenName,
    input.intake.familyName,
    input.intake.vehicleMake,
    input.intake.vehicleModel,
  ]
    .filter((value): value is string => value !== null && value.length >= 4)
    .map((value) => value.toLocaleLowerCase('en-US'));
  if (sensitive.some((value) => containsWord(messages, value))) {
    return fail('event_contains_lead_value');
  }
  if (containsRequestText(messages, input.intake.requestDetails)) {
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
              agentBrief: input.agentBrief ?? null,
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
      const brief = input.agentBrief ?? null;
      const unbounded = draft.slots.filter((slot) => {
        if (slot.provenance === 'agent_brief') {
          const expected = recomposed?.slots.find(
            (candidate) => candidate.key === slot.key,
          );
          return (
            brief === null ||
            brief.briefId !== slot.evidenceId ||
            brief.runId !== input.runId ||
            brief.leadId !== input.leadId ||
            storedBriefFailures(brief).length > 0 ||
            expected?.value !== slot.value
          );
        }
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
      containsRequestText(text, input.intake.requestDetails, [
        ...structuredValues(input.intake),
        // Model-written text never counts as known wording.
        ...draft.slots
          .filter((slot) => slot.provenance !== 'agent_brief')
          .map((slot) => slot.value),
      ])
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
