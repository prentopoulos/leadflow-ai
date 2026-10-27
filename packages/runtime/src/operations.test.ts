import { describe, expect, it } from 'vitest';
import {
  LifecycleEventSchema,
  RunDocumentSchema,
  scoreQualification,
  simulateOutcome,
  type LifecycleEvent,
  type RunDocument,
} from '@leadflow-ai/domain';
import {
  DeterministicQualificationInterpreter,
  qualificationProjectionFromLead,
} from './interpreter.js';
import {
  lookupVehicle,
  lookupZip,
  type EnrichmentTransport,
} from './enrichment.js';
import { MemoryFirestore } from './memory-store.test-support.js';
import { OperationsIntegrityError, OperationsService } from './operations.js';
import { createFirestoreRepositories } from './repositories.js';

const ids = {
  bundle: '66666666-6666-4666-8666-666666666666',
  otherBundle: '77777777-7777-4777-8777-777777777777',
  leadOne: '11111111-1111-4111-8111-111111111111',
  runOne: '22222222-2222-4222-8222-222222222222',
  leadTwo: '33333333-3333-4333-8333-333333333333',
  runTwo: '44444444-4444-4444-8444-444444444444',
  leadThree: '88888888-8888-4888-8888-888888888888',
  runThree: '99999999-9999-4999-8999-999999999999',
  trace: '55555555-5555-4555-8555-555555555555',
  request: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  vehicle: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  zip: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};
const startedAt = '2026-10-25T20:00:00.000Z';
const finishedAt = '2026-10-25T20:00:01.000Z';

const intake = {
  schemaVersion: 'intake-v3',
  attribution: null,
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
  requestDetails: 'Synthetic operations fixture.',
  emailContactConsent: false,
  consentRecord: null,
} as const;

const lead = (leadId: string) => ({
  schemaVersion: 'lead-v3' as const,
  leadId,
  createdAt: startedAt,
  intake,
  provenance: {
    sourceId: 'military-com-auto-landing' as const,
    sourceUrl: 'https://auto.military.com/' as const,
    retrievedAt: '2026-10-24' as const,
    exactSourceFields: ['zipCode' as const],
    demoFields: ['givenName' as const],
    simulatedFields: ['attribution'] as ['attribution'],
    parityVerified: false as const,
  },
  evidenceClass: 'synthetic' as const,
});

function run(input: {
  runId: string;
  leadId: string;
  bundleId: string;
  status: RunDocument['status'];
  createdAt: string;
  currentStep?: RunDocument['currentStep'];
  qualificationResultId?: string | null;
  simulationRecordId?: string | null;
  evidenceIds?: string[];
}): RunDocument {
  return RunDocumentSchema.parse({
    schemaVersion: 'run-v2',
    runId: input.runId,
    leadId: input.leadId,
    createdAt: input.createdAt,
    updatedAt: finishedAt,
    status: input.status,
    revision: 1,
    nextEventSequence: 3,
    attempt: 1,
    retryCount: input.status === 'failed_retryable' ? 1 : 0,
    currentStep: input.currentStep ?? null,
    completedSteps: [],
    lease: null,
    qualificationResultId: input.qualificationResultId ?? null,
    simulationRecordId: input.simulationRecordId ?? null,
    enrichmentMode: input.evidenceIds === undefined ? null : 'recorded',
    enrichmentEvidenceIds: input.evidenceIds ?? [],
    emailCheckId: null,
    evidenceCompleteness:
      input.evidenceIds === undefined ? 'not_evaluated' : 'complete',
    draftId: null,
    draftSkipReason: 'no_consent',
    verificationResultId: null,
    holds: [],
    safeError:
      input.status === 'failed_retryable'
        ? {
            code: 'transient_interpreter_fault',
            category: 'runtime',
            retryable: true,
            message: 'Synthetic transient interpreter fault.',
          }
        : null,
    systemBundleId: input.bundleId,
  });
}

function event(input: {
  eventId: string;
  run: RunDocument;
  sequence: number;
  name: LifecycleEvent['name'];
  occurredAt: string;
}): LifecycleEvent {
  return LifecycleEventSchema.parse({
    schemaVersion: 'event-v2',
    eventId: input.eventId,
    runId: input.run.runId,
    traceId: ids.trace,
    requestId: ids.request,
    sequence: input.sequence,
    runRevision: input.run.revision,
    name: input.name,
    occurredAt: input.occurredAt,
    step: input.name === 'run.failed' ? input.run.currentStep : null,
    status: input.name === 'lead.persisted' ? 'persisted' : input.run.status,
    durationMs: null,
    attempt: input.name === 'lead.persisted' ? 0 : input.run.attempt,
    retryCount: input.name === 'lead.persisted' ? 0 : input.run.retryCount,
    authorization: 'not_applicable',
    safeError: input.name === 'run.failed' ? input.run.safeError : null,
    systemBundleId: input.run.systemBundleId,
    evidenceClass: 'synthetic-local',
    externalCall: null,
    usage: null,
    usageUnavailableReason: 'no_model_or_paid_tool',
  });
}

const transport: EnrichmentTransport = {
  mode: 'recorded',
  async get(url) {
    return url.host === 'vpic.nhtsa.dot.gov'
      ? {
          status: 200,
          body: JSON.stringify({
            Count: 1,
            Results: [{ Make_Name: 'Example Motors', Model_Name: 'Demo One' }],
          }),
          capturedAt: startedAt,
        }
      : { status: 404, body: '{}', capturedAt: startedAt };
  },
};

