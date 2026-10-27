import { z } from 'zod';
import { ACQUISITION_VERSIONS, AttributionSchema } from './acquisition.js';
import {
  CLOUD_CONFIGURATION_VERSION,
  DeploymentIdentitySchema,
  LOCAL_CONFIGURATION_VERSION,
} from './phase3.js';

export const CONTRACT_VERSIONS = {
  intake: 'intake-v3',
  lead: 'lead-v3',
  run: 'run-v2',
  event: 'event-v2',
  checkpoint: 'checkpoint-v1',
  pendingWrite: 'pending-write-v1',
  idempotency: 'idempotency-v1',
  qualificationProjection: 'qualification-projection-v1',
  interpretation: 'qualification-interpretation-v1',
  graphState: 'phase-2-graph-state-v1',
  rubric: 'rubric-v1',
  simulator: 'simulator-v1',
  systemBundle: 'system-bundle-v4',
  graph: 'phase-2-graph-v1',
  configuration: 'phase-2-local-v1',
  enrichmentEvidence: 'enrichment-evidence-v1',
  enrichmentAdapters: 'enrichment-adapters-v1',
  emailCheck: 'email-check-v1',
  outreachDraft: 'outreach-draft-v1',
  draftReview: 'draft-review-v1',
  composer: 'deterministic-template-v1',
  verificationResult: 'verification-result-v1',
  verificationRules: 'verification-rules-v1',
  decisionLanguage: 'decision-language-v1',
  metricsDefinitions: 'metrics-definitions-v1',
  metricsReport: 'metrics-report-v1',
  channelRules: ACQUISITION_VERSIONS.channelRules,
} as const;

export const LEADFLOW_LOCAL_PROJECT_ID = 'demo-leadflow-ai-local' as const;
export const LOCAL_RESET_CONFIRMATION =
  'DELETE SYNTHETIC LEADFLOW LOCAL DATA' as const;
export const TEST_EMAIL_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
] as const;

export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[\x21-\x7e]+$/u, 'idempotency key must use visible ASCII');

const UtcTimestampSchema = z.iso.datetime();
const IdentifierSchema = z.string().uuid();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const TestEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .refine(
    (value) =>
      TEST_EMAIL_DOMAINS.some((domain) => value.endsWith(`@${domain}`)),
    'email must use an IANA-reserved example domain',
  );

export const NeedTimelineSchema = z.enum([
  'within_30_days',
  'days_31_to_90',
  'over_90_days',
  'researching',
  'not_sure',
]);
export const RequestIntentSchema = z.enum([
  'compare_options',
  'replace_policy',
  'new_coverage',
  'learn',
]);
export const CoverageFocusSchema = z.enum([
  'balanced',
  'lower_cost',
  'stronger_protection',
  'not_sure',
]);

// The server owns consent wording. A submission names the version and the
// SHA-256 of the exact text shown; both must match this table. The digest is
// a constant so the browser bundle needs no hashing; a test recomputes it.
export const CONSENT_WORDINGS = {
  'email-consent-v1': {
    text: 'The fictional lead agrees that a LeadFlow operator may prepare an email about this auto-insurance inquiry for human review. Nothing is sent automatically.',
    sha256: 'ff54a7e1c6739a1b326a32a50fd131632458f0cb62e62808ed77c1e4c400e052',
  },
} as const;
export type ConsentWordingVersion = keyof typeof CONSENT_WORDINGS;
export const CURRENT_CONSENT_WORDING_VERSION: ConsentWordingVersion =
  'email-consent-v1';
export const ConsentWordingVersionSchema = z.enum(['email-consent-v1']);

export const ConsentRecordSchema = z
  .object({
    wordingVersion: ConsentWordingVersionSchema,
    wordingSha256: Sha256Schema,
  })
  .strict()
  .refine(
    (record) =>
      CONSENT_WORDINGS[record.wordingVersion].sha256 === record.wordingSha256,
    {
      path: ['wordingSha256'],
      message: 'consent digest must match the server-owned wording',
    },
  );
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

