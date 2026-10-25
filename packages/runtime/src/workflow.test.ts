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
  QUALIFICATION_GRAPH_NODES,
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
  requestDetails: 'Synthetic workflow fixture.',
  emailContactConsent: false,
} as const;

class WorkflowMemoryStore
  implements FirestoreDocumentStore, FirestoreAtomicStore
{
  readonly documents = new Map<string, unknown>();
  readonly creates: string[] = [];
  failAfterCreatePrefix: string | null = null;
  private queue: Promise<void> = Promise.resolve();

  async create(path: string, data: DocumentData): Promise<void> {
    if (this.documents.has(path)) throw new Error('already exists');
    this.documents.set(path, structuredClone(data));
    this.creates.push(path);
    if (
      this.failAfterCreatePrefix !== null &&
      path.startsWith(this.failAfterCreatePrefix)
    ) {
      this.failAfterCreatePrefix = null;
      throw new Error('injected ambiguous workflow result create');
    }
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
    return new Date(
      Date.UTC(2026, 9, 25, 0, 20, 0, milliseconds),
    ).toISOString();
  };
}

class InjectedInterpreter implements QualificationInterpreter {
  readonly version = 'deterministic-interpreter-v1' as const;
  calls = 0;

  constructor(
    private readonly failures: number,
    private readonly delegate: DeterministicQualificationInterpreter,
    private readonly failure: 'transient' | 'unknown' = 'transient',
  ) {}

  async interpret(
    projection: Parameters<QualificationInterpreter['interpret']>[0],
  ) {
    this.calls += 1;
    if (this.calls <= this.failures) {
      if (this.failure === 'transient') throw new SyntheticTransientFault();
      throw new Error('raw fixture detail must not be persisted');
    }
    return this.delegate.interpret(projection);
  }
}

