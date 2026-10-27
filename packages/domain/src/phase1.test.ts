import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CONSENT_WORDINGS,
  CheckpointDocumentSchema,
  ErrorResponseSchema,
  IdempotencyRecordSchema,
  IntakeAcceptedResponseSchema,
  IntakeSubmissionSchema,
  LeadDocumentSchema,
  LifecycleEventSchema,
  PendingWriteDocumentSchema,
  QualificationInterpretationSchema,
  QualificationResultSchema,
  ResumeResponseSchema,
  RunDocumentSchema,
  SimulationRecordSchema,
  SystemBundleDocumentSchema,
  TestEmailSchema,
  currentConsentRecord,
} from './phase1.js';
import { RunDetailResponseSchema } from './phase2.js';

const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  event: '33333333-3333-4333-8333-333333333333',
  trace: '44444444-4444-4444-8444-444444444444',
  request: '55555555-5555-4555-8555-555555555555',
  bundle: '66666666-6666-4666-8666-666666666666',
  result: '77777777-7777-4777-8777-777777777777',
};
const timestamp = '2026-10-24T20:00:00.000Z';
const digest = 'a'.repeat(64);

const intake = {
  schemaVersion: 'intake-v2',
  identityClass: 'fictional',
  givenName: 'Avery',
  familyName: 'Example',
  email: 'avery@example.com',
  zipCode: '10001',
  vehicleYear: 2024,
  vehicleMake: 'Example Motors',
  vehicleModel: 'Demo One',
  coverageFocus: 'balanced',
  requestIntent: 'compare_options',
  needTimeline: 'within_30_days',
  requestDetails: 'Synthetic fixture request.',
  emailContactConsent: false,
} as const;

const provenance = {
  sourceId: 'military-com-auto-landing',
  sourceUrl: 'https://auto.military.com/',
  retrievedAt: '2026-10-24',
  exactSourceFields: ['zipCode'],
  demoFields: [
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
  ],
  parityVerified: false,
} as const;

const lead = {
  schemaVersion: 'lead-v2',
  leadId: ids.lead,
  createdAt: timestamp,
  intake,
  provenance,
  evidenceClass: 'synthetic',
} as const;

const run = {
  schemaVersion: 'run-v2',
  runId: ids.run,
  leadId: ids.lead,
  createdAt: timestamp,
  updatedAt: timestamp,
  status: 'persisted',
  revision: 0,
  nextEventSequence: 2,
  attempt: 0,
  retryCount: 0,
  currentStep: null,
  completedSteps: [],
  lease: null,
  qualificationResultId: null,
  simulationRecordId: null,
  safeError: null,
  systemBundleId: ids.bundle,
} as const;

const event = {
  schemaVersion: 'event-v2',
  eventId: ids.event,
  runId: ids.run,
  traceId: ids.trace,
  requestId: ids.request,
  sequence: 1,
  runRevision: 0,
  name: 'lead.persisted',
  occurredAt: timestamp,
  step: null,
  status: 'persisted',
  durationMs: null,
  attempt: 0,
  retryCount: 0,
  authorization: 'not_applicable',
  safeError: null,
  systemBundleId: ids.bundle,
  evidenceClass: 'synthetic-local',
  externalCall: null,
  usage: null,
  usageUnavailableReason: 'no_model_or_paid_tool',
} as const;

const simulation = {
  schemaVersion: 'simulation-record-v1',
  simulatorVersion: 'simulator-v1',
  seedVersion: 'seed-v1',
  simulationRecordId: `${ids.run}:simulator-v1`,
  runId: ids.run,
  generatedAt: timestamp,
  seed: 42,
  fixtureClass: 'synthetic',
  outcome: { contacted: true, responded: true, appointment: false },
  evidenceClass: 'synthetic',
  notices: ['not_live', 'not_predictive'],
} as const;

