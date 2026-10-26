import { createHash, randomUUID } from 'node:crypto';
import {
  IdempotencyKeySchema,
  IntakeAcceptedResponseSchema,
  IntakeSubmissionSchema,
  type IntakeAcceptedResponse,
} from '@leadflow-ai/domain';
import {
  AdminFirestoreAtomicStore,
  type FirestoreAtomicStore,
} from './firestore.js';
import {
  createFirestoreRepositories,
  type FirestoreRepositories,
} from './repositories.js';
import type { Firestore } from 'firebase-admin/firestore';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function canonicalIntakeDigest(candidate: unknown): string {
  const intake = IntakeSubmissionSchema.parse(candidate);
  return sha256(JSON.stringify(canonicalize(intake)));
}

export class IdempotencyConflictError extends Error {
  readonly code = 'idempotency_conflict' as const;

  constructor() {
    super('The idempotency key is already bound to different intake content.');
    this.name = 'IdempotencyConflictError';
  }
}

export interface PersistIntakeRequest {
  idempotencyKey: string;
  intake: unknown;
  systemBundleId: string;
  traceId: string;
  requestId: string;
}

export interface IntakePersistenceDependencies {
  atomicStore: FirestoreAtomicStore;
  repositories: FirestoreRepositories;
  idFactory?: () => string;
  now?: () => string;
}

export class IntakePersistenceService {
  private readonly idFactory: () => string;
  private readonly now: () => string;

  constructor(private readonly dependencies: IntakePersistenceDependencies) {
    this.idFactory = dependencies.idFactory ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async persist(
    request: PersistIntakeRequest,
  ): Promise<IntakeAcceptedResponse> {
    const idempotencyKey = IdempotencyKeySchema.parse(request.idempotencyKey);
    const intake = IntakeSubmissionSchema.parse(request.intake);
    const keyDigest = sha256(idempotencyKey);
    const requestDigest = canonicalIntakeDigest(intake);
    const createdAt = this.now();
    const leadId = this.idFactory();
    const runId = this.idFactory();
    const eventId = this.idFactory();

    const idempotency =
      this.dependencies.repositories.idempotency.prepareCreate({
        schemaVersion: 'idempotency-v1',
        keyDigest,
        requestDigest,
        leadId,
        runId,
        createdAt,
      });
    const lead = this.dependencies.repositories.leads.prepareCreate({
      schemaVersion: 'lead-v2',
      leadId,
      createdAt,
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
        parityVerified: false,
      },
      evidenceClass: 'synthetic',
    });
    const run = this.dependencies.repositories.runs.prepareCreate({
      schemaVersion: 'run-v2',
      runId,
      leadId,
      createdAt,
      updatedAt: createdAt,
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
      systemBundleId: request.systemBundleId,
    });
    const event = this.dependencies.repositories.events.prepareCreate({
      schemaVersion: 'event-v2',
      eventId,
      runId,
      traceId: request.traceId,
      requestId: request.requestId,
      sequence: 1,
      runRevision: 0,
      name: 'lead.persisted',
      occurredAt: createdAt,
      step: null,
      status: 'persisted',
      durationMs: null,
      attempt: 0,
      retryCount: 0,
      authorization: 'not_applicable',
      safeError: null,
      systemBundleId: request.systemBundleId,
      evidenceClass: 'synthetic-local',
      usage: null,
      usageUnavailableReason: 'no_model_or_paid_tool',
    });

    return this.dependencies.atomicStore.runTransaction(async (transaction) => {
      const existingRaw = await transaction.get(idempotency.path);
      if (existingRaw !== null) {
        const existing =
          this.dependencies.repositories.idempotency.parseStored(existingRaw);
        if (existing.requestDigest !== requestDigest) {
          throw new IdempotencyConflictError();
        }
        return IntakeAcceptedResponseSchema.parse({
          schemaVersion: 'intake-response-v1',
          leadId: existing.leadId,
          runId: existing.runId,
          runRevision: 0,
          replayed: true,
          committedAt: existing.createdAt,
          evidenceClass: 'synthetic-local',
        });
      }

      for (const prepared of [idempotency, lead, run, event]) {
        transaction.create(prepared.path, prepared.data);
      }
      return IntakeAcceptedResponseSchema.parse({
        schemaVersion: 'intake-response-v1',
        leadId,
        runId,
        runRevision: 0,
        replayed: false,
        committedAt: createdAt,
        evidenceClass: 'synthetic-local',
      });
    });
  }
}

export function createIntakePersistenceService(
  database: Firestore,
): IntakePersistenceService {
  return new IntakePersistenceService({
    atomicStore: new AdminFirestoreAtomicStore(database),
    repositories: createFirestoreRepositories(database),
  });
}