export function currentConsentRecord(): ConsentRecord {
  return {
    wordingVersion: CURRENT_CONSENT_WORDING_VERSION,
    wordingSha256: CONSENT_WORDINGS[CURRENT_CONSENT_WORDING_VERSION].sha256,
  };
}

export const IntakeSubmissionSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.intake),
    identityClass: z.literal('fictional'),
    givenName: z.string().trim().min(1).max(80),
    familyName: z.string().trim().min(1).max(80),
    email: TestEmailSchema,
    zipCode: z.string().regex(/^\d{5}$/u),
    vehicleYear: z.number().int().min(1981).max(2027).nullable().default(null),
    // The make becomes a vPIC path segment: one with no letter or digit
    // (such as "..") names no make and would not survive URL normalization.
    vehicleMake: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/[\p{L}\p{N}]/u)
      .nullable()
      .default(null),
    vehicleModel: z.string().trim().min(1).max(80).nullable().default(null),
    coverageFocus: CoverageFocusSchema.nullable().default(null),
    requestIntent: RequestIntentSchema.nullable().default(null),
    needTimeline: NeedTimelineSchema.nullable().default(null),
    requestDetails: z.string().trim().max(1_000).nullable().default(null),
    emailContactConsent: z.boolean().default(false),
    consentRecord: ConsentRecordSchema.nullable().default(null),
    // Synthetic LeadFlow simulation data, never a Military.com field.
    attribution: AttributionSchema.nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.emailContactConsent !== (value.consentRecord !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['consentRecord'],
        message: 'a consent record is required exactly when consent is true',
      });
    }
  });
export type IntakeSubmission = z.infer<typeof IntakeSubmissionSchema>;

export const IntakeFieldProvenanceSchema = z
  .object({
    sourceId: z.literal('military-com-auto-landing'),
    sourceUrl: z.literal('https://auto.military.com/'),
    retrievedAt: z.literal('2026-10-24'),
    exactSourceFields: z.tuple([z.literal('zipCode')]),
    demoFields: z.array(
      z.enum([
        'givenName',
        'familyName',
        'email',
        'vehicleYear',
        'vehicleMake',
        'vehicleModel',
        'coverageFocus',
        'requestIntent',
        'needTimeline',
        'requestDetails',
        'emailContactConsent',
      ]),
    ),
    simulatedFields: z.tuple([z.literal('attribution')]),
    parityVerified: z.literal(false),
  })
  .strict();
export type IntakeFieldProvenance = z.infer<typeof IntakeFieldProvenanceSchema>;

export const LeadDocumentSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.lead),
    leadId: IdentifierSchema,
    createdAt: UtcTimestampSchema,
    intake: IntakeSubmissionSchema,
    provenance: IntakeFieldProvenanceSchema,
    evidenceClass: z.literal('synthetic'),
  })
  .strict();
export type LeadDocument = z.infer<typeof LeadDocumentSchema>;

export const SafeErrorSchema = z
  .object({
    code: z.enum([
      'validation_failed',
      'run_not_found',
      'storage_unavailable',
      'transient_interpreter_fault',
      'invariant_failed',
      'checkpoint_missing',
      'checkpoint_incompatible',
      'idempotency_conflict',
      'revision_conflict',
      'lease_active',
      'run_ineligible',
      'reset_denied',
      'access_denied',
      'authentication_required',
      'execution_deadline',
      'draft_not_found',
      'draft_conflict',
      'window_exceeded',
      'unknown_failure',
    ]),
    category: z.enum([
      'validation',
      'storage',
      'runtime',
      'conflict',
      'access',
    ]),
    retryable: z.boolean(),
    message: z.string().min(1).max(240),
  })
  .strict();
export type SafeError = z.infer<typeof SafeErrorSchema>;

