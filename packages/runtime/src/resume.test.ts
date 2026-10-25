import type { DocumentData } from 'firebase-admin/firestore';
import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';
import type {
  FirestoreAtomicStore,
  FirestoreAtomicTransaction,
  FirestoreDocumentStore,
} from './firestore.js';
import { IntakePersistenceService } from './intake.js';
import {
  DeterministicQualificationInterpreter,
  SyntheticTransientFault,
  qualificationProjectionFromLead,
  type QualificationInterpreter,
} from './interpreter.js';
import { LifecyclePersistenceService } from './lifecycle.js';
import { createFirestoreRepositories } from './repositories.js';
import {
  CheckpointIncompatibleError,
  CheckpointMissingError,
  QualificationResumeService,
} from './resume.js';
import {
  compileQualificationWorkflow,
  initialQualificationGraphState,
} from './workflow.js';

const bundleId = '66666666-6666-4666-8666-666666666666';
const traceId = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
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
  requestDetails: 'Synthetic resume fixture.',
  emailContactConsent: false,
} as const;

class ResumeMemoryStore
  implements FirestoreDocumentStore, FirestoreAtomicStore
{
  readonly documents = new Map<string, unknown>();
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

function tickingClock() {
  let milliseconds = 0;
  return () => {
    milliseconds += 1;
    return new Date(Date.UTC(2026, 9, 25, 1, 0, 0, milliseconds)).toISOString();
  };
}

async function fixture() {
  const store = new ResumeMemoryStore();
  const repositories = createFirestoreRepositories(store);
  const persisted = await new IntakePersistenceService({
    atomicStore: store,
    repositories,
    idFactory: deterministicIds(),
    now: () => '2026-10-25T00:59:00.000Z',
  }).persist({
    idempotencyKey: 'resume-test-intake',
    intake,
    systemBundleId: bundleId,
    traceId,
    requestId,
  });
  const clock = tickingClock();
  const lifecycle = new LifecyclePersistenceService({
    atomicStore: store,
    repositories,
    idFactory: deterministicIds(100),
    now: clock,
  });
  const lead = await repositories.leads.get(persisted.leadId);
  if (lead === null) throw new Error('lead fixture missing');
  return { store, repositories, persisted, lifecycle, lead, clock };
}

function request(runId: string, expectedRevision: number) {
  return {
    runId,
    expectedRevision,
    ownerId: 'resume-worker',
    leaseDurationMs: 300_000,
    traceId,
    requestId,
    authorization: 'allowed' as const,
  };
}

function events(store: ResumeMemoryStore) {
  return [...store.documents.entries()]
    .filter(([path]) => path.includes('/events/'))
    .map(
      ([, event]) =>
        event as {
          sequence: number;
          name: string;
          authorization: string;
        },
    )
    .sort((left, right) => left.sequence - right.sequence);
}

class AlwaysTransientInterpreter implements QualificationInterpreter {
  readonly version = 'deterministic-interpreter-v1' as const;
  calls = 0;

  async interpret(): Promise<never> {
    this.calls += 1;
    throw new SyntheticTransientFault();
  }
}

async function failRetryably(base: Awaited<ReturnType<typeof fixture>>) {
  const saver = new MemorySaver();
  const claimed = await base.lifecycle.claim({
    ...request(base.persisted.runId, 0),
    authorization: 'not_applicable',
  });
  const interpreter = new AlwaysTransientInterpreter();
  const graph = compileQualificationWorkflow({
    interpreter,
    lifecycle: base.lifecycle,
    repositories: base.repositories,
    checkpointer: saver,
    now: base.clock,
  });
  const config = { configurable: { thread_id: base.persisted.runId } };
  await graph.invoke(
    initialQualificationGraphState({
      runId: base.persisted.runId,
      leadId: base.persisted.leadId,
      traceId,
      requestId,
      systemBundleId: bundleId,
      runRevision: claimed.run.revision,
      projection: qualificationProjectionFromLead(base.lead),
    }),
    config,
  );
  const run = await base.repositories.runs.get(base.persisted.runId);
  if (run?.status !== 'failed_retryable') {
    throw new Error('retryable run fixture missing');
  }
  return { saver, run, config, interpreter };
}

function resumeService(
  base: Awaited<ReturnType<typeof fixture>>,
  saver: MemorySaver,
) {
  const workflow = compileQualificationWorkflow({
    interpreter: new DeterministicQualificationInterpreter(base.clock),
    lifecycle: base.lifecycle,
    repositories: base.repositories,
    checkpointer: saver,
    now: base.clock,
  });
  return new QualificationResumeService({
    repositories: base.repositories,
    lifecycle: base.lifecycle,
    checkpoints: saver,
    workflow,
    now: base.clock,
  });
}

describe('QualificationResumeService', () => {
  it('resumes a persisted run without requiring a checkpoint', async () => {
    const base = await fixture();
    const result = await resumeService(base, new MemorySaver()).resume(
      request(base.persisted.runId, 0),
    );

    expect(result.resumedFrom).toBe('persisted');
    expect(result.state).toMatchObject({ finalized: true, runRevision: 9 });
    await expect(
      base.repositories.runs.get(base.persisted.runId),
    ).resolves.toMatchObject({
      status: 'complete',
      revision: 9,
      nextEventSequence: 11,
      lease: null,
    });
    expect(events(base.store)[1]).toMatchObject({
      name: 'run.resume_requested',
      authorization: 'allowed',
    });
  });

  it('resumes a retryable run from its compatible checkpoint', async () => {
    const base = await fixture();
    const failed = await failRetryably(base);
    expect(failed.interpreter.calls).toBe(2);

    const result = await resumeService(base, failed.saver).resume(
      request(base.persisted.runId, failed.run.revision),
    );

    expect(result.resumedFrom).toBe('checkpoint');
    expect(result.state).toMatchObject({ finalized: true, runRevision: 16 });
    await expect(
      base.repositories.runs.get(base.persisted.runId),
    ).resolves.toMatchObject({
      status: 'complete',
      revision: 16,
      nextEventSequence: 18,
      attempt: 2,
      retryCount: 1,
      lease: null,
    });
    expect(events(base.store)[8]).toMatchObject({
      name: 'run.resume_requested',
      authorization: 'allowed',
    });
  });

  it('reclaims a run stranded in running once its lease expires', async () => {
    const base = await fixture();
    // A claim whose process died before the graph ran: the run stays running.
    const claimed = await base.lifecycle.claim({
      ...request(base.persisted.runId, 0),
      leaseDurationMs: 1,
      authorization: 'not_applicable',
    });
    expect(claimed.run.status).toBe('running');

    const result = await resumeService(base, new MemorySaver()).resume(
      request(base.persisted.runId, claimed.run.revision),
    );

    expect(result.resumedFrom).toBe('lease_reclaim');
    expect(result.state.finalized).toBe(true);
    await expect(
      base.repositories.runs.get(base.persisted.runId),
    ).resolves.toMatchObject({ status: 'complete', lease: null });
    expect(events(base.store).map((event) => event.name)).toContain(
      'run.lease_reclaimed',
    );
  });

  it('refuses to reclaim a running run whose lease is still active', async () => {
    const base = await fixture();
    const claimed = await base.lifecycle.claim({
      ...request(base.persisted.runId, 0),
      authorization: 'not_applicable',
    });
    const before = await base.repositories.runs.get(base.persisted.runId);

    await expect(
      resumeService(base, new MemorySaver()).resume(
        request(base.persisted.runId, claimed.run.revision),
      ),
    ).rejects.toThrow();
    await expect(
      base.repositories.runs.get(base.persisted.runId),
    ).resolves.toEqual(before);
  });

  it('records step durations from the workflow clock', async () => {
    const base = await fixture();
    await resumeService(base, new MemorySaver()).resume(
      request(base.persisted.runId, 0),
    );
    const completed = [...base.store.documents.entries()]
      .filter(([path]) => path.includes('/events/'))
      .map(([, event]) => event as { name: string; durationMs: number | null })
      .filter((event) => event.name === 'step.completed');
    expect(completed.length).toBeGreaterThan(0);
    for (const event of completed) {
      expect(event.durationMs).toBeGreaterThan(0);
    }
  });

  it('rejects a retryable run when its checkpoint is missing', async () => {
    const base = await fixture();
    const failed = await failRetryably(base);
    const before = await base.repositories.runs.get(base.persisted.runId);

    await expect(
      resumeService(base, new MemorySaver()).resume(
        request(base.persisted.runId, failed.run.revision),
      ),
    ).rejects.toBeInstanceOf(CheckpointMissingError);
    await expect(
      base.repositories.runs.get(base.persisted.runId),
    ).resolves.toEqual(before);
  });

  it('rejects an incompatible checkpoint before changing the run', async () => {
    const base = await fixture();
    const failed = await failRetryably(base);
    const tuple = await failed.saver.getTuple(failed.config);
    if (tuple === undefined) throw new Error('checkpoint fixture missing');
    const before = await base.repositories.runs.get(base.persisted.runId);
    const service = new QualificationResumeService({
      repositories: base.repositories,
      lifecycle: base.lifecycle,
      checkpoints: {
        getTuple: async () => ({
          ...tuple,
          checkpoint: {
            ...tuple.checkpoint,
            channel_values: {
              ...tuple.checkpoint.channel_values,
              systemBundleId: '77777777-7777-4777-8777-777777777777',
            },
          },
        }),
      },
      workflow: compileQualificationWorkflow({
        interpreter: new DeterministicQualificationInterpreter(base.clock),
        lifecycle: base.lifecycle,
        repositories: base.repositories,
        checkpointer: failed.saver,
      }),
      now: base.clock,
    });

    await expect(
      service.resume(request(base.persisted.runId, failed.run.revision)),
    ).rejects.toBeInstanceOf(CheckpointIncompatibleError);
    await expect(
      base.repositories.runs.get(base.persisted.runId),
    ).resolves.toEqual(before);
  });

  it('rejects missing, stale, running, complete, terminal, and actively leased runs without mutation', async () => {
    const missing = await fixture();
    await expect(
      resumeService(missing, new MemorySaver()).resume(
        request('99999999-9999-4999-8999-999999999999', 0),
      ),
    ).rejects.toMatchObject({ code: 'run_not_found' });

    const stale = await fixture();
    await expect(
      resumeService(stale, new MemorySaver()).resume(
        request(stale.persisted.runId, 1),
      ),
    ).rejects.toMatchObject({ code: 'revision_conflict' });

    for (const status of ['running', 'complete', 'failed_terminal'] as const) {
      const base = await fixture();
      const stored = await base.repositories.runs.get(base.persisted.runId);
      if (stored === null) throw new Error('run fixture missing');
      base.store.documents.set(base.repositories.runs.pathFor(stored.runId), {
        ...stored,
        status,
      });
      const before = await base.repositories.runs.get(stored.runId);
      await expect(
        resumeService(base, new MemorySaver()).resume(
          request(stored.runId, stored.revision),
        ),
      ).rejects.toMatchObject({ code: 'run_ineligible' });
      await expect(base.repositories.runs.get(stored.runId)).resolves.toEqual(
        before,
      );
    }

    const leased = await fixture();
    const stored = await leased.repositories.runs.get(leased.persisted.runId);
    if (stored === null) throw new Error('run fixture missing');
    leased.store.documents.set(leased.repositories.runs.pathFor(stored.runId), {
      ...stored,
      lease: {
        ownerId: 'other-worker',
        claimedAt: '2026-10-25T00:59:59.000Z',
        expiresAt: '2026-10-25T01:10:00.000Z',
      },
    });
    const before = await leased.repositories.runs.get(stored.runId);
    await expect(
      resumeService(leased, new MemorySaver()).resume(
        request(stored.runId, stored.revision),
      ),
    ).rejects.toMatchObject({ code: 'lease_active' });
    await expect(leased.repositories.runs.get(stored.runId)).resolves.toEqual(
      before,
    );
  });
});
