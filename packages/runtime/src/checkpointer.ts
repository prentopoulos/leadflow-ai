import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  CheckpointDocumentSchema,
  PendingWriteDocumentSchema,
  type CheckpointDocument,
} from '@leadflow-ai/domain';
import type { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver,
  WRITES_IDX_MAP,
  compareWritesSortKeys,
  type ChannelVersions,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
  type PendingWrite,
} from '@langchain/langgraph-checkpoint';
import type {
  DocumentData,
  DocumentReference,
  Firestore,
} from 'firebase-admin/firestore';
import { stampRetention, withoutRetention } from './retention.js';

export interface FirestoreCheckpointBackend {
  createIfAbsent(path: string, data: DocumentData): Promise<unknown | null>;
  set(path: string, data: DocumentData): Promise<void>;
  get(path: string): Promise<unknown | null>;
  list(collectionPath: string): Promise<unknown[]>;
  deleteCollections(collectionPaths: readonly string[]): Promise<void>;
}

export class AdminFirestoreCheckpointBackend implements FirestoreCheckpointBackend {
  constructor(private readonly database: Firestore) {}

  async createIfAbsent(
    path: string,
    data: DocumentData,
  ): Promise<unknown | null> {
    return this.database.runTransaction(async (transaction) => {
      const reference = this.database.doc(path);
      const existing = await transaction.get(reference);
      if (existing.exists) return withoutRetention(existing.data()) ?? null;
      transaction.create(reference, stampRetention(this.database, data));
      return null;
    });
  }

  async set(path: string, data: DocumentData): Promise<void> {
    await this.database.doc(path).set(stampRetention(this.database, data));
  }

  async get(path: string): Promise<unknown | null> {
    const snapshot = await this.database.doc(path).get();
    return snapshot.exists ? withoutRetention(snapshot.data()) : null;
  }

  async list(collectionPath: string): Promise<unknown[]> {
    const snapshot = await this.database.collection(collectionPath).get();
    return snapshot.docs.map((document) => withoutRetention(document.data()));
  }

  async deleteCollections(collectionPaths: readonly string[]): Promise<void> {
    const references: DocumentReference[] = [];
    for (const collectionPath of collectionPaths) {
      const snapshot = await this.database.collection(collectionPath).get();
      references.push(...snapshot.docs.map(({ ref }) => ref));
    }
    for (let start = 0; start < references.length; start += 450) {
      const batch = this.database.batch();
      for (const reference of references.slice(start, start + 450)) {
        batch.delete(reference);
      }
      await batch.commit();
    }
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function checkpointCollection(runId: string): string {
  return `runs/${assertIdentifier(runId, 'thread_id')}/checkpoints`;
}

function writesCollection(runId: string): string {
  return `runs/${assertIdentifier(runId, 'thread_id')}/checkpointWrites`;
}

function checkpointPath(
  runId: string,
  systemBundleId: string,
  namespace: string,
  checkpointId: string,
): string {
  const storageId = sha256(
    ['checkpoint', systemBundleId, namespace, checkpointId].join('\0'),
  );
  return `${checkpointCollection(runId)}/${storageId}`;
}

function pendingWritePath(
  runId: string,
  systemBundleId: string,
  namespace: string,
  checkpointId: string,
  taskId: string,
  writeIndex: number,
): string {
  const storageId = sha256(
    [
      'pending-write',
      systemBundleId,
      namespace,
      checkpointId,
      taskId,
      String(writeIndex),
    ].join('\0'),
  );
  return `${writesCollection(runId)}/${storageId}`;
}

function assertIdentifier(value: unknown, name: string): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 200 ||
    value.includes('/')
  ) {
    throw new Error(`Invalid LangGraph ${name}.`);
  }
  return value;
}

function assertUuid(value: string, name: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new Error(`Invalid ${name}.`);
  }
  return value;
}

function parseStored<T>(
  schema: { parse(candidate: unknown): T },
  candidate: unknown,
): T {
  const parsed = schema.parse(candidate);
  if (!isDeepStrictEqual(parsed, candidate)) {
    throw new Error('Stored checkpoint state required normalization.');
  }
  return parsed;
}

interface CheckpointIdentity {
  runId: string;
  namespace: string;
  checkpointId: string | null;
}