export const RunStatusSchema = z.enum([
  'persisted',
  'running',
  'retrying',
  'partial',
  'failed_retryable',
  'failed_terminal',
  'complete',
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const WorkflowStepSchema = z.enum([
  'interpret_qualification',
  'score_qualification',
  'enrich_lead',
  'compose_draft',
  'verify_outputs',
  'simulate_outcome',
  'finalize_run',
]);
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const ExecutionLeaseSchema = z
  .object({
    ownerId: z.string().min(1).max(120),
    claimedAt: UtcTimestampSchema,
    expiresAt: UtcTimestampSchema,
  })
  .strict();

export const EnrichmentModeSchema = z.enum(['live', 'recorded', 'mock']);
export type EnrichmentMode = z.infer<typeof EnrichmentModeSchema>;
export const EvidenceCompletenessSchema = z.enum([
  'not_evaluated',
  'complete',
  'partial',
]);
export const RunHoldSchema = z.enum(['draft_verification_blocked']);
export const DraftSkipReasonSchema = z.enum([
  'no_consent',
  'qualification_held',
]);

export const RunDocumentSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.run),
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    createdAt: UtcTimestampSchema,
    updatedAt: UtcTimestampSchema,
    status: RunStatusSchema,
    revision: z.number().int().nonnegative(),
    nextEventSequence: z.number().int().positive(),
    attempt: z.number().int().min(0).max(2),
    retryCount: z.number().int().min(0).max(1),
    currentStep: WorkflowStepSchema.nullable(),
    completedSteps: z.array(WorkflowStepSchema).max(7),
    lease: ExecutionLeaseSchema.nullable(),
    qualificationResultId: IdentifierSchema.nullable(),
    simulationRecordId: z.string().min(1).max(200).nullable(),
    enrichmentMode: EnrichmentModeSchema.nullable().default(null),
    enrichmentEvidenceIds: z.array(IdentifierSchema).max(2).default([]),
    emailCheckId: IdentifierSchema.nullable().default(null),
    evidenceCompleteness: EvidenceCompletenessSchema.default('not_evaluated'),
    draftId: IdentifierSchema.nullable().default(null),
    draftSkipReason: DraftSkipReasonSchema.nullable().default(null),
    verificationResultId: IdentifierSchema.nullable().default(null),
    holds: z.array(RunHoldSchema).max(1).default([]),
    safeError: SafeErrorSchema.nullable(),
    systemBundleId: IdentifierSchema,
  })
  .strict();
export type RunDocument = z.infer<typeof RunDocumentSchema>;

export const LifecycleEventNameSchema = z.enum([
  'lead.persisted',
  'run.claimed',
  'run.lease_reclaimed',
  'run.resume_requested',
  'step.started',
  'step.completed',
  'step.retry_scheduled',
  'step.failed',
  'simulation.completed',
  'run.completed',
  'run.failed',
  'enrichment.attempt_failed',
  'enrichment.retry_scheduled',
  'enrichment.lookup_completed',
  'email_check.completed',
  'draft.composed',
  'draft.skipped',
  'verification.completed',
  'draft.revised',
  'draft.reviewed',
]);

// External-call telemetry. Field names are camelCase for Firestore field
// paths; OTEL_HTTP_CLIENT_ATTRIBUTES maps them to OpenTelemetry names.
export const ExternalCallTelemetrySchema = z
  .object({
    httpRequestMethod: z.literal('GET'),
    serverAddress: z.enum(['vpic.nhtsa.dot.gov', 'api.zippopotam.us']),
    httpResponseStatusCode: z.number().int().min(100).max(599).nullable(),
    errorType: z
      .enum([
        'timeout',
        'network',
        'rate_limited',
        'server_error',
        'client_error',
        'malformed',
        'not_recorded',
      ])
      .nullable(),
    durationMs: z.number().int().nonnegative(),
    evidenceClass: EnrichmentModeSchema,
  })
  .strict();
