import type { DocumentData } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointMetadata,
} from '@langchain/langgraph-checkpoint';
import {
  FirestoreCheckpointSaver,
  type FirestoreCheckpointBackend,
} from './checkpointer.js';

const runId = '22222222-2222-4222-8222-222222222222';
const bundleId = '66666666-6666-4666-8666-666666666666';
const checkpointOne = '00000000-0000-6000-8000-000000000001';
const checkpointTwo = '00000000-0000-6000-8000-000000000002';

class MemoryCheckpointBackend implements FirestoreCheckpointBackend {
  readonly documents = new Map<string, unknown>();
  failAfterNextCreate = false;
  failAfterNextSet = false;

  async createIfAbsent(
    path: string,
    data: DocumentData,
  ): Promise<unknown | null> {
    const existing = this.documents.get(path);
    if (existing !== undefined) return structuredClone(existing);
    this.documents.set(path, structuredClone(data));
    if (this.failAfterNextCreate) {
      this.failAfterNextCreate = false;
      throw new Error('injected ambiguous checkpoint create');
    }
    return null;
  }

  async set(path: string, data: DocumentData): Promise<void> {
    this.documents.set(path, structuredClone(data));
    if (this.failAfterNextSet) {
      this.failAfterNextSet = false;
      throw new Error('injected ambiguous pending-write set');
    }
  }

  async get(path: string): Promise<unknown | null> {
    return structuredClone(this.documents.get(path) ?? null);
  }

  async list(collectionPath: string): Promise<unknown[]> {
    const prefix = `${collectionPath}/`;
    return [...this.documents]
      .filter(([path]) => path.startsWith(prefix))
      .map(([, value]) => structuredClone(value));
  }

  async deleteCollections(collectionPaths: readonly string[]): Promise<void> {
    for (const path of [...this.documents.keys()]) {
      if (
        collectionPaths.some((collection) => path.startsWith(`${collection}/`))
      ) {
        this.documents.delete(path);
      }
    }
  }
}

function checkpoint(id: string, value: unknown): Checkpoint {
  return {
    v: 4,
    id,
    ts: '2026-10-25T00:00:00.000Z',
    channel_values: { state: value },
    channel_versions: { state: 1 },
    versions_seen: {},
  };
}

function metadata(
  source: CheckpointMetadata['source'],
  step: number,
  label: string,
): CheckpointMetadata<{ label: string }> {
  return { source, step, parents: {}, label };
}

function initialConfig() {
  return {
    configurable: {
      thread_id: runId,
      checkpoint_ns: 'qualification',
      system_bundle_id: bundleId,
    },
  };
}

