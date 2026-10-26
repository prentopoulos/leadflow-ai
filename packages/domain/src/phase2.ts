import { z } from 'zod';
import {
  CONTRACT_VERSIONS,
  DraftSkipReasonSchema,
  EnrichmentModeSchema,
  EvidenceCompletenessSchema,
  LeadDocumentSchema,
  LifecycleEventSchema,
  QualificationInterpretationSchema,
  QualificationProjectionSchema,
  QualificationResultSchema,
  RunDocumentSchema,
  RunHoldSchema,
  RunStatusSchema,
  SafeErrorSchema,
  SimulationRecordSchema,
  TEST_EMAIL_DOMAINS,
  WorkflowStepSchema,
} from './phase1.js';

const UtcTimestampSchema = z.iso.datetime();
const IdentifierSchema = z.string().uuid();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

// --- Enrichment -------------------------------------------------------------

export const ENRICHMENT_ENDPOINTS = {
  nhtsa_vpic: {
    host: 'vpic.nhtsa.dot.gov',
    template:
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/{make}/modelyear/{modelYear}?format=json',
    attribution: 'Vehicle data: NHTSA vPIC',
  },
  zippopotam_us: {
    host: 'api.zippopotam.us',
    template: 'https://api.zippopotam.us/us/{zipCode}',
    attribution: 'ZIP data: Zippopotam.us / GeoNames',
  },
} as const;

export const VEHICLE_LISTING_STATEMENT =
  'make/model listed by NHTSA vPIC for that model year' as const;
export const RAW_BODY_LIMIT_BYTES = 65_536;

export const EnrichmentSourceSchema = z.enum(['nhtsa_vpic', 'zippopotam_us']);
export type EnrichmentSource = z.infer<typeof EnrichmentSourceSchema>;
export const EnrichmentOutcomeSchema = z.enum([
  'found',
  'not_found',
  'unavailable',
  'not_attempted',
]);
export type EnrichmentOutcome = z.infer<typeof EnrichmentOutcomeSchema>;
export const EnrichmentFailureKindSchema = z.enum([
  'timeout',
  'network',
  'rate_limited',
  'server_error',
  'client_error',
  'malformed',
  'not_recorded',
]);
export type EnrichmentFailureKind = z.infer<typeof EnrichmentFailureKindSchema>;

export const VehicleSubjectSchema = z
  .object({
    kind: z.literal('vehicle'),
    make: z.string().trim().min(1).max(80).nullable(),
    modelYear: z.number().int().min(1981).max(2027).nullable(),
    model: z.string().trim().min(1).max(80).nullable(),
  })
  .strict();
export const ZipSubjectSchema = z
  .object({
    kind: z.literal('zip'),
    zipCode: z.string().regex(/^\d{5}$/u),
  })
  .strict();

export const VehicleListingClaimSchema = z
  .object({
    kind: z.literal('vehicle_listing'),
    listed: z.boolean(),
    makeName: z.string().min(1).max(120).nullable(),
    modelName: z.string().min(1).max(120).nullable(),
    modelYear: z.number().int().min(1981).max(2027),
    statement: z.literal(VEHICLE_LISTING_STATEMENT),
  })
  .strict();