export type ExternalCallTelemetry = z.infer<typeof ExternalCallTelemetrySchema>;
export const OTEL_HTTP_CLIENT_ATTRIBUTES = {
  httpRequestMethod: 'http.request.method',
  serverAddress: 'server.address',
  httpResponseStatusCode: 'http.response.status_code',
  errorType: 'error.type',
} as const;

export const LifecycleEventSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.event),
    eventId: IdentifierSchema,
    runId: IdentifierSchema,
    traceId: IdentifierSchema,
    requestId: IdentifierSchema,
    sequence: z.number().int().positive(),
    runRevision: z.number().int().nonnegative(),
    name: LifecycleEventNameSchema,
    occurredAt: UtcTimestampSchema,
    step: WorkflowStepSchema.nullable(),
    status: RunStatusSchema,
    durationMs: z.number().int().nonnegative().nullable(),
    attempt: z.number().int().min(0).max(2),
    retryCount: z.number().int().min(0).max(1),
    authorization: z.enum(['allowed', 'denied', 'not_applicable']),
    safeError: SafeErrorSchema.nullable(),
    systemBundleId: IdentifierSchema,
    evidenceClass: z.literal('synthetic-local'),
    externalCall: ExternalCallTelemetrySchema.nullable().default(null),
    usage: z.null(),
    usageUnavailableReason: z.literal('no_model_or_paid_tool'),
  })
  .strict();
export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;

export const LifecycleRateMetricSchema = z
  .object({
    name: z.literal('stored_run_completion_rate'),
    value: z.number().min(0).max(1).nullable(),
    numerator: z.number().int().nonnegative(),
    denominator: z.number().int().nonnegative(),
    exclusions: z.number().int().nonnegative(),
    window: z.literal('latest_state_of_all_supplied_runs'),
    minimumCount: z.literal(1),
    evidenceClass: z.literal('synthetic-local'),
    reason: z.literal('insufficient_data').nullable(),
  })
  .strict()
  .superRefine((metric, context) => {
    const expected =
      metric.denominator === 0 ? null : metric.numerator / metric.denominator;
    if (metric.value !== expected) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message:
          'completion-rate value must match its numerator and denominator',
      });
    }
    if (
      (metric.denominator === 0) !==
      (metric.reason === 'insufficient_data')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'empty completion-rate denominator requires insufficient_data',
      });
    }
  });

export const LifecycleReportSchema = z
  .object({
    schemaVersion: z.literal('lifecycle-report-v1'),
    generatedAt: UtcTimestampSchema,
    systemBundleId: IdentifierSchema,
    eventSchemaVersion: z.literal(CONTRACT_VERSIONS.event),
    evidenceClass: z.literal('synthetic-local'),
    runCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    statusCounts: z
      .object({
        persisted: z.number().int().nonnegative(),
        running: z.number().int().nonnegative(),
        retrying: z.number().int().nonnegative(),
        partial: z.number().int().nonnegative(),
        failed_retryable: z.number().int().nonnegative(),
        failed_terminal: z.number().int().nonnegative(),
        complete: z.number().int().nonnegative(),
      })
      .strict(),
    completionRate: LifecycleRateMetricSchema,
    runsWithRetry: z.number().int().nonnegative(),
    safeErrorEventCount: z.number().int().nonnegative(),
    duration: z
      .object({
        observedEvents: z.number().int().nonnegative(),
        unavailableEvents: z.number().int().nonnegative(),
        totalMs: z.number().int().nonnegative(),
        meanMs: z.number().nonnegative().nullable(),
        maximumMs: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    usage: z
      .object({
        availableEvents: z.number().int().nonnegative(),
        unavailableEvents: z.number().int().nonnegative(),
        unavailableReason: z.literal('no_model_or_paid_tool').nullable(),
      })
      .strict(),
    privacyBoundary: z.literal(
      'lifecycle metadata only; excludes lead/contact/request/prompt/credential/raw-error payloads',
    ),
    limitations: z.array(z.string().min(1).max(240)).min(1).max(8),
  })
  .strict()
  .superRefine((report, context) => {
    const statusTotal = Object.values(report.statusCounts).reduce(
      (total, count) => total + count,
      0,
    );
    if (statusTotal !== report.runCount) {
      context.addIssue({
        code: 'custom',
        path: ['statusCounts'],
        message: 'latest status counts must equal run count',
      });
    }
    if (
      report.duration.observedEvents + report.duration.unavailableEvents !==
      report.eventCount
    ) {
      context.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'duration coverage must equal event count',
      });
    }
    if (
      report.usage.availableEvents + report.usage.unavailableEvents !==
      report.eventCount
    ) {
      context.addIssue({
        code: 'custom',
        path: ['usage'],
        message: 'usage coverage must equal event count',
      });
    }
  });