async function executeInjectedWorkflow(
  createInterpreter: (clock: () => string) => InjectedInterpreter,
) {
  const store = new WorkflowMemoryStore();
  const repositories = createFirestoreRepositories(store);
  const initial = await new IntakePersistenceService({
    atomicStore: store,
    repositories,
    idFactory: deterministicIds(),
    now: () => '2026-10-25T00:19:00.000Z',
  }).persist({
    idempotencyKey: 'workflow-retry-test-intake',
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
  const claimed = await lifecycle.claim({
    runId: initial.runId,
    expectedRevision: 0,
    ownerId: 'workflow-worker',
    leaseDurationMs: 300_000,
    traceId,
    requestId,
    authorization: 'not_applicable',
  });
  const lead = await repositories.leads.get(initial.leadId);
  if (lead === null) throw new Error('lead fixture missing');
  const interpreter = createInterpreter(clock);
  const graph = compileQualificationWorkflow({
    interpreter,
    lifecycle,
    repositories,
    checkpointer: new MemorySaver(),
    now: clock,
  });
  const output = await graph.invoke(
    initialQualificationGraphState({
      runId: initial.runId,
      leadId: initial.leadId,
      traceId,
      requestId,
      systemBundleId: bundleId,
      runRevision: claimed.run.revision,
      projection: qualificationProjectionFromLead(lead),
    }),
    { configurable: { thread_id: initial.runId } },
  );
  const run = await repositories.runs.get(initial.runId);
  const events = [...store.documents.entries()]
    .filter(([path]) => path.includes('/events/'))
    .map(
      ([, event]) =>
        event as {
          sequence: number;
          name: string;
          status: string;
          step: string | null;
          attempt: number;
          retryCount: number;
          safeError: unknown;
        },
    )
    .sort((left, right) => left.sequence - right.sequence);
  return { interpreter, output, run, events };
}

async function executeAmbiguousResultWrite(
  pathPrefix: 'qualificationResults/' | 'simulationRecords/',
) {
  const store = new WorkflowMemoryStore();
  const repositories = createFirestoreRepositories(store);
  const initial = await new IntakePersistenceService({
    atomicStore: store,
    repositories,
    idFactory: deterministicIds(),
    now: () => '2026-10-25T00:19:00.000Z',
  }).persist({
    idempotencyKey: `workflow-ambiguous-${pathPrefix.replace('/', '')}`,
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
  const claimed = await lifecycle.claim({
    runId: initial.runId,
    expectedRevision: 0,
    ownerId: 'workflow-worker',
    leaseDurationMs: 300_000,
    traceId,
    requestId,
    authorization: 'not_applicable',
  });
  const lead = await repositories.leads.get(initial.leadId);
  if (lead === null) throw new Error('lead fixture missing');
  store.failAfterCreatePrefix = pathPrefix;
  const graph = compileQualificationWorkflow({
    interpreter: new DeterministicQualificationInterpreter(clock),
    lifecycle,
    repositories,
    checkpointer: new MemorySaver(),
    now: clock,
  });
  const output = await graph.invoke(
    initialQualificationGraphState({
      runId: initial.runId,
      leadId: initial.leadId,
      traceId,
      requestId,
      systemBundleId: bundleId,
      runRevision: claimed.run.revision,
      projection: qualificationProjectionFromLead(lead),
    }),
    { configurable: { thread_id: initial.runId } },
  );
  return {
    output,
    run: await repositories.runs.get(initial.runId),
    resultPaths: [...store.documents.keys()].filter((path) =>
      path.startsWith(pathPrefix),
    ),
    resultCreates: store.creates.filter((path) => path.startsWith(pathPrefix)),
  };
}

describe('qualification-graph-v1', () => {
  it('executes the fixed four nodes with durable ordered events and checkpoints', async () => {
    const store = new WorkflowMemoryStore();
    const repositories = createFirestoreRepositories(store);
    const initial = await new IntakePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(),
      now: () => '2026-10-25T00:19:00.000Z',
    }).persist({
      idempotencyKey: 'workflow-test-intake',
      intake,
      systemBundleId: bundleId,
      traceId,
      requestId,
    });
    const lifecycleClock = tickingClock();
    const lifecycle = new LifecyclePersistenceService({
      atomicStore: store,
      repositories,
      idFactory: deterministicIds(100),
      now: lifecycleClock,
    });
    const claimed = await lifecycle.claim({
      runId: initial.runId,
      expectedRevision: 0,
      ownerId: 'workflow-worker',
      leaseDurationMs: 300_000,
      traceId,
      requestId,
      authorization: 'not_applicable',
    });
    const lead = await repositories.leads.get(initial.leadId);
    if (lead === null) throw new Error('lead fixture missing');
    const checkpointer = new MemorySaver();
    const graph = compileQualificationWorkflow({
      interpreter: new DeterministicQualificationInterpreter(lifecycleClock),
      lifecycle,
      repositories,
      checkpointer,
      now: lifecycleClock,
    });
    const graphConfig = {
      configurable: {
        thread_id: initial.runId,
      },
    };
    const output = await graph.invoke(
      initialQualificationGraphState({
        runId: initial.runId,
        leadId: initial.leadId,
        traceId,
        requestId,
        systemBundleId: bundleId,
        runRevision: claimed.run.revision,
        projection: qualificationProjectionFromLead(lead),
      }),
      graphConfig,
    );

    expect(output).toMatchObject({
      schemaVersion: 'qualification-graph-state-v1',
      runId: initial.runId,
      leadId: initial.leadId,
      runRevision: 9,
      finalized: true,
      interpretation: {
        interpreterVersion: 'deterministic-interpreter-v1',
      },
      qualification: {
        rubricVersion: 'rubric-v1',
        total: 100,
        priority: 'high',
      },
      simulation: {
        simulatorVersion: 'simulator-v1',
        evidenceClass: 'synthetic',
      },
    });
    const finalRun = await repositories.runs.get(initial.runId);
    expect(finalRun).toMatchObject({
      status: 'complete',
      revision: 9,
      nextEventSequence: 11,
      currentStep: null,
      completedSteps: [
        'interpret_qualification',
        'score_qualification',
        'simulate_outcome',
        'finalize_run',
      ],
      lease: null,
    });
    expect(
      await repositories.qualificationResults.get(
        output.qualification?.resultId ?? '',
      ),
    ).toEqual(output.qualification);
    expect(
      await repositories.simulationRecords.get(
        output.simulation?.simulationRecordId ?? '',
      ),
    ).toEqual(output.simulation);

    const events = [...store.documents.entries()]
      .filter(([path]) => path.includes('/events/'))
      .map(
        ([, event]) =>
          event as { sequence: number; name: string; step: string | null },
      )
      .sort((left, right) => left.sequence - right.sequence);
    expect(events.map(({ sequence }) => sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(
      events
        .filter(({ name }) => name === 'step.started')
        .map(({ step }) => step),
    ).toEqual([
      'interpret_qualification',
      'score_qualification',
      'simulate_outcome',
      'finalize_run',
    ]);
    expect(events.at(-1)).toMatchObject({
      name: 'run.completed',
      step: 'finalize_run',
    });

    const checkpoints = [];
    for await (const tuple of checkpointer.list(graphConfig)) {
      checkpoints.push(tuple);
    }
    expect(checkpoints.length).toBeGreaterThanOrEqual(
      QUALIFICATION_GRAPH_NODES.length + 1,
    );
    expect(checkpoints[0]?.checkpoint.channel_values).toMatchObject({
      finalized: true,
      runRevision: 9,
    });
  });

  it.each(['qualificationResults/', 'simulationRecords/'] as const)(
    'reconciles an ambiguous %s write without duplicating its logical effect',
    async (pathPrefix) => {
      const result = await executeAmbiguousResultWrite(pathPrefix);

      expect(result.output).toMatchObject({
        finalized: true,
        runRevision: 9,
      });
      expect(result.run).toMatchObject({
        status: 'complete',
        revision: 9,
      });
      expect(result.resultPaths).toHaveLength(1);
      expect(result.resultCreates).toHaveLength(1);
    },
  );

  it('persists one transient failure and completes on the single retry', async () => {
    const result = await executeInjectedWorkflow(
      (clock) =>
        new InjectedInterpreter(
          1,
          new DeterministicQualificationInterpreter(clock),
        ),
    );

    expect(result.interpreter.calls).toBe(2);
    expect(result.output).toMatchObject({
      finalized: true,
      safeError: null,
      runRevision: 12,
    });
    expect(result.run).toMatchObject({
      status: 'complete',
      revision: 12,
      nextEventSequence: 14,
      attempt: 2,
      retryCount: 1,
      safeError: null,
    });
    expect(result.events.map(({ name }) => name)).toEqual([
      'lead.persisted',
      'run.claimed',
      'step.started',
      'step.failed',
      'step.retry_scheduled',
      'step.started',
      'step.completed',
      'step.started',
      'step.completed',
      'step.started',
      'simulation.completed',
      'step.started',
      'run.completed',
    ]);
    expect(result.events.slice(2, 6)).toMatchObject([
      { attempt: 1, retryCount: 0 },
      {
        attempt: 1,
        retryCount: 0,
        safeError: { code: 'transient_interpreter_fault', retryable: true },
      },
      { attempt: 2, retryCount: 1 },
      { attempt: 2, retryCount: 1 },
    ]);
  });

  it('ends retryable after two transient failures without a third attempt', async () => {
    const result = await executeInjectedWorkflow(
      (clock) =>
        new InjectedInterpreter(
          2,
          new DeterministicQualificationInterpreter(clock),
        ),
    );

    expect(result.interpreter.calls).toBe(2);
    expect(result.output).toMatchObject({
      finalized: false,
      interpretation: null,
      runRevision: 7,
      safeError: {
        code: 'transient_interpreter_fault',
        retryable: true,
      },
    });
    expect(result.run).toMatchObject({
      status: 'failed_retryable',
      revision: 7,
      nextEventSequence: 9,
      attempt: 2,
      retryCount: 1,
      currentStep: 'interpret_qualification',
      lease: null,
    });
    expect(result.events.slice(-2)).toMatchObject([
      {
        name: 'step.failed',
        status: 'partial',
        attempt: 2,
        retryCount: 1,
      },
      {
        name: 'run.failed',
        status: 'failed_retryable',
        attempt: 2,
        retryCount: 1,
      },
    ]);
    expect(
      result.events.filter(({ name }) => name === 'step.started'),
    ).toHaveLength(2);
    expect(
      result.events.some(({ step }) => step === 'score_qualification'),
    ).toBe(false);
  });

  it('fails terminally without retrying an unknown interpreter error', async () => {
    const result = await executeInjectedWorkflow(
      (clock) =>
        new InjectedInterpreter(
          1,
          new DeterministicQualificationInterpreter(clock),
          'unknown',
        ),
    );

    expect(result.interpreter.calls).toBe(1);
    expect(result.output).toMatchObject({
      finalized: false,
      runRevision: 4,
      safeError: {
        code: 'unknown_failure',
        category: 'runtime',
        retryable: false,
      },
    });
    expect(result.run).toMatchObject({
      status: 'failed_terminal',
      revision: 4,
      nextEventSequence: 6,
      attempt: 1,
      retryCount: 0,
      lease: null,
    });
    expect(result.events.map(({ name }) => name)).toEqual([
      'lead.persisted',
      'run.claimed',
      'step.started',
      'step.failed',
      'run.failed',
    ]);
    expect(JSON.stringify(result.events)).not.toContain(
      'raw fixture detail must not be persisted',
    );
  });
});
