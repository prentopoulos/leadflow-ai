import type { DocumentData } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import type { RunDocument } from '@leadflow-ai/domain';
import type {
  FirestoreAtomicStore,
  FirestoreAtomicTransaction,
  FirestoreDocumentStore,
} from './firestore.js';
import { IntakePersistenceService } from './intake.js';
import {
  LifecyclePersistenceService,
  RunLeaseConflictError,
  RunRevisionConflictError,
  type NextRunState,
} from './lifecycle.js';
import { createFirestoreRepositories } from './repositories.js';

const bundleId = '66666666-6666-4666-8666-666666666666';
const traceId = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const initialTime = '2026-10-24T20:00:00.000Z';

const intake = {
  schemaVersion: 'intake-v1',
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

class SerialMemoryAtomicStore
  implements FirestoreDocumentStore, FirestoreAtomicStore
{
  readonly documents = new Map<string, unknown>();
  failEventCreate = false;
  private queue: Promise<void> = Promise.resolve();

  async create(path: string, data: DocumentData): Promise<void> {
    if (this.documents.has(path)) throw new Error('already exists');
    this.documents.set(path, structuredClone(data));
  }

  async get(path: string): Promise<unknown | null> {
    return structuredClone(this.documents.get(path) ?? null);
  }

  async runTransaction<T>(
    operation: (transaction: FirestoreAtomicTransaction) => Promise<T>,
  ): Promise<T> {
    let release: () => void = () => void 0;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const staged = new Map(
        [...this.documents].map(([path, value]) => [
          path,
          structuredClone(value),
        ]),
      );
      const result = await operation({
        get: async (path) => structuredClone(staged.get(path) ?? null),
        create: (path, data) => {
          if (this.failEventCreate && path.includes('/events/')) {
            throw new Error('injected event write failure');
          }
          if (staged.has(path)) throw new Error('already exists');
          staged.set(path, structuredClone(data));
        },
        update: (path, data) => {
          if (!staged.has(path)) throw new Error('not found');
          staged.set(path, structuredClone(data));
        },
      });
      this.documents.clear();
      for (const [path, value] of staged) this.documents.set(path, value);
      return result;
    } finally {
      release();
    }
  }
}

function deterministicIds(start = 0) {
  let sequence = start;
  return () => {
    sequence += 1;
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
  };
}

async function persistedRun(store: SerialMemoryAtomicStore) {
  const repositories = createFirestoreRepositories(store);
  const response = await new IntakePersistenceService({
    atomicStore: store,
    repositories,
    idFactory: deterministicIds(),
    now: () => initialTime,
  }).persist({
    idempotencyKey: 'lifecycle-test-intake',
    intake,
    systemBundleId: bundleId,
    traceId,
    requestId,
  });
  return { repositories, response };
}

function eventContext() {
  return { traceId, requestId, authorization: 'not_applicable' as const };
}

function nextState(
  run: RunDocument,
  overrides: Partial<NextRunState> = {},
): NextRunState {
  return {
    status: run.status,
    attempt: run.attempt,
    retryCount: run.retryCount,
    currentStep: run.currentStep,
    completedSteps: run.completedSteps,
    lease: run.lease,
    qualificationResultId: run.qualificationResultId,
    simulationRecordId: run.simulationRecordId,
    safeError: run.safeError,
    ...overrides,
  };
}