export type LifecycleReport = z.infer<typeof LifecycleReportSchema>;

export const SerializedValueSchema = z
  .object({
    type: z.string().min(1).max(80),
    data: z.string().min(1),
  })
  .strict();

export const CheckpointDocumentSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.checkpoint),
    runId: IdentifierSchema,
    threadId: IdentifierSchema,
    namespace: z.string().max(120),
    checkpointId: z.string().min(1).max(200),
    parentCheckpointId: z.string().min(1).max(200).nullable(),
    checkpoint: SerializedValueSchema,
    metadata: SerializedValueSchema,
    channelVersions: z.array(
      z
        .object({
          channel: z.string().min(1),
          version: z.union([z.string(), z.number()]),
        })
        .strict(),
    ),
    systemBundleId: IdentifierSchema,
    createdAt: UtcTimestampSchema,
  })
  .strict();
export type CheckpointDocument = z.infer<typeof CheckpointDocumentSchema>;

export const PendingWriteDocumentSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.pendingWrite),
    runId: IdentifierSchema,
    threadId: IdentifierSchema,
    namespace: z.string().max(120),
    checkpointId: z.string().min(1).max(200),
    taskId: z.string().min(1).max(200),
    taskPath: z.string().max(400),
    writeIndex: z.number().int().min(-4),
    channel: z.string().min(1).max(120),
    value: SerializedValueSchema,
    systemBundleId: IdentifierSchema,
    createdAt: UtcTimestampSchema,
  })
  .strict();
export type PendingWriteDocument = z.infer<typeof PendingWriteDocumentSchema>;

export const IdempotencyRecordSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.idempotency),
    keyDigest: Sha256Schema,
    requestDigest: Sha256Schema,
    leadId: IdentifierSchema,
    runId: IdentifierSchema,
    createdAt: UtcTimestampSchema,
  })
  .strict();
export type IdempotencyRecord = z.infer<typeof IdempotencyRecordSchema>;

export const QUALIFICATION_FIELDS = [
  'givenName',
  'familyName',
  'email',
  'zipCode',
  'vehicleYear',
  'vehicleMake',
  'vehicleModel',
  'coverageFocus',
  'requestIntent',
  'needTimeline',
  'requestDetails',
] as const;
export const QualificationFieldSchema = z.enum(QUALIFICATION_FIELDS);
export type QualificationField = z.infer<typeof QualificationFieldSchema>;
const qualificationFields = QualificationFieldSchema.options;

export const QualificationProjectionSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.qualificationProjection),
    leadId: IdentifierSchema,
    givenName: z.string().trim().min(1).max(80),
    familyName: z.string().trim().min(1).max(80),
    email: TestEmailSchema,
    zipCode: z.string().regex(/^\d{5}$/u),
    vehicleYear: z.number().int().min(1981).max(2027).nullable(),
    vehicleMake: z.string().trim().min(1).max(80).nullable(),
    vehicleModel: z.string().trim().min(1).max(80).nullable(),
    coverageFocus: CoverageFocusSchema.nullable(),
    requestIntent: RequestIntentSchema.nullable(),
    needTimeline: NeedTimelineSchema.nullable(),
    requestDetails: z.string().trim().max(1_000).nullable(),
  })
  .strict();