export const ZipPlacesClaimSchema = z
  .object({
    kind: z.literal('zip_places'),
    zipCode: z.string().regex(/^\d{5}$/u),
    places: z
      .array(
        z
          .object({
            placeName: z.string().min(1).max(120),
            state: z.string().min(1).max(80),
            stateAbbreviation: z.string().regex(/^[A-Z]{2}$/u),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export const EnrichmentClaimSchema = z.discriminatedUnion('kind', [
  VehicleListingClaimSchema,
  ZipPlacesClaimSchema,
]);
export type EnrichmentClaim = z.infer<typeof EnrichmentClaimSchema>;

export const EnrichmentEvidenceSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.enrichmentEvidence),
    evidenceId: IdentifierSchema,
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    source: EnrichmentSourceSchema,
    endpointTemplate: z.string().min(1).max(200),
    subject: z.discriminatedUnion('kind', [
      VehicleSubjectSchema,
      ZipSubjectSchema,
    ]),
    requestedAt: UtcTimestampSchema.nullable(),
    retrievedAt: UtcTimestampSchema.nullable(),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    outcome: EnrichmentOutcomeSchema,
    failureKind: EnrichmentFailureKindSchema.nullable(),
    notAttemptedReason: z.literal('missing_vehicle_fields').nullable(),
    attempts: z.number().int().min(0).max(2),
    evidenceClass: EnrichmentModeSchema,
    recordedCapturedAt: UtcTimestampSchema.nullable(),
    rawBody: z.string().max(RAW_BODY_LIMIT_BYTES).nullable(),
    rawBodyTruncated: z.boolean(),
    rawBodySha256: Sha256Schema.nullable(),
    claim: EnrichmentClaimSchema.nullable(),
    attribution: z.enum([
      ENRICHMENT_ENDPOINTS.nhtsa_vpic.attribution,
      ENRICHMENT_ENDPOINTS.zippopotam_us.attribution,
    ]),
    createdAt: UtcTimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string, path: string[] = []) =>
      context.addIssue({ code: 'custom', path, message });
    const endpoint = ENRICHMENT_ENDPOINTS[value.source];
    if (value.endpointTemplate !== endpoint.template) {
      issue('endpoint must match the authorized source template', [
        'endpointTemplate',
      ]);
    }
    if (value.attribution !== endpoint.attribution) {
      issue('attribution must match the source', ['attribution']);
    }
    const subjectKind = value.source === 'nhtsa_vpic' ? 'vehicle' : 'zip';
    if (value.subject.kind !== subjectKind) {
      issue('subject kind must match the source', ['subject']);
    }
    // A recording carries the time its live response was captured; a
    // recorded-mode lookup with no recording (not_recorded) has none.
    if (value.evidenceClass !== 'recorded' && value.recordedCapturedAt !== null) {
      issue('only recorded evidence has a capture time', ['recordedCapturedAt']);
    }
    if (
      value.evidenceClass === 'recorded' &&
      value.httpStatus !== null &&
      value.recordedCapturedAt === null
    ) {
      issue('recorded responses require their capture time', [
        'recordedCapturedAt',
      ]);
    }
    if (value.outcome === 'not_attempted') {
      if (
        value.attempts !== 0 ||
        value.requestedAt !== null ||
        value.retrievedAt !== null ||
        value.httpStatus !== null ||
        value.rawBody !== null ||
        value.rawBodySha256 !== null ||
        value.claim !== null ||
        value.failureKind !== null ||
        value.notAttemptedReason === null
      ) {
        issue('not_attempted evidence records no request, body or claim');
      }
      return;
    }
    if (value.notAttemptedReason !== null) {
      issue('only not_attempted evidence has a not-attempted reason');
    }
    if (value.attempts < 1 || value.requestedAt === null) {
      issue('attempted evidence records at least one request');
    }
    if ((value.rawBody === null) !== (value.rawBodySha256 === null)) {
      issue('a stored body requires its digest', ['rawBodySha256']);
    }
    if (value.rawBody === null && value.rawBodyTruncated) {
      issue('an absent body cannot be truncated', ['rawBodyTruncated']);
    }
    if (value.outcome === 'unavailable') {
      if (value.failureKind === null || value.claim !== null) {
        issue('unavailable evidence names a failure kind and makes no claim');
      }
      return;
    }
    if (value.failureKind !== null || value.retrievedAt === null) {
      issue('answered evidence has a retrieval time and no failure kind');
    }
    if (value.rawBody === null) {
      issue('answered evidence retains its response body', ['rawBody']);
    }
    if (value.source === 'nhtsa_vpic') {
      if (value.claim?.kind !== 'vehicle_listing') {
        issue('answered vPIC evidence carries a vehicle listing claim', [
          'claim',
        ]);
      } else if (value.claim.listed !== (value.outcome === 'found')) {
        issue('vehicle listing must agree with the outcome', ['claim']);
      }
    } else if (value.outcome === 'found') {
      if (value.claim?.kind !== 'zip_places') {
        issue('found ZIP evidence carries its places', ['claim']);
      }
    } else if (value.claim !== null) {
      issue('not_found ZIP evidence makes no claim', ['claim']);
    }
  });
export type EnrichmentEvidence = z.infer<typeof EnrichmentEvidenceSchema>;

export const EMAIL_CHECK_LIMITATION =
  'no mailbox existence, deliverability or ownership claim' as const;

export const EmailCheckSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.emailCheck),
    emailCheckId: IdentifierSchema,
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    checkedAt: UtcTimestampSchema,
    syntaxValid: z.literal(true),
    reservedTestDomain: z.literal(true),
    domain: z.enum(TEST_EMAIL_DOMAINS),
    limitation: z.literal(EMAIL_CHECK_LIMITATION),
    evidenceClass: z.literal('local-check'),
  })
  .strict();
