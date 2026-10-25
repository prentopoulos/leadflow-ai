import { z } from 'zod';

export const PHASE_ONE_VERSIONS = {
  intake: 'intake-v1',
  lead: 'lead-v1',
  run: 'run-v1',
  event: 'event-v1',
  checkpoint: 'checkpoint-v1',
  pendingWrite: 'pending-write-v1',
  idempotency: 'idempotency-v1',
  qualificationProjection: 'qualification-projection-v1',
  interpretation: 'qualification-interpretation-v1',
  graphState: 'qualification-graph-state-v1',
  rubric: 'rubric-v1',
  simulator: 'simulator-v1',
  systemBundle: 'system-bundle-v1',
} as const;

export const LEADFLOW_LOCAL_PROJECT_ID = 'demo-leadflow-ai-local' as const;
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

export const IntakeSubmissionSchema = z
  .object({
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.intake),
    identityClass: z.literal('fictional'),
    givenName: z.string().trim().min(1).max(80),
    familyName: z.string().trim().min(1).max(80),
    email: TestEmailSchema,
    zipCode: z.string().regex(/^\d{5}$/u),
    vehicleYear: z.number().int().min(1981).max(2027).nullable().default(null),
    vehicleMake: z.string().trim().min(1).max(80).nullable().default(null),
    vehicleModel: z.string().trim().min(1).max(80).nullable().default(null),
    coverageFocus: CoverageFocusSchema.nullable().default(null),
    requestIntent: RequestIntentSchema.nullable().default(null),
    needTimeline: NeedTimelineSchema.nullable().default(null),
    requestDetails: z.string().trim().max(1_000).nullable().default(null),
    emailContactConsent: z.boolean().default(false),
  })
  .strict();
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
    parityVerified: z.literal(false),
  })
  .strict();
export type IntakeFieldProvenance = z.infer<typeof IntakeFieldProvenanceSchema>;

export const LeadDocumentSchema = z
  .object({
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.lead),
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
      'unknown_failure',
    ]),
    category: z.enum(['validation', 'storage', 'runtime', 'conflict']),
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

export const RunDocumentSchema = z
  .object({
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.run),
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
    completedSteps: z.array(WorkflowStepSchema).max(4),
    lease: ExecutionLeaseSchema.nullable(),
    qualificationResultId: IdentifierSchema.nullable(),
    simulationRecordId: z.string().min(1).max(200).nullable(),
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
]);

export const LifecycleEventSchema = z
  .object({
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.event),
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
    usage: z.null(),
    usageUnavailableReason: z.literal('no_model_or_paid_tool'),
  })
  .strict();
export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;

export const SerializedValueSchema = z
  .object({
    type: z.string().min(1).max(80),
    data: z.string().min(1),
  })
  .strict();

export const CheckpointDocumentSchema = z
  .object({
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.checkpoint),
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
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.pendingWrite),
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
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.idempotency),
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
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.qualificationProjection),
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
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.interpretation),
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
    rubricVersion: z.literal(PHASE_ONE_VERSIONS.rubric),
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
    simulatorVersion: z.literal(PHASE_ONE_VERSIONS.simulator),
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

export const QualificationGraphStateSchema = z
  .object({
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.graphState),
    runId: IdentifierSchema,
    leadId: IdentifierSchema,
    traceId: IdentifierSchema,
    requestId: IdentifierSchema,
    systemBundleId: IdentifierSchema,
    runRevision: z.number().int().nonnegative(),
    projection: QualificationProjectionSchema,
    interpretation: QualificationInterpretationSchema.nullable(),
    qualification: QualificationResultSchema.nullable(),
    simulation: SimulationRecordSchema.nullable(),
    safeError: SafeErrorSchema.nullable(),
    finalized: z.boolean(),
  })
  .strict();
export type QualificationGraphState = z.infer<
  typeof QualificationGraphStateSchema
>;

const UnavailableBoundarySchema = z
  .object({ value: z.null(), reason: z.string().min(1).max(160) })
  .strict();

export const SystemBundleDocumentSchema = z
  .object({
    schemaVersion: z.literal(PHASE_ONE_VERSIONS.systemBundle),
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
        intake: z.literal(PHASE_ONE_VERSIONS.intake),
        lead: z.literal(PHASE_ONE_VERSIONS.lead),
        run: z.literal(PHASE_ONE_VERSIONS.run),
        event: z.literal(PHASE_ONE_VERSIONS.event),
        checkpoint: z.literal(PHASE_ONE_VERSIONS.checkpoint),
        rubric: z.literal(PHASE_ONE_VERSIONS.rubric),
        interpreter: z.literal('deterministic-interpreter-v1'),
        graph: z.literal('qualification-graph-v1'),
        checkpointer: z.literal('firestore-checkpointer-v1'),
        simulator: z.literal(PHASE_ONE_VERSIONS.simulator),
        evaluator: z.string().min(1),
        configuration: z.literal('phase-1-local-v1'),
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
        projectId: z.literal(LEADFLOW_LOCAL_PROJECT_ID),
      })
      .strict(),
    provider: UnavailableBoundarySchema,
    model: UnavailableBoundarySchema,
    prompt: UnavailableBoundarySchema,
    liveToolContracts: UnavailableBoundarySchema,
  })
  .strict();
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

export const RunDetailResponseSchema = z
  .object({
    schemaVersion: z.literal('run-detail-response-v1'),
    lead: LeadDocumentSchema,
    run: RunDocumentSchema,
    events: z.array(LifecycleEventSchema).max(200),
    qualification: QualificationResultSchema.nullable(),
    simulation: SimulationRecordSchema.nullable(),
    retrievedAt: UtcTimestampSchema,
    evidenceClass: z.literal('synthetic-local'),
  })
  .strict();
export type RunDetailResponse = z.infer<typeof RunDetailResponseSchema>;

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

export const ErrorResponseSchema = z
  .object({
    schemaVersion: z.literal('error-response-v1'),
    error: SafeErrorSchema,
    requestId: IdentifierSchema,
  })
  .strict();
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