export type QualificationProjection = z.infer<
  typeof QualificationProjectionSchema
>;

export const QualificationInterpretationSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.interpretation),
    interpreterVersion: z.literal('deterministic-interpreter-v1'),
    leadId: IdentifierSchema,
    interpretedAt: UtcTimestampSchema,
    needTimeline: NeedTimelineSchema.nullable(),
    requestIntent: RequestIntentSchema.nullable(),
    coverageFocus: CoverageFocusSchema.nullable(),
    hasRequestDetails: z.boolean(),
    completeFields: z.array(QualificationFieldSchema),
    missingFields: z.array(QualificationFieldSchema),
    evidenceSource: z.literal('normalized_intake'),
  })
  .strict()
  .superRefine((value, context) => {
    const complete = new Set(value.completeFields);
    const missing = new Set(value.missingFields);
    if (complete.size !== value.completeFields.length) {
      context.addIssue({
        code: 'custom',
        path: ['completeFields'],
        message: 'complete fields must be unique',
      });
    }
    if (missing.size !== value.missingFields.length) {
      context.addIssue({
        code: 'custom',
        path: ['missingFields'],
        message: 'missing fields must be unique',
      });
    }
    for (const field of complete) {
      if (missing.has(field)) {
        context.addIssue({
          code: 'custom',
          path: ['missingFields'],
          message: `${field} cannot be complete and missing`,
        });
      }
    }
    const covered = new Set([...complete, ...missing]);
    if (covered.size !== qualificationFields.length) {
      context.addIssue({
        code: 'custom',
        path: ['missingFields'],
        message:
          'complete and missing fields must partition the qualification projection',
      });
    }
  });
export type QualificationInterpretation = z.infer<
  typeof QualificationInterpretationSchema
>;

export const CriterionComponentSchema = z
  .object({
    component: z.string().min(1).max(80),
    points: z.number().int().nonnegative(),
    evidenceFields: z.array(QualificationFieldSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.points > 0 && value.evidenceFields.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceFields'],
        message: 'positive points require evidence',
      });
    }
  });

const QualificationCriterionSchema = (maximum: number) =>
  z
    .object({
      points: z.number().int().min(0).max(maximum),
      maximum: z.literal(maximum),
      components: z.array(CriterionComponentSchema),
    })
    .strict()
    .superRefine((value, context) => {
      const sum = value.components.reduce(
        (total, component) => total + component.points,
        0,
      );
      if (sum !== value.points) {
        context.addIssue({
          code: 'custom',
          path: ['points'],
          message: `criterion points must equal component sum (${sum})`,
        });
      }
    });

export const QualificationResultSchema = z
  .object({
    schemaVersion: z.literal('qualification-result-v1'),
    rubricVersion: z.literal(CONTRACT_VERSIONS.rubric),
    interpreterVersion: z.literal('deterministic-interpreter-v1'),
    resultId: IdentifierSchema,
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    generatedAt: UtcTimestampSchema,
    classification: z.literal('marketing_readiness'),
    criteria: z
      .object({
        needTimeline: QualificationCriterionSchema(40),
        requestClarity: QualificationCriterionSchema(30),
        completeness: QualificationCriterionSchema(30),
      })
      .strict()
      .nullable(),
    total: z.number().int().min(0).max(100).nullable(),
    priority: z.enum(['high', 'standard', 'nurture']).nullable(),
    missingInformation: z.array(QualificationFieldSchema),
    integrityHold: z
      .object({
        code: z.literal('invalid_qualification_evidence'),
        message: z.string().min(1).max(240),
      })
      .strict()
      .nullable(),
    meaning: z.literal('marketing readiness only; not an insurance decision'),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.integrityHold) {
      if (
        value.criteria !== null ||
        value.total !== null ||
        value.priority !== null
      ) {
        context.addIssue({
          code: 'custom',
          message: 'held results cannot expose score or priority',
        });
      }
      return;
    }
    if (
      value.criteria === null ||
      value.total === null ||
      value.priority === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'scored results require criteria, total, and priority',
      });
      return;
    }
    const sum =
      value.criteria.needTimeline.points +
      value.criteria.requestClarity.points +
      value.criteria.completeness.points;
    if (sum !== value.total) {
      context.addIssue({
        code: 'custom',
        path: ['total'],
        message: `total must equal criterion sum (${sum})`,
      });
    }
  });