async function fixture() {
  const store = new MemoryFirestore();
  const repositories = createFirestoreRepositories(store);
  const leadOne = lead(ids.leadOne);
  const interpretation = await new DeterministicQualificationInterpreter(
    () => startedAt,
  ).interpret(qualificationProjectionFromLead(leadOne));
  const qualification = scoreQualification(interpretation, {
    resultId: ids.runOne,
    runId: ids.runOne,
    leadId: ids.leadOne,
    generatedAt: startedAt,
  });
  const lookupContext = (evidenceId: string) => ({
    transport,
    runId: ids.runOne,
    leadId: ids.leadOne,
    evidenceId,
    now: () => startedAt,
  });
  const [vehicle, zip] = await Promise.all([
    lookupVehicle(intake, lookupContext(ids.vehicle)),
    lookupZip(intake.zipCode, lookupContext(ids.zip)),
  ]);
  const simulation = simulateOutcome({
    runId: ids.runOne,
    generatedAt: finishedAt,
  });
  const runOne = run({
    runId: ids.runOne,
    leadId: ids.leadOne,
    bundleId: ids.bundle,
    status: 'complete',
    createdAt: startedAt,
    qualificationResultId: qualification.resultId,
    simulationRecordId: simulation.simulationRecordId,
    evidenceIds: [ids.vehicle, ids.zip],
  });
  const runTwo = run({
    runId: ids.runTwo,
    leadId: ids.leadTwo,
    bundleId: ids.bundle,
    status: 'failed_retryable',
    currentStep: 'enrich_lead',
    createdAt: '2026-10-25T19:00:00.000Z',
  });
  const runThree = run({
    runId: ids.runThree,
    leadId: ids.leadThree,
    bundleId: ids.otherBundle,
    status: 'persisted',
    createdAt: '2026-10-25T18:00:00.000Z',
  });
  for (const value of [leadOne, lead(ids.leadTwo), lead(ids.leadThree)]) {
    await repositories.leads.create(value);
  }
  for (const value of [runOne, runTwo, runThree])
    await repositories.runs.create(value);
  await repositories.qualificationResults.create(qualification);
  await repositories.enrichmentEvidence.create(vehicle.evidence);
  await repositories.enrichmentEvidence.create(zip.evidence);
  await repositories.simulationRecords.create(simulation);
  for (const [storedRun, suffix, terminal] of [
    [runOne, '1', 'run.completed'],
    [runTwo, '2', 'run.failed'],
  ] as const) {
    await repositories.events.create(
      event({
        eventId: `d0000000-0000-4000-8000-00000000000${suffix}`,
        run: storedRun,
        sequence: 1,
        name: 'lead.persisted',
        occurredAt: startedAt,
      }),
    );
    await repositories.events.create(
      event({
        eventId: `e0000000-0000-4000-8000-00000000000${suffix}`,
        run: storedRun,
        sequence: 2,
        name: terminal,
        occurredAt:
          terminal === 'run.completed'
            ? finishedAt
            : '2026-10-25T20:00:02.000Z',
      }),
    );
  }
  const service = new OperationsService({
    repositories,
    runs: {
      list: async (limit) =>
        store.list('runs', 'createdAt').reverse().slice(0, limit),
    },
    events: store.eventReader(),
    drafts: { history: async () => null },
    now: () => '2026-10-25T20:01:00.000Z',
  });
  return { service, store };
}

describe('stored operations views', () => {
  it('lists bounded summaries without contact data and supports attention filtering', async () => {
    const { service } = await fixture();
    const all = await service.list({ filter: 'all', cursor: null, limit: 2 });
    const attention = await service.list({
      filter: 'attention',
      cursor: null,
      limit: 50,
    });

    expect(all.totalMatching).toBe(3);
    expect(all.items).toHaveLength(2);
    expect(all.nextCursor).toBe(all.items.at(-1)?.runId);
    expect(JSON.stringify(all)).not.toContain('avery@example.com');
    expect(attention.items.map((item) => item.runId)).toEqual([ids.runTwo]);
    expect(attention.items[0]).toMatchObject({
      priority: 'not_scored',
      resumable: true,
      currentStep: 'enrich_lead',
    });
  });

  it('computes explicit-denominator metrics for only the current bundle', async () => {
    const { service } = await fixture();
    const report = await service.metrics(ids.bundle);

    expect(report.window).toEqual({
      runsInWindow: 2,
      activeRuns: 0,
      otherBundleRuns: 1,
    });
    expect(report.priorityDistribution).toEqual({
      high: 1,
      standard: 0,
      nurture: 0,
      held: 0,
      not_scored: 1,
    });
    expect(report.processingTime).toMatchObject({ n: 2, meanMs: 1_500 });
    expect(report.agentFailures).toMatchObject({
      value: 0.5,
      numerator: 1,
      denominator: 2,
      excluded: 0,
    });
    expect(report.failuresByStep.enrich_lead).toBe(1);
    expect(
      report.enrichment.find(
        (metric) =>
          metric.classGroup === 'recorded_or_mock' && metric.source === 'all',
      ),
    ).toMatchObject({
      success: { value: 1, numerator: 2, denominator: 2 },
      foundRate: { value: 0.5, numerator: 1, denominator: 2 },
    });
    expect(
      report.enrichment.find(
        (metric) => metric.classGroup === 'live' && metric.source === 'all',
      ),
    ).toMatchObject({
      success: { value: null, reason: 'insufficient_data' },
    });
    expect(report.simulation).toMatchObject({ label: 'SYNTHETIC', runs: 1 });
  });

  it('rejects metrics when a run-linked result is missing', async () => {
    const { service, store } = await fixture();
    store.documents.delete(`simulationRecords/${ids.runOne}:simulator-v1`);

    await expect(service.metrics(ids.bundle)).rejects.toBeInstanceOf(
      OperationsIntegrityError,
    );
  });
});