describe('FirestoreCheckpointSaver pinned contract', () => {
  it('implements BaseCheckpointSaver put/getTuple and preserves identity', async () => {
    const backend = new MemoryCheckpointBackend();
    const saver = new FirestoreCheckpointSaver(
      backend,
      bundleId,
      () => '2026-10-25T00:00:01.000Z',
    );
    expect(saver).toBeInstanceOf(BaseCheckpointSaver);

    const storedConfig = await saver.put(
      initialConfig(),
      checkpoint(checkpointOne, { ready: true }),
      metadata('input', -1, 'root'),
      { __start__: 1 },
    );
    expect(storedConfig).toEqual({
      configurable: {
        thread_id: runId,
        checkpoint_ns: 'qualification',
        checkpoint_id: checkpointOne,
        system_bundle_id: bundleId,
      },
    });

    const tuple = await saver.getTuple(storedConfig);
    expect(tuple).toMatchObject({
      config: storedConfig,
      checkpoint: checkpoint(checkpointOne, { ready: true }),
      metadata: metadata('input', -1, 'root'),
      pendingWrites: [],
    });
    expect(tuple?.parentConfig).toBeUndefined();
    const stored = [...backend.documents.values()].find(
      (candidate) =>
        typeof candidate === 'object' &&
        candidate !== null &&
        'channelVersions' in candidate,
    ) as { channelVersions: unknown } | undefined;
    expect(stored?.channelVersions).toEqual([
      { channel: '__start__', version: 1 },
    ]);
  });

  it('orders pending writes by task path, task ID, and write index', async () => {
    const backend = new MemoryCheckpointBackend();
    const saver = new FirestoreCheckpointSaver(
      backend,
      bundleId,
      () => '2026-10-25T00:00:01.000Z',
    );
    const config = await saver.put(
      initialConfig(),
      checkpoint(checkpointOne, 'state'),
      metadata('input', -1, 'root'),
      { state: 1 },
    );
    await saver.putWrites(
      config,
      [
        ['alpha', { first: true }],
        ['beta', 2],
      ],
      'task-z',
      'z-path',
    );
    await saver.putWrites(config, [['gamma', 3]], 'task-a', 'a-path');
    await saver.putWrites(
      config,
      [['alpha', 'ignored replay']],
      'task-z',
      'z-path',
    );
    await saver.putWrites(
      config,
      [['__error__', 'first']],
      'task-special',
      'm-path',
    );
    await saver.putWrites(
      config,
      [['__error__', 'second']],
      'task-special',
      'm-path',
    );

    expect((await saver.getTuple(config))?.pendingWrites).toEqual([
      ['task-a', 'gamma', 3],
      ['task-special', '__error__', 'second'],
      ['task-z', 'alpha', { first: true }],
      ['task-z', 'beta', 2],
    ]);
  });

  it('lists newest first with parent, before, filter, and limit semantics', async () => {
    const saver = new FirestoreCheckpointSaver(
      new MemoryCheckpointBackend(),
      bundleId,
    );
    const firstConfig = await saver.put(
      initialConfig(),
      checkpoint(checkpointOne, 1),
      metadata('input', -1, 'root'),
      { state: 1 },
    );
    const secondConfig = await saver.put(
      firstConfig,
      checkpoint(checkpointTwo, 2),
      metadata('loop', 0, 'child'),
      { state: 2 },
    );

    const all = [];
    for await (const tuple of saver.list(initialConfig())) all.push(tuple);
    expect(all.map(({ checkpoint: item }) => item.id)).toEqual([
      checkpointTwo,
      checkpointOne,
    ]);
    expect(all[0]?.parentConfig).toEqual(firstConfig);
    expect((await saver.getTuple(initialConfig()))?.checkpoint.id).toBe(
      checkpointTwo,
    );

    const before = [];
    for await (const tuple of saver.list(initialConfig(), {
      before: secondConfig,
    })) {
      before.push(tuple.checkpoint.id);
    }
    expect(before).toEqual([checkpointOne]);

    const filtered = [];
    for await (const tuple of saver.list(initialConfig(), {
      filter: { label: 'child' },
      limit: 1,
    })) {
      filtered.push(tuple.checkpoint.id);
    }
    expect(filtered).toEqual([checkpointTwo]);
  });

  it('reconciles an ambiguous checkpoint create and reconstructs after restart', async () => {
    const backend = new MemoryCheckpointBackend();
    const firstProcess = new FirestoreCheckpointSaver(backend, bundleId);
    backend.failAfterNextCreate = true;
    const storedConfig = await firstProcess.put(
      initialConfig(),
      checkpoint(checkpointOne, { durable: true }),
      metadata('input', -1, 'root'),
      { __start__: 1 },
    );

    const restartedProcess = new FirestoreCheckpointSaver(backend, bundleId);
    await expect(
      restartedProcess.getTuple(storedConfig),
    ).resolves.toMatchObject({
      checkpoint: checkpoint(checkpointOne, { durable: true }),
      metadata: metadata('input', -1, 'root'),
    });
  });

  it('reconciles ambiguous ordinary and special pending writes', async () => {
    const backend = new MemoryCheckpointBackend();
    const firstProcess = new FirestoreCheckpointSaver(backend, bundleId);
    const storedConfig = await firstProcess.put(
      initialConfig(),
      checkpoint(checkpointOne, { durable: true }),
      metadata('input', -1, 'root'),
      { __start__: 1 },
    );

    backend.failAfterNextCreate = true;
    await firstProcess.putWrites(
      storedConfig,
      [['alpha', { persisted: true }]],
      'task-ordinary',
      'ordinary-path',
    );
    backend.failAfterNextSet = true;
    await firstProcess.putWrites(
      storedConfig,
      [['__error__', { safe: true }]],
      'task-special',
      'special-path',
    );

    const restartedProcess = new FirestoreCheckpointSaver(backend, bundleId);
    await expect(
      restartedProcess.getTuple(storedConfig),
    ).resolves.toMatchObject({
      pendingWrites: [
        ['task-ordinary', 'alpha', { persisted: true }],
        ['task-special', '__error__', { safe: true }],
      ],
    });
  });

  it('rejects conflicting checkpoint reuse and bundle mismatch', async () => {
    const backend = new MemoryCheckpointBackend();
    const saver = new FirestoreCheckpointSaver(backend, bundleId);
    await saver.put(
      initialConfig(),
      checkpoint(checkpointOne, 1),
      metadata('input', -1, 'root'),
      { state: 1 },
    );
    await expect(
      saver.put(
        initialConfig(),
        checkpoint(checkpointOne, 999),
        metadata('input', -1, 'changed'),
        { state: 1 },
      ),
    ).rejects.toThrow(/already bound/u);
    await expect(
      saver.getTuple({
        configurable: {
          ...initialConfig().configurable,
          system_bundle_id: '77777777-7777-4777-8777-777777777777',
        },
      }),
    ).rejects.toThrow(/bundle mismatch/u);
  });

  it('rejects malformed stored records rather than normalizing them', async () => {
    const backend = new MemoryCheckpointBackend();
    const saver = new FirestoreCheckpointSaver(backend, bundleId);
    const config = await saver.put(
      initialConfig(),
      checkpoint(checkpointOne, 1),
      metadata('input', -1, 'root'),
      { state: 1 },
    );
    const path = [...backend.documents.keys()].find((key) =>
      key.includes('/checkpoints/'),
    );
    if (path === undefined) throw new Error('checkpoint fixture missing');
    const stored = backend.documents.get(path) as Record<string, unknown>;
    backend.documents.set(path, { ...stored, unexpected: true });
    await expect(saver.getTuple(config)).rejects.toThrow();
  });

  it('deletes only checkpoint state owned by the requested thread', async () => {
    const backend = new MemoryCheckpointBackend();
    const saver = new FirestoreCheckpointSaver(backend, bundleId);
    const config = await saver.put(
      initialConfig(),
      checkpoint(checkpointOne, 1),
      metadata('input', -1, 'root'),
      { state: 1 },
    );
    await saver.putWrites(config, [['state', 2]], 'task-a', 'a-path');
    backend.documents.set(`runs/${runId}/unrelated/keep`, { keep: true });

    await saver.deleteThread(runId);
    await expect(saver.getTuple(config)).resolves.toBeUndefined();
    expect(backend.documents.get(`runs/${runId}/unrelated/keep`)).toEqual({
      keep: true,
    });
  });
});
