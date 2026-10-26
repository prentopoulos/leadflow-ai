import {
  RunDetailResponseSchema,
  type RunDetailResponse,
} from '@leadflow-ai/domain';
import type { IntakeClient } from './intake-client.js';
import type { RunClient } from './run-client.js';

export const developmentFixtureNames = [
  'loading',
  'progress',
  'failure',
  'complete',
  'stale',
  'long',
] as const;
export type DevelopmentFixtureName = (typeof developmentFixtureNames)[number];

const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  event: '33333333-3333-4333-8333-333333333333',
  trace: '44444444-4444-4444-8444-444444444444',
  request: '55555555-5555-4555-8555-555555555555',
  bundle: '66666666-6666-4666-8666-666666666666',
  result: '77777777-7777-4777-8777-777777777777',
} as const;
const timestamp = '2026-10-25T18:00:00.000Z';

const accepted = {
  status: 'accepted' as const,
  value: {
    schemaVersion: 'intake-response-v1' as const,
    leadId: ids.lead,
    runId: ids.run,
    runRevision: 0,
    replayed: false,
    committedAt: timestamp,
    evidenceClass: 'synthetic-local' as const,
  },
};

function completeDetail(): RunDetailResponse {
  return {
    schemaVersion: 'run-detail-response-v2',
    lead: {
      schemaVersion: 'lead-v2',
      leadId: ids.lead,
      createdAt: timestamp,
      intake: {
        schemaVersion: 'intake-v2',
        identityClass: 'fictional',
        givenName: 'Avery',
        familyName: 'Jordan',
        email: 'avery.jordan@example.com',
        zipCode: '22150',
        vehicleYear: 2021,
        vehicleMake: 'Subaru',
        vehicleModel: 'Outback',
        coverageFocus: 'balanced',
        requestIntent: 'compare_options',
        needTimeline: 'days_31_to_90',
        requestDetails: 'Synthetic interface fixture.',
        emailContactConsent: false,
        consentRecord: null,
      },
      provenance: {
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
      },
      evidenceClass: 'synthetic',
    },
    run: {
      schemaVersion: 'run-v2',
      runId: ids.run,
      leadId: ids.lead,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'complete',
      revision: 10,
      nextEventSequence: 3,
      attempt: 1,
      retryCount: 0,
      currentStep: null,
      completedSteps: [
        'interpret_qualification',
        'score_qualification',
        'simulate_outcome',
        'finalize_run',
      ],
      lease: null,
      qualificationResultId: ids.result,
      simulationRecordId: `simulation:${ids.run}`,
      enrichmentMode: null,
      enrichmentEvidenceIds: [],
      emailCheckId: null,
      evidenceCompleteness: 'not_evaluated',
      draftId: null,
      draftSkipReason: null,
      verificationResultId: null,
      holds: [],
      safeError: null,
      systemBundleId: ids.bundle,
    },
    events: [
      {
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
      },
      {
        schemaVersion: 'event-v2',
        eventId: '88888888-8888-4888-8888-888888888888',
        runId: ids.run,
        traceId: ids.trace,
        requestId: ids.request,
        sequence: 2,
        runRevision: 10,
        name: 'run.completed',
        occurredAt: timestamp,
        step: null,
        status: 'complete',
        durationMs: 19,
        attempt: 1,
        retryCount: 0,
        authorization: 'not_applicable',
        safeError: null,
        systemBundleId: ids.bundle,
        evidenceClass: 'synthetic-local',
        externalCall: null,
        usage: null,
        usageUnavailableReason: 'no_model_or_paid_tool',
      },
    ],
    qualification: {
      schemaVersion: 'qualification-result-v1',
      rubricVersion: 'rubric-v1',
      interpreterVersion: 'deterministic-interpreter-v1',
      resultId: ids.result,
      runId: ids.run,
      leadId: ids.lead,
      generatedAt: timestamp,
      classification: 'marketing_readiness',
      criteria: {
        needTimeline: {
          points: 30,
          maximum: 40,
          components: [
            {
              component: 'days_31_to_90',
              points: 30,
              evidenceFields: ['needTimeline'],
            },
          ],
        },
        requestClarity: {
          points: 30,
          maximum: 30,
          components: [
            {
              component: 'declared_intent_focus_details',
              points: 30,
              evidenceFields: [
                'requestIntent',
                'coverageFocus',
                'requestDetails',
              ],
            },
          ],
        },
        completeness: {
          points: 30,
          maximum: 30,
          components: [
            {
              component: 'complete_intake',
              points: 30,
              evidenceFields: [
                'givenName',
                'familyName',
                'email',
                'vehicleYear',
                'vehicleMake',
                'vehicleModel',
                'zipCode',
                'coverageFocus',
              ],
            },
          ],
        },
      },
      total: 90,
      priority: 'high',
      missingInformation: [],
      integrityHold: null,
      meaning: 'marketing readiness only; not an insurance decision',
    },
    simulation: {
      schemaVersion: 'simulation-record-v1',
      simulatorVersion: 'simulator-v1',
      seedVersion: 'seed-v1',
      simulationRecordId: `simulation:${ids.run}`,
      runId: ids.run,
      generatedAt: timestamp,
      seed: 42,
      fixtureClass: 'synthetic',
      outcome: { contacted: true, responded: false, appointment: false },
      evidenceClass: 'synthetic',
      notices: ['not_live', 'not_predictive'],
    },
    enrichment: [],
    emailCheck: null,
    draft: null,
    verification: null,
    retrievedAt: '2026-10-25T18:00:01.000Z',
    evidenceClass: 'synthetic-local',
  };
}

