import type { DocumentData } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import {
  scoreQualification,
  simulateOutcome,
  type LifecycleEvent,
} from '@leadflow-ai/domain';
import {
  FixtureEnrichmentTransport,
  RECORDED_ENRICHMENT_FIXTURE_PATH,
  checkEmail,
  loadEnrichmentFixtureFile,
  lookupZip,
} from './enrichment.js';
import type { FirestoreDocumentStore } from './firestore.js';
import { createFirestoreRepositories } from './repositories.js';

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
  requestDetails: 'Synthetic fixture request.',
  emailContactConsent: false,
  consentRecord: null,
} as const;

const lead = {
  schemaVersion: 'lead-v3',
  leadId: ids.lead,
  createdAt: timestamp,
  intake,
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
    simulatedFields: ['attribution'],
    parityVerified: false,
  },
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
} as const satisfies LifecycleEvent;

const idempotency = {
  schemaVersion: 'idempotency-v1',
  keyDigest: digest,
  requestDigest: 'b'.repeat(64),
  leadId: ids.lead,
  runId: ids.run,
  createdAt: timestamp,
} as const;

const bundle = {
  schemaVersion: 'system-bundle-v5',
  systemBundleId: ids.bundle,
  createdAt: timestamp,
  code: {
    revision: 'test',
    dirty: true,
    sourceDigest: digest,
    patchDigest: digest,
  },
  lockfileDigest: digest,
  fixtures: { version: 'phase-0.1', digest },
  versions: {
    intake: 'intake-v3',
    lead: 'lead-v3',
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
    verificationRules: 'verification-rules-v2',
    decisionLanguage: 'decision-language-v1',
    metricsDefinitions: 'metrics-definitions-v2',
    channelRules: 'channel-rules-v1',
    spendFixture: 'synthetic-spend-v1',
    trafficPlan: 'traffic-plan-v1',
    agentTeam: null,
    evaluator: 'phase-0.1',
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
  prompt: { value: null, reason: 'not used' },
  enrichmentMode: 'recorded',
  liveToolContracts: {
    hosts: ['vpic.nhtsa.dot.gov', 'api.zippopotam.us'],
    authorization:
      'owner-authorized read-only GET, 2026-10-25 (PROJECT.md Phase 2 decisions)',
  },
} as const;

const interpretation = {
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
} as const;

class MemoryDocumentStore implements FirestoreDocumentStore {
  readonly documents = new Map<string, unknown>();
  readonly creates: string[] = [];
  failAfterCreatePath: string | null = null;

  async create(path: string, data: DocumentData): Promise<void> {
    if (this.documents.has(path)) throw new Error('already exists');
    this.documents.set(path, structuredClone(data));
    this.creates.push(path);
    if (this.failAfterCreatePath === path) {
      this.failAfterCreatePath = null;
      throw new Error('injected ambiguous document create');
    }
  }

  async set(path: string, data: DocumentData): Promise<void> {
    this.documents.set(path, structuredClone(data));
  }

  async get(path: string): Promise<unknown | null> {
    return structuredClone(this.documents.get(path) ?? null);
  }
}

describe('schema-validating Firestore repositories', () => {
  it('validates and round-trips every owned Phase 1 repository path', async () => {
    const store = new MemoryDocumentStore();
    const repositories = createFirestoreRepositories(store);
    const qualification = scoreQualification(interpretation, {
      resultId: ids.result,
      runId: ids.run,
      leadId: ids.lead,
      generatedAt: timestamp,
    });
    const simulation = simulateOutcome({
      runId: ids.run,
      generatedAt: timestamp,
    });

    await repositories.leads.create(lead);
    await repositories.runs.create(run);
    await repositories.events.create(event);
    await repositories.idempotency.create(idempotency);
    await repositories.systemBundles.create(bundle);
    await repositories.qualificationResults.create(qualification);
    await repositories.simulationRecords.create(simulation);

    expect(store.creates).toEqual([
      `leads/${ids.lead}`,
      `runs/${ids.run}`,
      `runs/${ids.run}/events/${ids.event}`,
      `idempotency/${digest}`,
      `systemBundles/${ids.bundle}`,
      `qualificationResults/${ids.result}`,
      `simulationRecords/${ids.run}:simulator-v1`,
    ]);
    await expect(repositories.leads.get(ids.lead)).resolves.toEqual(lead);
    await expect(repositories.runs.get(ids.run)).resolves.toEqual(run);
    await expect(repositories.events.get(ids.run, ids.event)).resolves.toEqual(
      event,
    );
    await expect(repositories.idempotency.get(digest)).resolves.toEqual(
      idempotency,
    );
    await expect(repositories.systemBundles.get(ids.bundle)).resolves.toEqual(
      bundle,
    );
    await expect(
      repositories.qualificationResults.get(ids.result),
    ).resolves.toEqual(qualification);
    await expect(
      repositories.simulationRecords.get(simulation.simulationRecordId),
    ).resolves.toEqual(simulation);
  });

  it('round-trips Phase 2 enrichment evidence and email checks at their own paths', async () => {
    const store = new MemoryDocumentStore();
    const repositories = createFirestoreRepositories(store);
    const transport = new FixtureEnrichmentTransport(
      await loadEnrichmentFixtureFile(RECORDED_ENRICHMENT_FIXTURE_PATH),
    );
    const { evidence } = await lookupZip('22150', {
      transport,
      runId: ids.run,
      leadId: ids.lead,
      evidenceId: ids.result,
      now: () => timestamp,
    });
    const emailCheck = checkEmail({
      email: 'avery@example.com',
      emailCheckId: ids.event,
      runId: ids.run,
      leadId: ids.lead,
      checkedAt: timestamp,
    });
    await repositories.enrichmentEvidence.create(evidence);
    await repositories.emailChecks.create(emailCheck);
    expect(store.creates).toEqual([
      `enrichmentEvidence/${ids.result}`,
      `emailChecks/${ids.event}`,
    ]);
    await expect(
      repositories.enrichmentEvidence.get(ids.result),
    ).resolves.toMatchObject({ outcome: 'found', evidenceClass: 'recorded' });
    await expect(repositories.emailChecks.get(ids.event)).resolves.toEqual(
      emailCheck,
    );
  });

  it('rejects invalid writes before touching Firestore', async () => {
    const store = new MemoryDocumentStore();
    const repositories = createFirestoreRepositories(store);
    await expect(
      repositories.leads.create({ ...lead, unexpected: true }),
    ).rejects.toThrow();
    expect(store.creates).toEqual([]);
  });

  it('reconciles an exact ambiguous create but rejects conflicting reuse', async () => {
    const store = new MemoryDocumentStore();
    const repositories = createFirestoreRepositories(store);
    const qualification = scoreQualification(interpretation, {
      resultId: ids.result,
      runId: ids.run,
      leadId: ids.lead,
      generatedAt: timestamp,
    });
    store.failAfterCreatePath = `qualificationResults/${ids.result}`;

    await expect(
      repositories.qualificationResults.createIdempotent(qualification),
    ).resolves.toEqual(qualification);
    await expect(
      repositories.qualificationResults.createIdempotent(qualification),
    ).resolves.toEqual(qualification);
    await expect(
      repositories.qualificationResults.createIdempotent({
        ...qualification,
        generatedAt: '2026-10-24T20:00:01.000Z',
      }),
    ).rejects.toThrow(/already exists/u);
    expect(store.creates).toEqual([`qualificationResults/${ids.result}`]);
  });

  it('rejects malformed or normalization-dependent stored state', async () => {
    const store = new MemoryDocumentStore();
    const repositories = createFirestoreRepositories(store);
    store.documents.set(`runs/${ids.run}`, { ...run, revision: -1 });
    store.documents.set(`leads/${ids.lead}`, {
      ...lead,
      intake: { ...lead.intake, email: 'AVERY@EXAMPLE.COM' },
    });
    await expect(repositories.runs.get(ids.run)).rejects.toThrow();
    await expect(repositories.leads.get(ids.lead)).rejects.toThrow(
      /normalization/u,
    );
  });

  it('returns null only for missing documents and rejects unsafe paths', async () => {
    const repositories = createFirestoreRepositories(new MemoryDocumentStore());
    await expect(repositories.runs.get(ids.run)).resolves.toBeNull();
    await expect(repositories.runs.get('../production')).rejects.toThrow(
      /Unsafe/u,
    );
  });
});