export class FirestoreCheckpointSaver extends BaseCheckpointSaver {
  constructor(
    private readonly backend: FirestoreCheckpointBackend,
    private readonly systemBundleId: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    super();
    assertUuid(systemBundleId, 'system bundle ID');
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const identity = this.identity(config, false);
    let stored: CheckpointDocument | undefined;
    if (identity.checkpointId !== null) {
      const candidate = await this.backend.get(
        checkpointPath(
          identity.runId,
          this.systemBundleId,
          identity.namespace,
          identity.checkpointId,
        ),
      );
      if (candidate === null) return undefined;
      stored = this.parseCheckpoint(candidate);
    } else {
      stored = (await this.checkpoints(identity.runId, identity.namespace))[0];
      if (stored === undefined) return undefined;
    }
    return this.tuple(stored);
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const identity = this.identity(config, false);
    const requestedId = identity.checkpointId;
    const beforeId = this.optionalCheckpointId(options?.before);
    let remaining = options?.limit;
    if (remaining !== undefined && remaining <= 0) return;
    for (const stored of await this.checkpoints(
      identity.runId,
      identity.namespace,
    )) {
      if (requestedId !== null && stored.checkpointId !== requestedId) continue;
      if (beforeId !== null && stored.checkpointId >= beforeId) continue;
      const tuple = await this.tuple(stored);
      if (
        options?.filter !== undefined &&
        !Object.entries(options.filter).every(([key, value]) =>
          isDeepStrictEqual(
            (tuple.metadata as Record<string, unknown> | undefined)?.[key],
            value,
          ),
        )
      ) {
        continue;
      }
      yield tuple;
      if (remaining !== undefined) {
        remaining -= 1;
        if (remaining <= 0) return;
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const identity = this.identity(config, false);
    const checkpointId = assertIdentifier(checkpoint.id, 'checkpoint_id');
    const [serializedCheckpoint, serializedMetadata] = await Promise.all([
      this.serialize(checkpoint),
      this.serialize(metadata),
    ]);
    const document = CheckpointDocumentSchema.parse({
      schemaVersion: 'checkpoint-v1',
      runId: identity.runId,
      threadId: identity.runId,
      namespace: identity.namespace,
      checkpointId,
      parentCheckpointId: identity.checkpointId,
      checkpoint: serializedCheckpoint,
      metadata: serializedMetadata,
      channelVersions: Object.entries(newVersions)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([channel, version]) => ({ channel, version })),
      systemBundleId: this.systemBundleId,
      createdAt: checkpoint.ts,
    });
    const path = checkpointPath(
      identity.runId,
      this.systemBundleId,
      identity.namespace,
      checkpointId,
    );
    let existing: unknown | null;
    try {
      existing = await this.backend.createIfAbsent(path, document);
    } catch (error) {
      existing = await this.backend.get(path);
      if (existing === null) throw error;
    }
    if (
      existing !== null &&
      !isDeepStrictEqual(this.parseCheckpoint(existing), document)
    ) {
      throw new Error('Checkpoint identity is already bound to other state.');
    }
    return this.config(identity.runId, identity.namespace, checkpointId);
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
    taskPath = '',
  ): Promise<void> {
    const identity = this.identity(config, true);
    const safeTaskId = assertIdentifier(taskId, 'task_id');
    if (taskPath.length > 400) throw new Error('Invalid LangGraph task_path.');
    await Promise.all(
      writes.map(async ([channel, value], position) => {
        const writeIndex = WRITES_IDX_MAP[channel] ?? position;
        const document = PendingWriteDocumentSchema.parse({
          schemaVersion: 'pending-write-v1',
          runId: identity.runId,
          threadId: identity.runId,
          namespace: identity.namespace,
          checkpointId: identity.checkpointId,
          taskId: safeTaskId,
          taskPath,
          writeIndex,
          channel,
          value: await this.serialize(value),
          systemBundleId: this.systemBundleId,
          createdAt: this.now(),
        });
        const path = pendingWritePath(
          identity.runId,
          this.systemBundleId,
          identity.namespace,
          identity.checkpointId,
          safeTaskId,
          writeIndex,
        );
        if (writeIndex < 0) {
          try {
            await this.backend.set(path, document);
          } catch (error) {
            const stored = await this.backend.get(path);
            if (
              stored === null ||
              !isDeepStrictEqual(
                parseStored(PendingWriteDocumentSchema, stored),
                document,
              )
            ) {
              throw error;
            }
          }
          return;
        }
        let existing: unknown | null;
        try {
          existing = await this.backend.createIfAbsent(path, document);
        } catch (error) {
          existing = await this.backend.get(path);
          if (existing === null) throw error;
        }
        if (existing !== null) {
          parseStored(PendingWriteDocumentSchema, existing);
        }
      }),
    );
  }

  async deleteThread(threadId: string): Promise<void> {
    const runId = assertUuid(
      assertIdentifier(threadId, 'thread_id'),
      'thread ID',
    );
    await this.backend.deleteCollections([
      checkpointCollection(runId),
      writesCollection(runId),
    ]);
  }

  private identity(
    config: RunnableConfig,
    requireCheckpoint: boolean,
  ): CheckpointIdentity & { checkpointId: string };
  private identity(
    config: RunnableConfig,
    requireCheckpoint: false,
  ): CheckpointIdentity;
  private identity(
    config: RunnableConfig,
    requireCheckpoint: boolean,
  ): CheckpointIdentity {
    const configurable = config.configurable ?? {};
    const runId = assertUuid(
      assertIdentifier(configurable.thread_id, 'thread_id'),
      'thread ID',
    );
    const namespaceValue = configurable.checkpoint_ns ?? '';
    if (typeof namespaceValue !== 'string' || namespaceValue.length > 120) {
      throw new Error('Invalid LangGraph checkpoint_ns.');
    }
    const configuredBundle = configurable.system_bundle_id;
    if (
      configuredBundle !== undefined &&
      configuredBundle !== this.systemBundleId
    ) {
      throw new Error('Checkpoint system bundle mismatch.');
    }
    const rawCheckpointId = configurable.checkpoint_id;
    if (rawCheckpointId === undefined && requireCheckpoint) {
      throw new Error('LangGraph checkpoint_id is required.');
    }
    return {
      runId,
      namespace: namespaceValue,
      checkpointId:
        rawCheckpointId === undefined
          ? null
          : assertIdentifier(rawCheckpointId, 'checkpoint_id'),
    };
  }

  private optionalCheckpointId(config: RunnableConfig | undefined) {
    const value = config?.configurable?.checkpoint_id;
    return value === undefined
      ? null
      : assertIdentifier(value, 'checkpoint_id');
  }

  private config(
    runId: string,
    namespace: string,
    checkpointId: string,
  ): RunnableConfig {
    return {
      configurable: {
        thread_id: runId,
        checkpoint_ns: namespace,
        checkpoint_id: checkpointId,
        system_bundle_id: this.systemBundleId,
      },
    };
  }

  private parseCheckpoint(candidate: unknown): CheckpointDocument {
    const parsed = parseStored(CheckpointDocumentSchema, candidate);
    if (parsed.systemBundleId !== this.systemBundleId) {
      throw new Error('Stored checkpoint system bundle mismatch.');
    }
    return parsed;
  }

  private async checkpoints(runId: string, namespace: string) {
    const candidates = await this.backend.list(checkpointCollection(runId));
    return candidates
      .map((candidate) => this.parseCheckpoint(candidate))
      .filter(
        (document) =>
          document.namespace === namespace &&
          document.systemBundleId === this.systemBundleId,
      )
      .sort((left, right) =>
        right.checkpointId.localeCompare(left.checkpointId),
      );
  }

  private async pendingWrites(document: CheckpointDocument) {
    const candidates = await this.backend.list(
      writesCollection(document.runId),
    );
    const writes = candidates
      .map((candidate) => parseStored(PendingWriteDocumentSchema, candidate))
      .filter(
        (write) =>
          write.namespace === document.namespace &&
          write.checkpointId === document.checkpointId &&
          write.systemBundleId === this.systemBundleId,
      )
      .sort((left, right) =>
        compareWritesSortKeys(
          [left.taskPath, left.taskId, left.writeIndex],
          [right.taskPath, right.taskId, right.writeIndex],
        ),
      );
    return Promise.all(
      writes.map(
        async (write) =>
          [
            write.taskId,
            write.channel,
            await this.deserialize(write.value),
          ] as [string, string, unknown],
      ),
    );
  }

  private async tuple(document: CheckpointDocument): Promise<CheckpointTuple> {
    const tuple: CheckpointTuple = {
      config: this.config(
        document.runId,
        document.namespace,
        document.checkpointId,
      ),
      checkpoint: (await this.deserialize(document.checkpoint)) as Checkpoint,
      metadata: (await this.deserialize(
        document.metadata,
      )) as CheckpointMetadata,
      pendingWrites: await this.pendingWrites(document),
    };
    if (document.parentCheckpointId !== null) {
      tuple.parentConfig = this.config(
        document.runId,
        document.namespace,
        document.parentCheckpointId,
      );
    }
    return tuple;
  }

  private async serialize(value: unknown) {
    const [type, data] = await this.serde.dumpsTyped(value);
    return { type, data: Buffer.from(data).toString('base64') };
  }

  private async deserialize(value: { type: string; data: string }) {
    return this.serde.loadsTyped(value.type, Buffer.from(value.data, 'base64'));
  }
}

export function createFirestoreCheckpointSaver(
  database: Firestore,
  systemBundleId: string,
): FirestoreCheckpointSaver {
  return new FirestoreCheckpointSaver(
    new AdminFirestoreCheckpointBackend(database),
    systemBundleId,
  );
}
