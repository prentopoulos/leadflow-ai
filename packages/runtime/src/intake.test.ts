import { createHash } from 'node:crypto';
import type { DocumentData } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import type {
  FirestoreAtomicStore,
  FirestoreAtomicTransaction,
  FirestoreDocumentStore,
} from './firestore.js';
import {
  IdempotencyConflictError,
  IntakePersistenceService,
  canonicalIntakeDigest,
} from './intake.js';
import { createFirestoreRepositories } from './repositories.js';

const timestamp = '2026-10-24T20:00:00.000Z';
const bundleId = '66666666-6666-4666-8666-666666666666';
const correlation = {
  traceId: '44444444-4444-4444-8444-444444444444',
  requestId: '55555555-5555-4555-8555-555555555555',
};

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
} as const;

class MemoryAtomicStore
  implements FirestoreDocumentStore, FirestoreAtomicStore
{
  readonly documents = new Map<string, unknown>();
  transactionCount = 0;
  failOnCreate: number | null = null;

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
    this.transactionCount += 1;
    const staged = new Map(
      [...this.documents].map(([path, value]) => [
        path,
        structuredClone(value),
      ]),
    );
    let createCount = 0;
    const result = await operation({
      get: async (path) => structuredClone(staged.get(path) ?? null),
      create: (path, data) => {
        createCount += 1;
        if (createCount === this.failOnCreate) {
          throw new Error('injected transaction write failure');
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
  }
}

function deterministicIds() {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
  };
}

function serviceFor(store: MemoryAtomicStore) {
  return new IntakePersistenceService({
    atomicStore: store,
    repositories: createFirestoreRepositories(store),
    idFactory: deterministicIds(),
    now: () => timestamp,
  });
}

describe('atomic intake persistence', () => {
  it('creates idempotency, lead, run, and first event in one commit', async () => {
    const store = new MemoryAtomicStore();
    const response = await serviceFor(store).persist({
      idempotencyKey: 'intake-request-001',
      intake,
      systemBundleId: bundleId,
      ...correlation,
    });

    expect(response).toMatchObject({
      schemaVersion: 'intake-response-v1',
      leadId: '00000000-0000-4000-8000-000000000001',
      runId: '00000000-0000-4000-8000-000000000002',
      runRevision: 0,
      replayed: false,
      committedAt: timestamp,
      evidenceClass: 'synthetic-local',
    });
    const paths = [...store.documents.keys()].sort();
    const keyDigest = createHash('sha256')
      .update('intake-request-001')
      .digest('hex');
    expect(paths).toEqual([
      `idempotency/${keyDigest}`,
      `leads/${response.leadId}`,
      `runs/${response.runId}`,
      `runs/${response.runId}/events/00000000-0000-4000-8000-000000000003`,
    ]);
    expect(store.documents.get(`leads/${response.leadId}`)).toMatchObject({
      intake: { emailContactConsent: false },
      evidenceClass: 'synthetic',
    });
    expect(store.documents.get(`runs/${response.runId}`)).toMatchObject({
      status: 'persisted',
      revision: 0,
      nextEventSequence: 2,
    });
    const persistedEvent = store.documents.get(paths[3] ?? '');
    expect(persistedEvent).toMatchObject({
      name: 'lead.persisted',
      traceId: correlation.traceId,
      requestId: correlation.requestId,
      sequence: 1,
      runRevision: 0,
      status: 'persisted',
    });
    expect(JSON.stringify(persistedEvent)).not.toContain('avery@example.com');
  });

  it('returns original identifiers for the same canonical request', async () => {
    const store = new MemoryAtomicStore();
    const service = serviceFor(store);
    const first = await service.persist({
      idempotencyKey: 'intake-request-002',
      intake: { ...intake, givenName: '  Avery ', email: 'AVERY@EXAMPLE.COM' },
      systemBundleId: bundleId,
      ...correlation,
    });
    const second = await service.persist({
      idempotencyKey: ' intake-request-002 ',
      intake,
      systemBundleId: bundleId,
      ...correlation,
    });

    expect(second).toEqual({ ...first, replayed: true });
    expect(store.documents).toHaveLength(4);
    expect(store.transactionCount).toBe(2);
  });

  it('rejects conflicting reuse without changing stored state', async () => {
    const store = new MemoryAtomicStore();
    const service = serviceFor(store);
    await service.persist({
      idempotencyKey: 'intake-request-003',
      intake,
      systemBundleId: bundleId,
      ...correlation,
    });
    const before = structuredClone([...store.documents]);

    await expect(
      service.persist({
        idempotencyKey: 'intake-request-003',
        intake: { ...intake, zipCode: '90210' },
        systemBundleId: bundleId,
        ...correlation,
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect([...store.documents]).toEqual(before);
  });

  it('rolls back every initial record when a transaction write fails', async () => {
    const store = new MemoryAtomicStore();
    store.failOnCreate = 3;
    await expect(
      serviceFor(store).persist({
        idempotencyKey: 'intake-request-004',
        intake,
        systemBundleId: bundleId,
        ...correlation,
      }),
    ).rejects.toThrow(/injected/u);
    expect(store.documents).toHaveLength(0);
  });

  it('rejects invalid intake and keys before opening a transaction', async () => {
    const store = new MemoryAtomicStore();
    const service = serviceFor(store);
    await expect(
      service.persist({
        idempotencyKey: 'bad key',
        intake,
        systemBundleId: bundleId,
        ...correlation,
      }),
    ).rejects.toThrow();
    await expect(
      service.persist({
        idempotencyKey: 'intake-request-005',
        intake: { ...intake, email: 'real@invalid.test' },
        systemBundleId: bundleId,
        ...correlation,
      }),
    ).rejects.toThrow();
    expect(store.transactionCount).toBe(0);
    expect(store.documents).toHaveLength(0);
  });

  it('computes the digest from normalized canonical intake only', () => {
    expect(
      canonicalIntakeDigest({
        ...intake,
        givenName: ' Avery ',
        email: 'AVERY@EXAMPLE.COM',
      }),
    ).toBe(canonicalIntakeDigest(intake));
  });
});