describe('transactional lifecycle persistence', () => {
  it('claims a persisted run with one revision and monotonic event sequence', async () => {
    const store = new SerialMemoryAtomicStore();
    const { repositories, response } = await persistedRun(store);
    const service = new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(100),
      now: () => '2026-10-24T20:01:00.000Z',
    });
    const committed = await service.claim({
      runId: response.runId,
      expectedRevision: 0,
      ownerId: 'worker-1',
      leaseDurationMs: 30_000,
      ...eventContext(),
    });

    expect(committed.run).toMatchObject({
      status: 'running',
      revision: 1,
      nextEventSequence: 3,
      lease: {
        ownerId: 'worker-1',
        claimedAt: '2026-10-24T20:01:00.000Z',
        expiresAt: '2026-10-24T20:01:30.000Z',
      },
    });
    expect(committed.event).toMatchObject({
      name: 'run.claimed',
      sequence: 2,
      runRevision: 1,
      status: 'running',
    });
    await expect(repositories.runs.get(response.runId)).resolves.toEqual(
      committed.run,
    );
    await expect(
      repositories.events.get(response.runId, committed.event.eventId),
    ).resolves.toEqual(committed.event);
  });

  it('serializes concurrent claims so only one owner wins', async () => {
    const store = new SerialMemoryAtomicStore();
    const { repositories, response } = await persistedRun(store);
    const service = new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(200),
      now: () => '2026-10-24T20:01:00.000Z',
    });
    const results = await Promise.allSettled([
      service.claim({
        runId: response.runId,
        expectedRevision: 0,
        ownerId: 'worker-a',
        leaseDurationMs: 30_000,
        ...eventContext(),
      }),
      service.claim({
        runId: response.runId,
        expectedRevision: 0,
        ownerId: 'worker-b',
        leaseDurationMs: 30_000,
        ...eventContext(),
      }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    const stored = await repositories.runs.get(response.runId);
    expect(stored?.revision).toBe(1);
    expect(['worker-a', 'worker-b']).toContain(stored?.lease?.ownerId);
  });

  it('rejects a stale revision without adding an event', async () => {
    const store = new SerialMemoryAtomicStore();
    const { repositories, response } = await persistedRun(store);
    const service = new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(300),
      now: () => '2026-10-24T20:01:00.000Z',
    });
    const claim = await service.claim({
      runId: response.runId,
      expectedRevision: 0,
      ownerId: 'worker-1',
      leaseDurationMs: 30_000,
      ...eventContext(),
    });
    const before = structuredClone([...store.documents]);
    await expect(
      service.commitRunEvent({
        runId: response.runId,
        expectedRevision: 0,
        next: nextState(claim.run),
        eventName: 'step.started',
        step: 'interpret_qualification',
        durationMs: null,
        ...eventContext(),
      }),
    ).rejects.toBeInstanceOf(RunRevisionConflictError);
    expect([...store.documents]).toEqual(before);
  });

  it('rolls back the run update when an event ID is duplicated', async () => {
    const store = new SerialMemoryAtomicStore();
    const { repositories, response } = await persistedRun(store);
    const duplicateEventId = '99999999-9999-4999-8999-999999999999';
    const service = new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: () => duplicateEventId,
      now: () => '2026-10-24T20:01:00.000Z',
    });
    const claim = await service.claim({
      runId: response.runId,
      expectedRevision: 0,
      ownerId: 'worker-1',
      leaseDurationMs: 30_000,
      ...eventContext(),
    });
    await expect(
      service.commitRunEvent({
        runId: response.runId,
        expectedRevision: 1,
        next: nextState(claim.run),
        eventName: 'step.started',
        step: 'interpret_qualification',
        durationMs: null,
        ...eventContext(),
      }),
    ).rejects.toThrow(/already exists/u);
    await expect(repositories.runs.get(response.runId)).resolves.toEqual(
      claim.run,
    );
  });

  it('rolls back the run update when the event write fails', async () => {
    const store = new SerialMemoryAtomicStore();
    const { repositories, response } = await persistedRun(store);
    const service = new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(700),
      now: () => '2026-10-24T20:01:00.000Z',
    });
    const claim = await service.claim({
      runId: response.runId,
      expectedRevision: 0,
      ownerId: 'worker-1',
      leaseDurationMs: 30_000,
      ...eventContext(),
    });
    store.failEventCreate = true;

    await expect(
      service.commitRunEvent({
        runId: response.runId,
        expectedRevision: claim.run.revision,
        next: nextState(claim.run, {
          currentStep: 'interpret_qualification',
        }),
        eventName: 'step.started',
        step: 'interpret_qualification',
        durationMs: null,
        ...eventContext(),
      }),
    ).rejects.toThrow(/injected event write failure/u);
    await expect(repositories.runs.get(response.runId)).resolves.toEqual(
      claim.run,
    );
  });

  it('rejects active reclaim and records an expired-lease reclaim', async () => {
    const store = new SerialMemoryAtomicStore();
    const { repositories, response } = await persistedRun(store);
    const claim = await new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(400),
      now: () => '2026-10-24T20:01:00.000Z',
    }).claim({
      runId: response.runId,
      expectedRevision: 0,
      ownerId: 'worker-1',
      leaseDurationMs: 1_000,
      ...eventContext(),
    });

    await expect(
      new LifecyclePersistenceService({
        atomicStore: store,
        repositories,
        idFactory: deterministicIds(500),
        now: () => '2026-10-24T20:01:00.500Z',
      }).reclaimExpiredLease({
        runId: response.runId,
        expectedRevision: 1,
        ownerId: 'worker-2',
        leaseDurationMs: 30_000,
        ...eventContext(),
      }),
    ).rejects.toBeInstanceOf(RunLeaseConflictError);

    const reclaimed = await new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(600),
      now: () => '2026-10-24T20:01:02.000Z',
    }).reclaimExpiredLease({
      runId: response.runId,
      expectedRevision: claim.run.revision,
      ownerId: 'worker-2',
      leaseDurationMs: 30_000,
      ...eventContext(),
    });
    expect(reclaimed.run).toMatchObject({
      revision: 2,
      nextEventSequence: 4,
      lease: {
        ownerId: 'worker-2',
        claimedAt: '2026-10-24T20:01:02.000Z',
        expiresAt: '2026-10-24T20:01:32.000Z',
      },
    });
    expect(reclaimed.event).toMatchObject({
      name: 'run.lease_reclaimed',
      sequence: 3,
      runRevision: 2,
    });
  });

  it('rejects an invalid status transition atomically', async () => {
    const store = new SerialMemoryAtomicStore();
    const { repositories, response } = await persistedRun(store);
    const service = new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(700),
      now: () => '2026-10-24T20:01:00.000Z',
    });
    const claim = await service.claim({
      runId: response.runId,
      expectedRevision: 0,
      ownerId: 'worker-1',
      leaseDurationMs: 30_000,
      ...eventContext(),
    });
    const before = structuredClone([...store.documents]);
    await expect(
      service.commitRunEvent({
        runId: response.runId,
        expectedRevision: 1,
        next: nextState(claim.run, { status: 'persisted' }),
        eventName: 'step.completed',
        step: 'interpret_qualification',
        durationMs: 1,
        ...eventContext(),
      }),
    ).rejects.toThrow(/invalid run transition/u);
    expect([...store.documents]).toEqual(before);
  });
});
