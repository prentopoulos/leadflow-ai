import {
  COMPLIANCE_NOTICE,
  FOLLOW_UP_ACTIONS,
  type DraftReview,
  type DraftSlot,
  type EnrichmentEvidence,
  type OutreachDraftRevision,
  type RevisionState,
  type VerificationResult,
} from './phase2.js';
import type { IntakeSubmission } from './phase1.js';
import { agentParagraphSlotValue, type AgentBriefRecord } from './agents.js';

export const DRAFT_SUBJECT = 'Following up on your auto insurance inquiry';

// Minimum projection the composer may see. Request details, contact fields
// other than the given name, and unverified evidence are never inputs.
export interface ComposerInput {
  givenName: string;
  priority: 'high' | 'standard' | 'nurture';
  needTimeline: IntakeSubmission['needTimeline'];
  coverageFocus: IntakeSubmission['coverageFocus'];
  requestIntent: IntakeSubmission['requestIntent'];
  vehicle: {
    evidenceId: string;
    modelYear: number;
    make: string;
    modelName: string;
  } | null;
  location: {
    evidenceId: string;
    placeName: string;
    stateAbbreviation: string;
  } | null;
  // A drafted agent brief's paragraph; the template places it after the
  // location sentence (PROJECT.md § Phase 5 decisions).
  agentParagraph?: { briefId: string; text: string } | null;
}

export interface ComposedDraft {
  subject: string;
  body: string;
  slots: DraftSlot[];
  followUpAction: (typeof FOLLOW_UP_ACTIONS)[keyof typeof FOLLOW_UP_ACTIONS];
}

const intentPhrases: Record<
  NonNullable<ComposerInput['requestIntent']>,
  string
> = {
  compare_options: ' and comparing your options',
  replace_policy: ' and replacing your current policy',
  new_coverage: ' and starting new coverage',
  learn: ' and learning how coverage works',
};
const timelineSentences: Record<
  NonNullable<ComposerInput['needTimeline']>,
  string
> = {
  within_30_days:
    ' You mentioned you need coverage within the next 30 days, so we would like to help soon.',
  days_31_to_90: ' You mentioned a timeline of one to three months.',
  over_90_days: ' You mentioned a timeline of more than three months.',
  researching: ' You mentioned you are still researching.',
  not_sure: '',
};
const focusPhrases: Record<
  NonNullable<ComposerInput['coverageFocus']>,
  string
> = {
  balanced: ', with a balance of cost and protection',
  lower_cost: ', with an eye on keeping costs down',
  stronger_protection: ', with a focus on stronger protection',
  not_sure: '',
};

// Every fixed sentence the template can emit, by slot key. The verifier uses
// this table to confirm fixed copy was not altered.
export const TEMPLATE_FIXED_COPY = {
  greeting: 'Hi ',
  thanks: ',\n\nThank you for reaching out about auto insurance',
  period: '.',
  closingIntro: '\n\nA member of our team can walk you through your options',
  closing:
    '. Reply to this email if you would like to talk.\n\nThe LeadFlow demo team\n\n',
  notice: COMPLIANCE_NOTICE,
} as const;

// Every phrase the template itself can produce. Text shared with these
// phrases cannot show that request details were copied into a draft.
export const TEMPLATE_PHRASES: readonly string[] = [
  DRAFT_SUBJECT,
  ...Object.values(TEMPLATE_FIXED_COPY),
  ...Object.values(intentPhrases),
  ...Object.values(timelineSentences),
  ...Object.values(focusPhrases),
  ' We have your',
  ' on file for the conversation.',
  ' We see you are in the',
];

function fixed(key: keyof typeof TEMPLATE_FIXED_COPY): DraftSlot {
  return {
    key,
    value: TEMPLATE_FIXED_COPY[key],
    provenance: 'fixed_copy',
    evidenceId: null,
  };
}

function intake(key: string, value: string): DraftSlot[] {
  return value === ''
    ? []
    : [{ key, value, provenance: 'intake', evidenceId: null }];
}

export function vehicleSentence(
  vehicle: NonNullable<ComposerInput['vehicle']>,
) {
  return ` We have your ${vehicle.modelYear} ${vehicle.make} ${vehicle.modelName} on file for the conversation.`;
}

export function locationSentence(
  location: NonNullable<ComposerInput['location']>,
) {
  return ` We see you are in the ${location.placeName}, ${location.stateAbbreviation} area.`;
}

