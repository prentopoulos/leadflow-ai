import { randomUUID } from 'node:crypto';
import {
  assertRunTransition,
  isResumeEligible,
  type LifecycleEvent,
  type RunDocument,
  type RunStatus,
  type SafeError,
} from '@leadflow-ai/domain';
import {
  AdminFirestoreAtomicStore,
  type FirestoreAtomicStore,
  type FirestoreAtomicTransaction,
} from './firestore.js';
import {
  createFirestoreRepositories,
  type FirestoreRepositories,
  type PreparedDocumentCreate,
} from './repositories.js';
import type { Firestore } from 'firebase-admin/firestore';

export class RunNotFoundError extends Error {
  readonly code = 'run_not_found' as const;

  constructor() {
    super('The requested run does not exist.');
    this.name = 'RunNotFoundError';
  }
}

export class RunRevisionConflictError extends Error {
  readonly code = 'revision_conflict' as const;

  constructor() {
    super('The run revision changed before the operation could commit.');
    this.name = 'RunRevisionConflictError';
  }
}

export class RunLeaseConflictError extends Error {
  readonly code = 'lease_active' as const;

  constructor(message = 'The run has an active execution lease.') {
    super(message);
    this.name = 'RunLeaseConflictError';
  }
}

export class RunStateConflictError extends Error {
  readonly code = 'run_ineligible' as const;

  constructor(message = 'The run is not eligible for this operation.') {
    super(message);
    this.name = 'RunStateConflictError';
  }
}

export interface EventContext {
  traceId: string;
  requestId: string;
  authorization: LifecycleEvent['authorization'];
}

export interface NextRunState {
  status: RunStatus;
  attempt: number;
  retryCount: number;
  currentStep: RunDocument['currentStep'];
  completedSteps: RunDocument['completedSteps'];
  lease: RunDocument['lease'];
  qualificationResultId: string | null;
  simulationRecordId: string | null;
  safeError: SafeError | null;
  // Phase 2 links. Omitted fields keep their stored values.
  enrichmentMode?: RunDocument['enrichmentMode'];
  enrichmentEvidenceIds?: RunDocument['enrichmentEvidenceIds'];
  emailCheckId?: RunDocument['emailCheckId'];
  evidenceCompleteness?: RunDocument['evidenceCompleteness'];
  draftId?: RunDocument['draftId'];
  draftSkipReason?: RunDocument['draftSkipReason'];
  verificationResultId?: RunDocument['verificationResultId'];
  holds?: RunDocument['holds'];
}

export interface CommitRunEventRequest extends EventContext {
  runId: string;
  expectedRevision: number;
  next: NextRunState;
  eventName: LifecycleEvent['name'];
  step: LifecycleEvent['step'];
  durationMs: number | null;
  externalCall?: LifecycleEvent['externalCall'];
  // Records created in the same transaction as the event, so a review or
  // revision exists exactly when its event does. A create collision aborts all.
  creates?: readonly PreparedDocumentCreate<object>[];
}

export interface ClaimRunRequest extends EventContext {
  runId: string;
  expectedRevision: number;
  ownerId: string;
  leaseDurationMs: number;
}

export interface LifecyclePersistenceDependencies {
  atomicStore: FirestoreAtomicStore;
  repositories: FirestoreRepositories;
  idFactory?: () => string;
  now?: () => string;
}

export interface RunEventCommit {
  run: RunDocument;
  event: LifecycleEvent;
}

function assertOwnerId(ownerId: string): void {
  if (!/^[A-Za-z0-9:_-]{1,120}$/u.test(ownerId)) {
    throw new Error('Execution owner ID is invalid.');
  }
}

function assertLeaseDuration(leaseDurationMs: number): void {
  if (
    !Number.isInteger(leaseDurationMs) ||
    leaseDurationMs < 1 ||
    leaseDurationMs > 300_000
  ) {
    throw new Error('Execution lease duration must be 1 to 300000 ms.');
  }
}