describe('Phase 1 and 2 boundary schemas', () => {
  it('accepts only reserved example email domains', () => {
    for (const email of [
      'avery@example.com',
      'avery@example.org',
      'avery@example.net',
    ]) {
      expect(TestEmailSchema.parse(email)).toBe(email);
    }
    expect(TestEmailSchema.safeParse('avery@real.test').success).toBe(false);
  });

  it('rejects a vehicle make with no letter or digit', () => {
    for (const vehicleMake of ['.', '..', ' --- ']) {
      expect(
        IntakeSubmissionSchema.safeParse({ ...intake, vehicleMake }).success,
      ).toBe(false);
    }
    expect(
      IntakeSubmissionSchema.safeParse({
        ...intake,
        vehicleMake: 'Mercedes-Benz',
      }).success,
    ).toBe(true);
  });

  it('normalizes omitted consent and optional inputs without accepting extras', () => {
    const parsed = IntakeSubmissionSchema.parse({
      schemaVersion: 'intake-v2',
      identityClass: 'fictional',
      givenName: 'Avery',
      familyName: 'Example',
      email: 'AVERY@EXAMPLE.COM',
      zipCode: '10001',
    });
    expect(parsed).toMatchObject({
      email: 'avery@example.com',
      vehicleYear: null,
      emailContactConsent: false,
    });
    expect(
      IntakeSubmissionSchema.safeParse({ ...intake, unexpected: true }).success,
    ).toBe(false);
  });

  it('pins the consent wording digest to the exact server-owned text', () => {
    for (const wording of Object.values(CONSENT_WORDINGS)) {
      expect(
        createHash('sha256').update(wording.text, 'utf8').digest('hex'),
      ).toBe(wording.sha256);
    }
  });

  it('requires a matching consent record exactly when consent is true', () => {
    const consented = IntakeSubmissionSchema.parse({
      ...intake,
      emailContactConsent: true,
      consentRecord: currentConsentRecord(),
    });
    expect(consented.consentRecord?.wordingVersion).toBe('email-consent-v1');
    expect(
      IntakeSubmissionSchema.safeParse({ ...intake, emailContactConsent: true })
        .success,
    ).toBe(false);
    expect(
      IntakeSubmissionSchema.safeParse({
        ...intake,
        consentRecord: currentConsentRecord(),
      }).success,
    ).toBe(false);
    expect(
      IntakeSubmissionSchema.safeParse({
        ...intake,
        emailContactConsent: true,
        consentRecord: {
          wordingVersion: 'email-consent-v1',
          wordingSha256: digest,
        },
      }).success,
    ).toBe(false);
    expect(
      IntakeSubmissionSchema.safeParse({
        ...intake,
        schemaVersion: 'intake-v1',
      }).success,
    ).toBe(false);
  });

  it('validates lead, run, event, checkpoint, pending-write, and idempotency records', () => {
    expect(LeadDocumentSchema.parse(lead).leadId).toBe(ids.lead);
    expect(RunDocumentSchema.parse(run)).toMatchObject({
      status: 'persisted',
      evidenceCompleteness: 'not_evaluated',
      enrichmentEvidenceIds: [],
      holds: [],
    });
    expect(LifecycleEventSchema.parse(event).sequence).toBe(1);
    expect(
      CheckpointDocumentSchema.parse({
        schemaVersion: 'checkpoint-v1',
        runId: ids.run,
        threadId: ids.run,
        namespace: '',
        checkpointId: 'checkpoint-1',
        parentCheckpointId: null,
        checkpoint: { type: 'json', data: '{}' },
        metadata: { type: 'json', data: '{}' },
        channelVersions: [{ channel: '__start__', version: 1 }],
        systemBundleId: ids.bundle,
        createdAt: timestamp,
      }).checkpointId,
    ).toBe('checkpoint-1');
    expect(
      PendingWriteDocumentSchema.parse({
        schemaVersion: 'pending-write-v1',
        runId: ids.run,
        threadId: ids.run,
        namespace: '',
        checkpointId: 'checkpoint-1',
        taskId: 'task-1',
        taskPath: '',
        writeIndex: 0,
        channel: 'state',
        value: { type: 'json', data: '{}' },
        systemBundleId: ids.bundle,
        createdAt: timestamp,
      }).writeIndex,
    ).toBe(0);
    expect(
      IdempotencyRecordSchema.parse({
        schemaVersion: 'idempotency-v1',
        keyDigest: digest,
        requestDigest: digest,
        leadId: ids.lead,
        runId: ids.run,
        createdAt: timestamp,
      }).keyDigest,
    ).toBe(digest);
  });

  it('rejects telemetry payload expansion and malformed stored records', () => {
    expect(
      LifecycleEventSchema.safeParse({ ...event, email: 'avery@example.com' })
        .success,
    ).toBe(false);
    expect(RunDocumentSchema.safeParse({ ...run, revision: -1 }).success).toBe(
      false,
    );
    expect(
      LeadDocumentSchema.safeParse({ ...lead, evidenceClass: 'live' }).success,
    ).toBe(false);
  });

  it('rejects overlapping or duplicate interpretation evidence', () => {
    const candidate = {
      schemaVersion: 'qualification-interpretation-v1',
      interpreterVersion: 'deterministic-interpreter-v1',
      leadId: ids.lead,
      interpretedAt: timestamp,
      needTimeline: 'researching',
      requestIntent: null,
      coverageFocus: null,
      hasRequestDetails: false,
      completeFields: ['needTimeline', 'needTimeline'],
      missingFields: ['needTimeline'],
      evidenceSource: 'normalized_intake',
    };
    expect(QualificationInterpretationSchema.safeParse(candidate).success).toBe(
      false,
    );
  });

  it('holds invalid qualification evidence instead of exposing a priority', () => {
    const held = QualificationResultSchema.parse({
      schemaVersion: 'qualification-result-v1',
      rubricVersion: 'rubric-v1',
      interpreterVersion: 'deterministic-interpreter-v1',
      resultId: ids.result,
      runId: ids.run,
      leadId: ids.lead,
      generatedAt: timestamp,
      classification: 'marketing_readiness',
      criteria: null,
      total: null,
      priority: null,
      missingInformation: [],
      integrityHold: {
        code: 'invalid_qualification_evidence',
        message: 'Evidence did not validate.',
      },
      meaning: 'marketing readiness only; not an insurance decision',
    });
    expect(held.priority).toBeNull();
    expect(
      QualificationResultSchema.safeParse({ ...held, priority: 'high' })
        .success,
    ).toBe(false);
  });

  it('enforces monotonic simulated outcome states', () => {
    expect(SimulationRecordSchema.parse(simulation).seed).toBe(42);
    expect(
      SimulationRecordSchema.safeParse({
        ...simulation,
        outcome: { contacted: false, responded: true, appointment: false },
      }).success,
    ).toBe(false);
  });

  it('validates the complete null-with-reason system bundle boundary', () => {
    const bundle = SystemBundleDocumentSchema.parse({
      schemaVersion: 'system-bundle-v3',
      systemBundleId: ids.bundle,
      createdAt: timestamp,
      code: {
        revision: '93c20ec',
        dirty: false,
        sourceDigest: digest,
        patchDigest: null,
      },
      lockfileDigest: digest,
      fixtures: { version: 'phase-0.1', digest },
      versions: {
        intake: 'intake-v2',
        lead: 'lead-v2',
        run: 'run-v2',
        event: 'event-v2',
        checkpoint: 'checkpoint-v1',
        rubric: 'rubric-v1',
        interpreter: 'deterministic-interpreter-v1',
        graph: 'phase-2-graph-v1',
        checkpointer: 'firestore-checkpointer-v1',
        simulator: 'simulator-v1',
        enrichmentAdapters: 'enrichment-adapters-v1',
        composer: 'deterministic-template-v1',
        verificationRules: 'verification-rules-v1',
        decisionLanguage: 'decision-language-v1',
        metricsDefinitions: 'metrics-definitions-v1',
        evaluator: 'phase-2.0',
        configuration: 'phase-2-local-v1',
      },
      environment: {
        node: '24.22.1',
        pnpm: '12.15.0',
        java: '21.0.12.1',
        firebaseCli: '15.34.1',
        firestoreEmulator: '1.22.0',
        structurizrCli: '2025.11.09',
        platform: 'win32',
        architecture: 'x64',
      },
      deployment: {
        mode: 'local',
        projectId: 'demo-leadflow-ai-local',
        reason: 'local emulator; no hosted deployment',
      },
      provider: { value: null, reason: 'gate unresolved' },
      model: { value: null, reason: 'gate unresolved' },
      prompt: { value: null, reason: 'no model prompt' },
      enrichmentMode: 'recorded',
      liveToolContracts: {
        hosts: ['vpic.nhtsa.dot.gov', 'api.zippopotam.us'],
        authorization:
          'owner-authorized read-only GET, 2026-10-25 (PROJECT.md Phase 2 decisions)',
      },
    });
    expect(bundle.provider.value).toBeNull();
    expect(bundle.liveToolContracts.hosts).toHaveLength(2);
  });

  it('validates bounded API responses and rejects unsafe errors', () => {
    expect(
      IntakeAcceptedResponseSchema.parse({
        schemaVersion: 'intake-response-v1',
        leadId: ids.lead,
        runId: ids.run,
        runRevision: 0,
        replayed: false,
        committedAt: timestamp,
        evidenceClass: 'synthetic-local',
      }).runId,
    ).toBe(ids.run);
    expect(
      RunDetailResponseSchema.parse({
        schemaVersion: 'run-detail-response-v2',
        lead,
        run,
        events: [event],
        qualification: null,
        enrichment: [],
        emailCheck: null,
        draft: null,
        verification: null,
        simulation,
        retrievedAt: timestamp,
        evidenceClass: 'synthetic-local',
      }).events,
    ).toHaveLength(1);
    expect(
      ResumeResponseSchema.parse({
        schemaVersion: 'resume-response-v1',
        runId: ids.run,
        revision: 1,
        status: 'running',
        replayed: false,
      }).revision,
    ).toBe(1);
    expect(
      ErrorResponseSchema.safeParse({
        schemaVersion: 'error-response-v1',
        requestId: ids.request,
        error: {
          code: 'unknown_failure',
          category: 'runtime',
          retryable: false,
          message: 'Safe failure.',
          stack: 'secret stack',
        },
      }).success,
    ).toBe(false);
  });
});