export type EmailCheck = z.infer<typeof EmailCheckSchema>;

// --- Outreach drafts ----------------------------------------------------------

export const FOLLOW_UP_ACTIONS = {
  high: 'Review today',
  standard: 'Review this week',
  nurture: 'Add to nurture list',
} as const;
export const FollowUpActionSchema = z.enum([
  FOLLOW_UP_ACTIONS.high,
  FOLLOW_UP_ACTIONS.standard,
  FOLLOW_UP_ACTIONS.nurture,
]);

export const COMPLIANCE_NOTICE =
  '[Not sendable as written. Before any send, CAN-SPAM requires an advertisement disclosure, a valid physical postal address and a working opt-out.]' as const;

export const LOCAL_OPERATOR_PRINCIPAL = {
  id: 'local-operator',
  label: 'Local operator (unauthenticated)',
  authenticated: false,
} as const;
export const LocalOperatorPrincipalSchema = z
  .object({
    id: z.literal(LOCAL_OPERATOR_PRINCIPAL.id),
    label: z.literal(LOCAL_OPERATOR_PRINCIPAL.label),
    authenticated: z.literal(false),
  })
  .strict();

export const SlotProvenanceSchema = z.enum([
  'intake',
  'verified_evidence',
  'fixed_copy',
]);
export const DraftSlotSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-zA-Z]{1,40}$/u),
    value: z.string().max(600),
    provenance: SlotProvenanceSchema,
    evidenceId: IdentifierSchema.nullable(),
  })
  .strict()
  .refine(
    (slot) =>
      (slot.provenance === 'verified_evidence') === (slot.evidenceId !== null),
    {
      path: ['evidenceId'],
      message: 'only verified-evidence slots cite evidence',
    },
  );
export type DraftSlot = z.infer<typeof DraftSlotSchema>;

export const OutreachDraftRevisionSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.outreachDraft),
    draftId: IdentifierSchema,
    revisionId: IdentifierSchema,
    revisionNumber: z.number().int().min(1).max(50),
    previousRevisionId: IdentifierSchema.nullable(),
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    createdAt: UtcTimestampSchema,
    origin: z.enum(['template', 'operator_edit']),
    composerVersion: z.literal(CONTRACT_VERSIONS.composer).nullable(),
    channel: z.literal('email'),
    subject: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(4_000),
    slots: z.array(DraftSlotSchema).max(20),
    followUpAction: FollowUpActionSchema,
    contentSha256: Sha256Schema,
    verificationResultId: IdentifierSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const template = value.origin === 'template';
    if (template !== (value.composerVersion !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['composerVersion'],
        message: 'only template revisions name a composer',
      });
    }
    if (template !== value.slots.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['slots'],
        message: 'template revisions carry slots; operator edits do not',
      });
    }
    if ((value.revisionNumber === 1) !== (value.previousRevisionId === null)) {
      context.addIssue({
        code: 'custom',
        path: ['previousRevisionId'],
        message: 'only the first revision has no predecessor',
      });
    }
  });
export type OutreachDraftRevision = z.infer<typeof OutreachDraftRevisionSchema>;

export const DraftReviewSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.draftReview),
    reviewId: IdentifierSchema,
    draftId: IdentifierSchema,
    revisionId: IdentifierSchema,
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    contentSha256: Sha256Schema,
    decision: z.enum(['approved', 'rejected']),
    principal: LocalOperatorPrincipalSchema,
    decidedAt: UtcTimestampSchema,
    meaning: z.literal('approved for manual use only; nothing is sent'),
  })
  .strict();
export type DraftReview = z.infer<typeof DraftReviewSchema>;