export function createDevelopmentFixture(name: DevelopmentFixtureName): {
  label: string;
  intakeClient: IntakeClient;
  runClient: RunClient;
} {
  const complete = completeDetail();
  let readCount = 0;
  const intakeClient: IntakeClient = async () => accepted;
  const runClient: RunClient = {
    async get() {
      readCount += 1;
      if (name === 'loading') return await new Promise(() => undefined);
      if (name === 'stale' && readCount > 1) {
        return {
          status: 'error',
          error: {
            code: 'storage_unavailable',
            category: 'storage',
            retryable: true,
            message: 'Newer stored run state is temporarily unavailable.',
          },
        };
      }
      if (name === 'progress' || name === 'stale') {
        complete.run.status = 'running';
        complete.run.revision = 4;
        complete.run.currentStep = 'score_qualification';
        complete.run.qualificationResultId = null;
        complete.run.simulationRecordId = null;
        complete.qualification = null;
        complete.simulation = null;
      }
      if (name === 'failure') {
        complete.run.status = 'failed_retryable';
        complete.run.revision = 5;
        complete.run.currentStep = null;
        complete.run.qualificationResultId = null;
        complete.run.simulationRecordId = null;
        complete.run.safeError = {
          code: 'transient_interpreter_fault',
          category: 'runtime',
          retryable: true,
          message:
            'The synthetic interpreter fault is ready for operator resume.',
        };
        complete.qualification = null;
        complete.simulation = null;
      }
      if (name === 'long') {
        complete.events = Array.from({ length: 32 }, (_, index) => ({
          ...complete.events[index % 2]!,
          eventId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          sequence: index + 1,
          runRevision: index,
        }));
      }
      return { status: 'ok', value: RunDetailResponseSchema.parse(complete) };
    },
    async resume() {
      return {
        status: 'ok',
        value: {
          schemaVersion: 'resume-response-v1',
          runId: ids.run,
          revision: complete.run.revision + 1,
          status: 'running',
          replayed: false,
        },
      };
    },
  };
  return {
    label: `DETERMINISTIC UI FIXTURE · ${name} · NOT STORED`,
    intakeClient,
    runClient,
  };
}
