import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import {
  initializeFirestore,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore';
import { LEADFLOW_LOCAL_PROJECT_ID } from '@leadflow-ai/domain';

export const LEADFLOW_FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080' as const;

export interface EmulatorFirestoreConfiguration {
  projectId: typeof LEADFLOW_LOCAL_PROJECT_ID;
  host: typeof LEADFLOW_FIRESTORE_EMULATOR_HOST;
}

export function validateEmulatorFirestoreConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): EmulatorFirestoreConfiguration {
  const projectId = environment.GCLOUD_PROJECT;
  const host = environment.FIRESTORE_EMULATOR_HOST;
  if (projectId !== LEADFLOW_LOCAL_PROJECT_ID) {
    throw new Error(
      `Unsafe Firestore project: expected ${LEADFLOW_LOCAL_PROJECT_ID}.`,
    );
  }
  if (host !== LEADFLOW_FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      `Unsafe Firestore host: expected ${LEADFLOW_FIRESTORE_EMULATOR_HOST} without a protocol.`,
    );
  }
  return { projectId, host };
}

export interface EmulatorFirestoreBoundary {
  app: App;
  database: Firestore;
  configuration: EmulatorFirestoreConfiguration;
  close(): Promise<void>;
}

export function createEmulatorFirestoreBoundary(
  environment: NodeJS.ProcessEnv = process.env,
): EmulatorFirestoreBoundary {
  const configuration = validateEmulatorFirestoreConfiguration(environment);
  const app = initializeApp(
    { projectId: configuration.projectId },
    `leadflow-ai-emulator-${randomUUID()}`,
  );
  const database = initializeFirestore(app, {});
  return {
    app,
    database,
    configuration,
    close: async () => {
      await deleteApp(app);
    },
  };
}

export interface FirestoreDocumentStore {
  create(path: string, data: DocumentData): Promise<void>;
  get(path: string): Promise<unknown | null>;
}

export class AdminFirestoreDocumentStore implements FirestoreDocumentStore {
  constructor(private readonly database: Firestore) {}

  async create(path: string, data: DocumentData): Promise<void> {
    await this.database.doc(path).create(data);
  }

  async get(path: string): Promise<unknown | null> {
    const snapshot = await this.database.doc(path).get();
    return snapshot.exists ? snapshot.data() : null;
  }
}