export const RevisionStateSchema = z.enum([
  'verification_blocked',
  'pending_review',
  'approved',
  'rejected',
  'superseded',
]);
export type RevisionState = z.infer<typeof RevisionStateSchema>;

// --- Verification ------------------------------------------------------------

export const VERIFICATION_RULE_IDS = [
  'evidence.complete',
  'evidence.claim_bounded',
  'draft.slots_grounded',
  'draft.no_decision_language',
  'draft.no_request_text',
  'draft.consent_present',
  'draft.compliance_notice',
  'events.private',
] as const;
export const VerificationRuleIdSchema = z.enum(VERIFICATION_RULE_IDS);
export type VerificationRuleId = z.infer<typeof VerificationRuleIdSchema>;

// Words that would turn marketing follow-up into an insurance decision.
export const DECISION_LANGUAGE_TERMS = [
  'quote',
  'quotes',
  'price',
  'prices',
  'pricing',
  'premium',
  'premiums',
  'rate',
  'rates',
  'savings',
  'save',
  'eligible',
  'eligibility',
  'approved for coverage',
  'underwriting',
  'underwrite',
  'guarantee',
  'guaranteed',
  'risk',
] as const;

export const RuleResultSchema = z
  .object({
    ruleId: VerificationRuleIdSchema,
    outcome: z.enum(['pass', 'fail', 'not_applicable']),
    detail: z.string().regex(/^[a-z_]{1,80}$/u),
    matches: z.array(z.string().min(1).max(40)).max(10),
  })
  .strict();
export type RuleResult = z.infer<typeof RuleResultSchema>;

export const VerificationResultSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.verificationResult),
    verificationResultId: IdentifierSchema,
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    scope: z.enum(['run', 'operator_revision']),
    revisionId: IdentifierSchema.nullable(),
    rulesVersion: z.literal(CONTRACT_VERSIONS.verificationRules),
    decisionLanguageVersion: z.literal(CONTRACT_VERSIONS.decisionLanguage),
    verifiedAt: UtcTimestampSchema,
    rules: z.array(RuleResultSchema).length(VERIFICATION_RULE_IDS.length),
    draftPassed: z.boolean().nullable(),
    integrityPassed: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.rules.map((rule) => rule.ruleId);
    if (!VERIFICATION_RULE_IDS.every((id, index) => ids[index] === id)) {
      context.addIssue({
        code: 'custom',
        path: ['rules'],
        message: 'rules must appear once each in declared order',
      });
    }
    const failed = (id: VerificationRuleId) =>
      value.rules.find((rule) => rule.ruleId === id)?.outcome === 'fail';
    const integrity = !failed('evidence.complete') && !failed('events.private');
    if (value.integrityPassed !== integrity) {
      context.addIssue({
        code: 'custom',
        path: ['integrityPassed'],
        message: 'integrity must reflect the evidence and event rules',
      });
    }
    const draftRules = VERIFICATION_RULE_IDS.filter(
      (id) => id.startsWith('draft.') || id === 'evidence.claim_bounded',
    );
    const draftApplicable = value.rules.some(
      (rule) =>
        draftRules.includes(rule.ruleId) && rule.outcome !== 'not_applicable',
    );
    const expectedDraft = draftApplicable
      ? !draftRules.some((id) => failed(id))
      : null;
    if (value.draftPassed !== expectedDraft) {
      context.addIssue({
        code: 'custom',
        path: ['draftPassed'],
        message: 'draft verdict must reflect the draft rules',
      });
    }
    if ((value.scope === 'operator_revision') !== (value.revisionId !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['revisionId'],
        message: 'only operator-revision verification names a revision',
      });
    }
  });
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

// --- Workflow state ------------------------------------------------------------

export const QualificationGraphStateSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.graphState),
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    traceId: IdentifierSchema,
    requestId: IdentifierSchema,
    systemBundleId: IdentifierSchema,
    runRevision: z.number().int().nonnegative(),
    projection: QualificationProjectionSchema,
    emailContactConsent: z.boolean(),
    interpretation: QualificationInterpretationSchema.nullable(),
    qualification: QualificationResultSchema.nullable(),
    enrichmentEvidenceIds: z.array(IdentifierSchema).max(2),
    emailCheckId: IdentifierSchema.nullable(),
    draftRevisionId: IdentifierSchema.nullable(),
    verificationResultId: IdentifierSchema.nullable(),
    simulation: SimulationRecordSchema.nullable(),
    safeError: SafeErrorSchema.nullable(),
    finalized: z.boolean(),
  })
  .strict();
