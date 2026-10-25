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
  qualificationProjectionFromLead,
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
    return new Date(
      Date.UTC(2026, 9, 25, 0, 20, 0, milliseconds),
    ).toISOString();
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
      idFactory: deterministicIds(200),
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
});
