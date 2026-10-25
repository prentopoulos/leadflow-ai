import { isDeepStrictEqual } from 'node:util';
import {
  IdempotencyRecordSchema,
  LeadDocumentSchema,
  LifecycleEventSchema,
  QualificationResultSchema,
  RunDocumentSchema,
  SimulationRecordSchema,
  SystemBundleDocumentSchema,
  type IdempotencyRecord,
  type LeadDocument,
  type LifecycleEvent,
  type QualificationResult,
  type RunDocument,
  type SimulationRecord,
  type SystemBundleDocument,
} from '@leadflow-ai/domain';
import {
  AdminFirestoreDocumentStore,
  type FirestoreDocumentStore,
} from './firestore.js';
import type { Firestore } from 'firebase-admin/firestore';

interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

export interface PreparedDocumentCreate<T> {
  path: string;
  data: T;
}

const safeSegment = /^[A-Za-z0-9:_-]{1,200}$/u;

function assertDocumentSegment(value: string): string {
  if (!safeSegment.test(value)) {
    throw new Error('Unsafe Firestore document identifier.');
  }
  return value;
}

export class ValidatedDocumentRepository<
  T extends object,
  Lookup extends readonly string[],
> {
  constructor(
    private readonly store: FirestoreDocumentStore,
    private readonly schema: RuntimeSchema<T>,
    private readonly writePath: (value: T) => string,
    private readonly readPath: (...lookup: Lookup) => string,
  ) {}

  prepareCreate(candidate: unknown): PreparedDocumentCreate<T> {
    const data = this.schema.parse(candidate);
    return { path: this.writePath(data), data };
  }

  pathFor(...lookup: Lookup): string {
    return this.readPath(...lookup);
  }

  parseStored(stored: unknown): T {
    const parsed = this.schema.parse(stored);
    if (!isDeepStrictEqual(stored, parsed)) {
      throw new Error(
        'Stored Firestore document requires normalization and was rejected.',
      );
    }
    return parsed;
  }

  async create(candidate: unknown): Promise<T> {
    const prepared = this.prepareCreate(candidate);
    await this.store.create(prepared.path, prepared.data);
    return prepared.data;
  }

  async createIdempotent(candidate: unknown): Promise<T> {
    const prepared = this.prepareCreate(candidate);
    try {
      await this.store.create(prepared.path, prepared.data);
      return prepared.data;
    } catch (error) {
      const stored = await this.store.get(prepared.path);
      if (stored === null) throw error;
      const parsed = this.parseStored(stored);
      if (!isDeepStrictEqual(parsed, prepared.data)) throw error;
      return parsed;
    }
  }

  async get(...lookup: Lookup): Promise<T | null> {
    const stored = await this.store.get(this.readPath(...lookup));
    if (stored === null) return null;
    return this.parseStored(stored);
  }
}

export interface FirestoreRepositories {
  leads: ValidatedDocumentRepository<LeadDocument, readonly [string]>;
  runs: ValidatedDocumentRepository<RunDocument, readonly [string]>;
  events: ValidatedDocumentRepository<
    LifecycleEvent,
    readonly [string, string]
  >;
  idempotency: ValidatedDocumentRepository<
    IdempotencyRecord,
    readonly [string]
  >;
  systemBundles: ValidatedDocumentRepository<
    SystemBundleDocument,
    readonly [string]
  >;
  qualificationResults: ValidatedDocumentRepository<
    QualificationResult,
    readonly [string]
  >;
  simulationRecords: ValidatedDocumentRepository<
    SimulationRecord,
    readonly [string]
  >;
}

export function createFirestoreRepositories(
  source: Firestore | FirestoreDocumentStore,
): FirestoreRepositories {
  const store =
    'doc' in source ? new AdminFirestoreDocumentStore(source) : source;
  return {
    leads: new ValidatedDocumentRepository(
      store,
      LeadDocumentSchema,
      (value) => `leads/${assertDocumentSegment(value.leadId)}`,
      (leadId) => `leads/${assertDocumentSegment(leadId)}`,
    ),
    runs: new ValidatedDocumentRepository(
      store,
      RunDocumentSchema,
      (value) => `runs/${assertDocumentSegment(value.runId)}`,
      (runId) => `runs/${assertDocumentSegment(runId)}`,
    ),
    events: new ValidatedDocumentRepository(
      store,
      LifecycleEventSchema,
      (value) =>
        `runs/${assertDocumentSegment(value.runId)}/events/${assertDocumentSegment(value.eventId)}`,
      (runId, eventId) =>
        `runs/${assertDocumentSegment(runId)}/events/${assertDocumentSegment(eventId)}`,
    ),
    idempotency: new ValidatedDocumentRepository(
      store,
      IdempotencyRecordSchema,
      (value) => `idempotency/${assertDocumentSegment(value.keyDigest)}`,
      (keyDigest) => `idempotency/${assertDocumentSegment(keyDigest)}`,
    ),
    systemBundles: new ValidatedDocumentRepository(
      store,
      SystemBundleDocumentSchema,
      (value) => `systemBundles/${assertDocumentSegment(value.systemBundleId)}`,
      (systemBundleId) =>
        `systemBundles/${assertDocumentSegment(systemBundleId)}`,
    ),
    qualificationResults: new ValidatedDocumentRepository(
      store,
      QualificationResultSchema,
      (value) =>
        `qualificationResults/${assertDocumentSegment(value.resultId)}`,
      (resultId) => `qualificationResults/${assertDocumentSegment(resultId)}`,
    ),
    simulationRecords: new ValidatedDocumentRepository(
      store,
      SimulationRecordSchema,
      (value) =>
        `simulationRecords/${assertDocumentSegment(value.simulationRecordId)}`,
      (simulationRecordId) =>
        `simulationRecords/${assertDocumentSegment(simulationRecordId)}`,
    ),
  };
}