export type QualificationGraphState = z.infer<
  typeof QualificationGraphStateSchema
>;

// --- HTTP responses -------------------------------------------------------------

export const DraftViewSchema = z
  .object({
    revisions: z.array(
      z
        .object({
          revision: OutreachDraftRevisionSchema,
          state: RevisionStateSchema,
          verification: VerificationResultSchema,
        })
        .strict(),
    ),
    reviews: z.array(DraftReviewSchema),
    complianceNotice: z.literal(COMPLIANCE_NOTICE),
  })
  .strict();
export type DraftView = z.infer<typeof DraftViewSchema>;

export const RunDetailResponseSchema = z
  .object({
    schemaVersion: z.literal('run-detail-response-v2'),
    lead: LeadDocumentSchema,
    run: RunDocumentSchema,
    events: z.array(LifecycleEventSchema).max(200),
    qualification: QualificationResultSchema.nullable(),
    enrichment: z.array(EnrichmentEvidenceSchema).max(8),
    emailCheck: EmailCheckSchema.nullable(),
    draft: DraftViewSchema.nullable(),
    verification: VerificationResultSchema.nullable(),
    simulation: SimulationRecordSchema.nullable(),
    retrievedAt: UtcTimestampSchema,
    evidenceClass: z.literal('synthetic-local'),
  })
  .strict();
export type RunDetailResponse = z.infer<typeof RunDetailResponseSchema>;

export const DraftStateSummarySchema = z.enum([
  'none',
  'skipped',
  'verification_blocked',
  'pending_review',
  'approved',
  'rejected',
]);
export const LeaseStateSchema = z.enum(['none', 'active', 'expired']);

export const RunSummarySchema = z
  .object({
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    shortLeadId: z.string().regex(/^[a-f0-9]{8}$/u),
    status: RunStatusSchema,
    priority: z.enum(['high', 'standard', 'nurture', 'held', 'not_scored']),
    createdAt: UtcTimestampSchema,
    updatedAt: UtcTimestampSchema,
    attempt: z.number().int().min(0).max(2),
    retryCount: z.number().int().min(0).max(1),
    currentStep: WorkflowStepSchema.nullable(),
    evidenceCompleteness: EvidenceCompletenessSchema,
    enrichmentMode: EnrichmentModeSchema.nullable(),
    draftState: DraftStateSummarySchema,
    draftSkipReason: DraftSkipReasonSchema.nullable(),
    holds: z.array(RunHoldSchema),
    leaseState: LeaseStateSchema,
    resumable: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const RunListFilterSchema = z.enum([
  'all',
  'approval_queue',
  'attention',
]);
export type RunListFilter = z.infer<typeof RunListFilterSchema>;

export const RunListResponseSchema = z
  .object({
    schemaVersion: z.literal('run-list-response-v1'),
    filter: RunListFilterSchema,
    items: z.array(RunSummarySchema).max(50),
    nextCursor: z.string().max(200).nullable(),
    totalMatching: z.number().int().nonnegative(),
    retrievedAt: UtcTimestampSchema,
    evidenceClass: z.literal('synthetic-local'),
  })
  .strict();
export type RunListResponse = z.infer<typeof RunListResponseSchema>;

export const DraftReviewRequestSchema = z
  .object({
    revisionId: IdentifierSchema,
    contentSha256: Sha256Schema,
    decision: z.enum(['approved', 'rejected']),
  })
  .strict();
export const DraftRevisionRequestSchema = z
  .object({
    baseRevisionId: IdentifierSchema,
    baseContentSha256: Sha256Schema,
    subject: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(4_000),
  })
  .strict();
export const DraftActionResponseSchema = z
  .object({
    schemaVersion: z.literal('draft-action-response-v1'),
    runId: IdentifierSchema,
    draft: DraftViewSchema,
  })
  .strict();
export type DraftActionResponse = z.infer<typeof DraftActionResponseSchema>;