export type QualificationResult = z.infer<typeof QualificationResultSchema>;

export const SimulationRecordSchema = z
  .object({
    schemaVersion: z.literal('simulation-record-v1'),
    simulatorVersion: z.literal(CONTRACT_VERSIONS.simulator),
    seedVersion: z.literal('seed-v1'),
    simulationRecordId: z.string().min(1).max(200),
    runId: IdentifierSchema,
    generatedAt: UtcTimestampSchema,
    seed: z.number().int().nonnegative().max(0xffffffff),
    fixtureClass: z.literal('synthetic'),
    outcome: z
      .object({
        contacted: z.boolean(),
        responded: z.boolean(),
        appointment: z.boolean(),
      })
      .strict(),
    evidenceClass: z.literal('synthetic'),
    notices: z.tuple([z.literal('not_live'), z.literal('not_predictive')]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.outcome.responded && !value.outcome.contacted) {
      context.addIssue({
        code: 'custom',
        path: ['outcome', 'responded'],
        message: 'response requires simulated contact',
      });
    }
    if (value.outcome.appointment && !value.outcome.responded) {
      context.addIssue({
        code: 'custom',
        path: ['outcome', 'appointment'],
        message: 'appointment requires simulated response',
      });
    }
  });
export type SimulationRecord = z.infer<typeof SimulationRecordSchema>;

const UnavailableBoundarySchema = z
  .object({ value: z.null(), reason: z.string().min(1).max(160) })
  .strict();

export const SystemBundleDocumentSchema = z
  .object({
    schemaVersion: z.literal(CONTRACT_VERSIONS.systemBundle),
    systemBundleId: IdentifierSchema,
    createdAt: UtcTimestampSchema,
    code: z
      .object({
        revision: z.string().min(1),
        dirty: z.boolean(),
        sourceDigest: Sha256Schema,
        patchDigest: Sha256Schema.nullable(),
      })
      .strict(),
    lockfileDigest: Sha256Schema,
    fixtures: z
      .object({
        version: z.string().min(1),
        digest: Sha256Schema,
      })
      .strict(),
    versions: z
      .object({
        intake: z.literal(CONTRACT_VERSIONS.intake),
        lead: z.literal(CONTRACT_VERSIONS.lead),
        run: z.literal(CONTRACT_VERSIONS.run),
        event: z.literal(CONTRACT_VERSIONS.event),
        checkpoint: z.literal(CONTRACT_VERSIONS.checkpoint),
        rubric: z.literal(CONTRACT_VERSIONS.rubric),
        interpreter: z.literal('deterministic-interpreter-v1'),
        graph: z.literal(CONTRACT_VERSIONS.graph),
        checkpointer: z.literal('firestore-checkpointer-v1'),
        simulator: z.literal(CONTRACT_VERSIONS.simulator),
        enrichmentAdapters: z.literal(CONTRACT_VERSIONS.enrichmentAdapters),
        composer: z.literal(CONTRACT_VERSIONS.composer),
        verificationRules: z.literal(CONTRACT_VERSIONS.verificationRules),
        decisionLanguage: z.literal(CONTRACT_VERSIONS.decisionLanguage),
        metricsDefinitions: z.literal(CONTRACT_VERSIONS.metricsDefinitions),
        channelRules: z.literal(CONTRACT_VERSIONS.channelRules),
        evaluator: z.string().min(1),
        configuration: z.enum([
          LOCAL_CONFIGURATION_VERSION,
          CLOUD_CONFIGURATION_VERSION,
        ]),
      })
      .strict(),
    environment: z
      .object({
        node: z.string().min(1),
        pnpm: z.string().min(1),
        java: z.string().min(1),
        firebaseCli: z.string().min(1),
        firestoreEmulator: z.string().min(1),
        structurizrCli: z.string().min(1),
        platform: z.string().min(1),
        architecture: z.string().min(1),
      })
      .strict(),
    // system-bundle-v3+: local emulator or the exact hosted deployment.
    deployment: DeploymentIdentitySchema,
    provider: UnavailableBoundarySchema,
    model: UnavailableBoundarySchema,
    prompt: UnavailableBoundarySchema,
    enrichmentMode: EnrichmentModeSchema,
    liveToolContracts: z
      .object({
        hosts: z.tuple([
          z.literal('vpic.nhtsa.dot.gov'),
          z.literal('api.zippopotam.us'),
        ]),
        authorization: z.literal(
          'owner-authorized read-only GET, 2026-10-25 (PROJECT.md Phase 2 decisions)',
        ),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const expected =
      value.deployment.mode === 'cloud'
        ? CLOUD_CONFIGURATION_VERSION
        : LOCAL_CONFIGURATION_VERSION;
    if (value.versions.configuration !== expected) {
      context.addIssue({
        code: 'custom',
        path: ['versions', 'configuration'],
        message: 'configuration version must match the deployment mode',
      });
    }
    // Hosted demonstrations are recorded-only and built from a clean commit.
    if (
      value.deployment.mode === 'cloud' &&
      (value.enrichmentMode !== 'recorded' || value.code.dirty)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['deployment'],
        message: 'a hosted bundle is clean and recorded-only',
      });
    }
  });
