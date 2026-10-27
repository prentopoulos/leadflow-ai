// In-memory Firestore double for Phase 2 runtime tests: document create/get,
// all-or-nothing transactions, and ordered subcollection listings.
import type { DocumentData } from 'firebase-admin/firestore';
import type { DraftReader } from './drafts.js';
import type {
  FirestoreAtomicStore,
  FirestoreAtomicTransaction,
  FirestoreDocumentStore,
} from './firestore.js';
import type { RunEventReader } from './run-detail.js';

export class MemoryFirestore
  implements FirestoreDocumentStore, FirestoreAtomicStore
{
  readonly documents = new Map<string, unknown>();

  async create(path: string, data: DocumentData): Promise<void> {
    if (this.documents.has(path)) throw new Error(`${path} already exists`);
    this.documents.set(path, structuredClone(data));
  }

  async set(path: string, data: DocumentData): Promise<void> {
    this.documents.set(path, structuredClone(data));
  }

  async get(path: string): Promise<unknown | null> {
    return structuredClone(this.documents.get(path) ?? null);
  }

  async runTransaction<T>(
    operation: (transaction: FirestoreAtomicTransaction) => Promise<T>,
  ): Promise<T> {
    const staged = new Map(
      [...this.documents].map(([path, value]) => [
        path,
        structuredClone(value),
      ]),
    );
    const result = await operation({
      get: async (path) => structuredClone(staged.get(path) ?? null),
      create: (path, data) => {
        if (staged.has(path)) throw new Error(`${path} already exists`);
        staged.set(path, structuredClone(data));
      },
      update: (path, data) => {
        if (!staged.has(path)) throw new Error(`${path} not found`);
        staged.set(path, structuredClone(data));
      },
    });
    this.documents.clear();
    for (const [path, value] of staged) this.documents.set(path, value);
    return result;
  }

  // Direct children of a collection path, sorted by one field.
  list(collection: string, orderBy: string): unknown[] {
    const prefix = `${collection}/`;
    return [...this.documents]
      .filter(
        ([path]) =>
          path.startsWith(prefix) && !path.slice(prefix.length).includes('/'),
      )
      .map(([, value]) => structuredClone(value) as Record<string, unknown>)
      .sort((left, right) =>
        String(left[orderBy]).localeCompare(String(right[orderBy]), 'en', {
          numeric: true,
        }),
      );
  }

  eventReader(): RunEventReader {
    return {
      list: async (runId, limit) =>
        this.list(`runs/${runId}/events`, 'sequence').slice(0, limit),
    };
  }

  draftReader(): DraftReader {
    return {
      revisions: async (draftId) =>
        this.list(`outreachDrafts/${draftId}/revisions`, 'revisionNumber'),
      reviews: async (draftId) =>
        this.list(`outreachDrafts/${draftId}/reviews`, 'decidedAt'),
    };
  }
}