export class LifecyclePersistenceService {
  private readonly idFactory: () => string;
  private readonly now: () => string;

  constructor(private readonly dependencies: LifecyclePersistenceDependencies) {
    this.idFactory = dependencies.idFactory ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async commitRunEvent(
    request: CommitRunEventRequest,
  ): Promise<RunEventCommit> {
    const eventId = this.idFactory();
    const occurredAt = this.now();
    return this.dependencies.atomicStore.runTransaction(async (transaction) =>
      this.commitRunEventInTransaction(
        transaction,
        request,
        eventId,
        occurredAt,
      ),
    );
  }

  async claim(request: ClaimRunRequest): Promise<RunEventCommit> {
    assertOwnerId(request.ownerId);
    assertLeaseDuration(request.leaseDurationMs);
    const eventId = this.idFactory();
    const occurredAt = this.now();
    const expiresAt = new Date(
      Date.parse(occurredAt) + request.leaseDurationMs,
    ).toISOString();
    return this.dependencies.atomicStore.runTransaction(async (transaction) => {
      const run = await this.loadRun(transaction, request.runId);
      this.assertRevision(run, request.expectedRevision);
      if (run.status !== 'persisted') {
        throw new RunStateConflictError('Only a persisted run can be claimed.');
      }
      if (run.lease !== null) throw new RunLeaseConflictError();
      return this.commitLoadedRunEvent(
        transaction,
        run,
        {
          ...request,
          next: {
            status: 'running',
            attempt: run.attempt,
            retryCount: run.retryCount,
            currentStep: run.currentStep,
            completedSteps: run.completedSteps,
            lease: {
              ownerId: request.ownerId,
              claimedAt: occurredAt,
              expiresAt,
            },
            qualificationResultId: run.qualificationResultId,
            simulationRecordId: run.simulationRecordId,
            safeError: null,
          },
          eventName: 'run.claimed',
          step: null,
          durationMs: null,
        },
        eventId,
        occurredAt,
      );
    });
  }

  async reclaimExpiredLease(request: ClaimRunRequest): Promise<RunEventCommit> {
    assertOwnerId(request.ownerId);
    assertLeaseDuration(request.leaseDurationMs);
    const eventId = this.idFactory();
    const occurredAt = this.now();
    const expiresAt = new Date(
      Date.parse(occurredAt) + request.leaseDurationMs,
    ).toISOString();
    return this.dependencies.atomicStore.runTransaction(async (transaction) => {
      const run = await this.loadRun(transaction, request.runId);
      this.assertRevision(run, request.expectedRevision);
      if (run.status !== 'running' || run.lease === null) {
        throw new RunStateConflictError(
          'Only a running run with an expired lease can be reclaimed.',
        );
      }
      if (Date.parse(run.lease.expiresAt) > Date.parse(occurredAt)) {
        throw new RunLeaseConflictError();
      }
      return this.commitLoadedRunEvent(
        transaction,
        run,
        {
          ...request,
          next: {
            status: 'running',
            attempt: run.attempt,
            retryCount: run.retryCount,
            currentStep: run.currentStep,
            completedSteps: run.completedSteps,
            lease: {
              ownerId: request.ownerId,
              claimedAt: occurredAt,
              expiresAt,
            },
            qualificationResultId: run.qualificationResultId,
            simulationRecordId: run.simulationRecordId,
            safeError: run.safeError,
          },
          eventName: 'run.lease_reclaimed',
          step: null,
          durationMs: null,
        },
        eventId,
        occurredAt,
      );
    });
  }

  async resume(request: ClaimRunRequest): Promise<RunEventCommit> {
    assertOwnerId(request.ownerId);
    assertLeaseDuration(request.leaseDurationMs);
    const eventId = this.idFactory();
    const occurredAt = this.now();
    const expiresAt = new Date(
      Date.parse(occurredAt) + request.leaseDurationMs,
    ).toISOString();
    return this.dependencies.atomicStore.runTransaction(async (transaction) => {
      const run = await this.loadRun(transaction, request.runId);
      this.assertRevision(run, request.expectedRevision);
      if (!isResumeEligible(run.status)) {
        throw new RunStateConflictError(
          'Only a persisted or retryable run can be resumed.',
        );
      }
      if (
        run.lease !== null &&
        Date.parse(run.lease.expiresAt) > Date.parse(occurredAt)
      ) {
        throw new RunLeaseConflictError();
      }
      return this.commitLoadedRunEvent(
        transaction,
        run,
        {
          ...request,
          next: {
            status: 'running',
            attempt: run.attempt,
            retryCount: run.retryCount,
            currentStep: run.currentStep,
            completedSteps: run.completedSteps,
            lease: {
              ownerId: request.ownerId,
              claimedAt: occurredAt,
              expiresAt,
            },
            qualificationResultId: run.qualificationResultId,
            simulationRecordId: run.simulationRecordId,
            safeError: run.safeError,
          },
          eventName: 'run.resume_requested',
          step: run.currentStep,
          durationMs: null,
        },
        eventId,
        occurredAt,
      );
    });
  }

  private async commitRunEventInTransaction(
    transaction: FirestoreAtomicTransaction,
    request: CommitRunEventRequest,
    eventId: string,
    occurredAt: string,
  ): Promise<RunEventCommit> {
    const run = await this.loadRun(transaction, request.runId);
    this.assertRevision(run, request.expectedRevision);
    return this.commitLoadedRunEvent(
      transaction,
      run,
      request,
      eventId,
      occurredAt,
    );
  }

  private commitLoadedRunEvent(
    transaction: FirestoreAtomicTransaction,
    current: RunDocument,
    request: CommitRunEventRequest,
    eventId: string,
    occurredAt: string,
  ): RunEventCommit {
    if (current.status !== request.next.status) {
      assertRunTransition(current.status, request.next.status);
    }
    const nextRun = this.dependencies.repositories.runs.prepareCreate({
      ...current,
      ...request.next,
      updatedAt: occurredAt,
      revision: current.revision + 1,
      nextEventSequence: current.nextEventSequence + 1,
    });
    const event = this.dependencies.repositories.events.prepareCreate({
      schemaVersion: 'event-v2',
      eventId,
      runId: current.runId,
      traceId: request.traceId,
      requestId: request.requestId,
      sequence: current.nextEventSequence,
      runRevision: current.revision + 1,
      name: request.eventName,
      occurredAt,
      step: request.step,
      status: request.next.status,
      durationMs: request.durationMs,
      attempt: request.next.attempt,
      retryCount: request.next.retryCount,
      authorization: request.authorization,
      safeError: request.next.safeError,
      systemBundleId: current.systemBundleId,
      evidenceClass: 'synthetic-local',
      externalCall: request.externalCall ?? null,
      usage: null,
      usageUnavailableReason: 'no_model_or_paid_tool',
    });
    transaction.update(nextRun.path, nextRun.data);
    transaction.create(event.path, event.data);
    for (const prepared of request.creates ?? []) {
      transaction.create(prepared.path, prepared.data);
    }
    return { run: nextRun.data, event: event.data };
  }

  private async loadRun(
    transaction: FirestoreAtomicTransaction,
    runId: string,
  ): Promise<RunDocument> {
    const stored = await transaction.get(
      this.dependencies.repositories.runs.pathFor(runId),
    );
    if (stored === null) throw new RunNotFoundError();
    return this.dependencies.repositories.runs.parseStored(stored);
  }

  private assertRevision(run: RunDocument, expectedRevision: number): void {
    if (run.revision !== expectedRevision) {
      throw new RunRevisionConflictError();
    }
  }
}

export function createLifecyclePersistenceService(
  database: Firestore,
  options: Pick<LifecyclePersistenceDependencies, 'idFactory' | 'now'> = {},
): LifecyclePersistenceService {
  return new LifecyclePersistenceService({
    atomicStore: new AdminFirestoreAtomicStore(database),
    repositories: createFirestoreRepositories(database),
    ...options,
  });
}