export type SystemBundleDocument = z.infer<typeof SystemBundleDocumentSchema>;

export const IntakeAcceptedResponseSchema = z
  .object({
    schemaVersion: z.literal('intake-response-v1'),
    leadId: IdentifierSchema,
    runId: IdentifierSchema,
    runRevision: z.number().int().nonnegative(),
    replayed: z.boolean(),
    committedAt: UtcTimestampSchema,
    evidenceClass: z.literal('synthetic-local'),
  })
  .strict();
export type IntakeAcceptedResponse = z.infer<
  typeof IntakeAcceptedResponseSchema
>;

export const ResumeResponseSchema = z
  .object({
    schemaVersion: z.literal('resume-response-v1'),
    runId: IdentifierSchema,
    revision: z.number().int().nonnegative(),
    status: RunStatusSchema,
    replayed: z.boolean(),
  })
  .strict();
export type ResumeResponse = z.infer<typeof ResumeResponseSchema>;

// Hosted request-bound execution. `deadline` means the workflow stopped
// starting steps at its budget and the stored run explains where it stopped.
export const ExecuteResponseSchema = z
  .object({
    schemaVersion: z.literal('execute-response-v1'),
    runId: IdentifierSchema,
    revision: z.number().int().nonnegative(),
    status: RunStatusSchema,
    outcome: z.enum(['finished', 'deadline']),
  })
  .strict();
export type ExecuteResponse = z.infer<typeof ExecuteResponseSchema>;

export const LocalResetRequestSchema = z
  .object({
    projectId: z.literal(LEADFLOW_LOCAL_PROJECT_ID),
    confirmation: z.literal(LOCAL_RESET_CONFIRMATION),
  })
  .strict();

export const LocalResetResponseSchema = z
  .object({
    schemaVersion: z.literal('local-reset-response-v1'),
    projectId: z.literal(LEADFLOW_LOCAL_PROJECT_ID),
    firestoreHost: z.literal('127.0.0.1:8080'),
    evidenceClass: z.literal('synthetic-local'),
    deleted: z.literal(true),
  })
  .strict();

export const ErrorResponseSchema = z
  .object({
    schemaVersion: z.literal('error-response-v1'),
    error: SafeErrorSchema,
    requestId: IdentifierSchema,
  })
  .strict();
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