export function composeDraft(input: ComposerInput): ComposedDraft {
  const slots: DraftSlot[] = [
    fixed('greeting'),
    ...intake('givenName', input.givenName),
    fixed('thanks'),
    ...intake(
      'intent',
      input.requestIntent === null ? '' : intentPhrases[input.requestIntent],
    ),
    fixed('period'),
    ...intake(
      'timeline',
      input.needTimeline === null ? '' : timelineSentences[input.needTimeline],
    ),
  ];
  if (input.vehicle !== null) {
    slots.push({
      key: 'vehicle',
      value: vehicleSentence(input.vehicle),
      provenance: 'verified_evidence',
      evidenceId: input.vehicle.evidenceId,
    });
  }
  if (input.location !== null) {
    slots.push({
      key: 'location',
      value: locationSentence(input.location),
      provenance: 'verified_evidence',
      evidenceId: input.location.evidenceId,
    });
  }
  if (input.agentParagraph != null) {
    slots.push({
      key: 'agentParagraph',
      value: agentParagraphSlotValue(input.agentParagraph.text),
      provenance: 'agent_brief',
      evidenceId: input.agentParagraph.briefId,
    });
  }
  slots.push(
    fixed('closingIntro'),
    ...intake(
      'focus',
      input.coverageFocus === null ? '' : focusPhrases[input.coverageFocus],
    ),
    fixed('closing'),
    fixed('notice'),
  );
  return {
    subject: DRAFT_SUBJECT,
    body: slots.map((slot) => slot.value).join(''),
    slots,
    followUpAction: FOLLOW_UP_ACTIONS[input.priority],
  };
}

// Builds the composer projection from stored records. Only `found` evidence
// whose subject matches the lead can contribute; a ZIP with several places
// contributes nothing, because no place is chosen for the lead.
export function composerInputFrom(input: {
  intake: IntakeSubmission;
  priority: ComposerInput['priority'];
  evidence: readonly EnrichmentEvidence[];
  agentBrief?: AgentBriefRecord | null;
}): ComposerInput {
  const vehicleEvidence = input.evidence.find(
    (record) =>
      record.source === 'nhtsa_vpic' &&
      record.outcome === 'found' &&
      record.subject.kind === 'vehicle' &&
      record.subject.make === input.intake.vehicleMake &&
      record.subject.modelYear === input.intake.vehicleYear &&
      record.subject.model === input.intake.vehicleModel,
  );
  const zipEvidence = input.evidence.find(
    (record) =>
      record.source === 'zippopotam_us' &&
      record.outcome === 'found' &&
      record.subject.kind === 'zip' &&
      record.subject.zipCode === input.intake.zipCode,
  );
  const vehicleClaim = vehicleEvidence?.claim;
  const zipClaim = zipEvidence?.claim;
  const onlyPlace =
    zipClaim?.kind === 'zip_places' && zipClaim.places.length === 1
      ? zipClaim.places[0]
      : undefined;
  return {
    givenName: input.intake.givenName,
    priority: input.priority,
    needTimeline: input.intake.needTimeline,
    coverageFocus: input.intake.coverageFocus,
    requestIntent: input.intake.requestIntent,
    vehicle:
      vehicleEvidence !== undefined &&
      vehicleClaim?.kind === 'vehicle_listing' &&
      vehicleClaim.listed &&
      vehicleClaim.modelName !== null &&
      vehicleEvidence.subject.kind === 'vehicle' &&
      vehicleEvidence.subject.make !== null
        ? {
            evidenceId: vehicleEvidence.evidenceId,
            modelYear: vehicleClaim.modelYear,
            make: vehicleEvidence.subject.make,
            modelName: vehicleClaim.modelName,
          }
        : null,
    location:
      zipEvidence !== undefined && onlyPlace !== undefined
        ? {
            evidenceId: zipEvidence.evidenceId,
            placeName: onlyPlace.placeName,
            stateAbbreviation: onlyPlace.stateAbbreviation,
          }
        : null,
    agentParagraph:
      input.agentBrief?.paragraph == null
        ? null
        : {
            briefId: input.agentBrief.briefId,
            text: input.agentBrief.paragraph,
          },
  };
}

// The exact bytes the content digest covers.
export function canonicalDraftContent(subject: string, body: string): string {
  return JSON.stringify({ subject, body });
}

export function deriveRevisionStates(input: {
  revisions: readonly OutreachDraftRevision[];
  reviews: readonly DraftReview[];
  verifications: ReadonlyMap<string, VerificationResult>;
}): Map<string, RevisionState> {
  const latest = input.revisions.reduce<OutreachDraftRevision | null>(
    (current, revision) =>
      current === null || revision.revisionNumber > current.revisionNumber
        ? revision
        : current,
    null,
  );
  const states = new Map<string, RevisionState>();
  for (const revision of input.revisions) {
    if (revision.revisionId !== latest?.revisionId) {
      states.set(revision.revisionId, 'superseded');
      continue;
    }
    const verification = input.verifications.get(revision.verificationResultId);
    if (verification?.draftPassed !== true) {
      states.set(revision.revisionId, 'verification_blocked');
      continue;
    }
    const review = input.reviews.find(
      (candidate) =>
        candidate.revisionId === revision.revisionId &&
        candidate.contentSha256 === revision.contentSha256,
    );
    states.set(revision.revisionId, review?.decision ?? 'pending_review');
  }
  return states;
}
