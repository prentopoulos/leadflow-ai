import type { DocumentData } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { scoreQualification, simulateOutcome } from '@leadflow-ai/domain';
import type { FirestoreDocumentStore } from './firestore.js';
import { createFirestoreRepositories } from './repositories.js';
import {
  RunDetailService,
  RunDetailSnapshotUnavailableError,
  type RunEventReader,
} from './run-detail.js';
import { RunNotFoundError } from './lifecycle.js';

const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  event: '33333333-3333-4333-8333-333333333333',
  trace: '44444444-4444-4444-8444-444444444444',
  request: '55555555-5555-4555-8555-555555555555',
  bundle: '66666666-6666-4666-8666-666666666666',
};
const timestamp = '2026-10-25T12:00:00.000Z';

class RunDetailMemoryStore implements FirestoreDocumentStore {
  readonly documents = new Map<string, unknown>();

  async create(path: string, data: DocumentData): Promise<void> {
    if (this.documents.has(path)) throw new Error('already exists');
    this.documents.set(path, structuredClone(data));
  }

  async get(path: string): Promise<unknown | null> {
    return structuredClone(this.documents.get(path) ?? null);
  }
}

class MemoryEventReader implements RunEventReader {
  constructor(
    readonly events: unknown[],
    private readonly afterRead: () => void = () => undefined,
  ) {}

  async list(_runId: string, limit: number): Promise<unknown[]> {
    const result = structuredClone(this.events.slice(0, limit));
    this.afterRead();
    return result;
  }
}

const lead = {
  schemaVersion: 'lead-v2',
  leadId: ids.lead,
  createdAt: timestamp,
  intake: {
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
    requestDetails: 'Synthetic run detail fixture.',
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
} as const;

function run(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function event(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

async function fixture(
  storedRun = run(),
  events: unknown[] = [event()],
  afterEventRead?: () => void,
) {
  const store = new RunDetailMemoryStore();
  const repositories = createFirestoreRepositories(store);
  await repositories.leads.create(lead);
  await repositories.runs.create(storedRun);
  const service = new RunDetailService({
    repositories,
    events: new MemoryEventReader(events, afterEventRead),
    now: () => '2026-10-25T12:00:01.000Z',
  });
  return { store, repositories, service };
}

describe('stored run detail', () => {
  it('returns one stable bounded snapshot with contact data separated from events', async () => {
    const { service } = await fixture();

    const response = await service.get(ids.run);

    expect(response).toMatchObject({
      schemaVersion: 'run-detail-response-v2',
      lead: { leadId: ids.lead, intake: { email: 'avery@example.com' } },
      run: { runId: ids.run, revision: 0, status: 'persisted' },
      qualification: null,
      simulation: null,
      retrievedAt: '2026-10-25T12:00:01.000Z',
      evidenceClass: 'synthetic-local',
    });
    expect(response.events).toHaveLength(1);
    expect(JSON.stringify(response.events)).not.toContain('avery@example.com');
    expect(JSON.stringify(response.events)).not.toContain('10001');
  });

  it('returns compatible stored qualification and simulation records', async () => {
    const qualification = scoreQualification(
      {
        schemaVersion: 'qualification-interpretation-v1',
        interpreterVersion: 'deterministic-interpreter-v1',
        leadId: ids.lead,
        interpretedAt: timestamp,
        needTimeline: 'within_30_days',
        requestIntent: 'compare_options',
        coverageFocus: 'balanced',
        hasRequestDetails: true,
        completeFields: [
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
        ],
        missingFields: [],
        evidenceSource: 'normalized_intake',
      },
      {
        resultId: ids.run,
        runId: ids.run,
        leadId: ids.lead,
        generatedAt: timestamp,
      },
    );
    const simulation = simulateOutcome({
      runId: ids.run,
      generatedAt: timestamp,
    });
    const completedRun = run({
      status: 'complete',
      revision: 1,
      completedSteps: [
        'interpret_qualification',
        'score_qualification',
        'simulate_outcome',
        'finalize_run',
      ],
      qualificationResultId: qualification.resultId,
      simulationRecordId: simulation.simulationRecordId,
    });
    const { repositories, service } = await fixture(completedRun, [
      event({
        runRevision: 1,
        name: 'run.completed',
        status: 'complete',
        step: 'finalize_run',
      }),
    ]);
    await repositories.qualificationResults.create(qualification);
    await repositories.simulationRecords.create(simulation);

    const response = await service.get(ids.run);

    expect(response.qualification).toEqual(qualification);
    expect(response.simulation).toEqual(simulation);
  });

  it('rejects missing runs and incomplete event snapshots', async () => {
    const missing = await fixture();
    await expect(
      missing.service.get('99999999-9999-4999-8999-999999999999'),
    ).rejects.toBeInstanceOf(RunNotFoundError);

    const incomplete = await fixture(run(), []);
    await expect(incomplete.service.get(ids.run)).rejects.toBeInstanceOf(
      RunDetailSnapshotUnavailableError,
    );
  });

  it('rejects a snapshot when the run revision changes during assembly', async () => {
    const holder: { store?: RunDetailMemoryStore } = {};
    const built = await fixture(run(), [event()], () => {
      const current = holder.store?.documents.get(`runs/${ids.run}`) as
        Record<string, unknown> | undefined;
      if (holder.store !== undefined && current !== undefined) {
        holder.store.documents.set(`runs/${ids.run}`, {
          ...current,
          revision: 1,
          updatedAt: '2026-10-25T12:00:02.000Z',
        });
      }
    });
    holder.store = built.store;

    await expect(built.service.get(ids.run)).rejects.toBeInstanceOf(
      RunDetailSnapshotUnavailableError,
    );
  });
});
