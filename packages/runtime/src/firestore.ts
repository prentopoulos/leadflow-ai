import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import {
  initializeFirestore,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  GoogleCloudProjectIdSchema,
  HOSTED_TARGET,
  LEADFLOW_LOCAL_PROJECT_ID,
} from '@leadflow-ai/domain';
import {
  hostedRetentionPolicy,
  registerRetentionPolicy,
  stampRetention,
  withoutRetention,
} from './retention.js';

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
  database.settings({
    host: configuration.host,
    ssl: false,
  });
  return {
    app,
    database,
    configuration,
    close: async () => {
      await deleteApp(app);
    },
  };
}

export interface CloudFirestoreConfiguration {
  projectId: string;
  databaseId: typeof HOSTED_TARGET.firestore.database;
}

export interface CloudFirestoreBoundary {
  app: App;
  database: Firestore;
  configuration: CloudFirestoreConfiguration;
  close(): Promise<void>;
}

export type FirestoreBoundary =
  EmulatorFirestoreBoundary | CloudFirestoreBoundary;

// Hosted state uses Application Default Credentials (the Cloud Run runtime
// identity) and the exact accepted database. An emulator host or a key file in
// the environment means the process could reach the wrong store, so startup
// refuses rather than guessing.
export function validateCloudFirestoreConfiguration(
  configuration: { projectId: string; databaseId: string },
  environment: Readonly<Record<string, string | undefined>>,
): CloudFirestoreConfiguration {
  if (environment.FIRESTORE_EMULATOR_HOST !== undefined) {
    throw new Error('Unsafe Firestore: hosted mode forbids an emulator host.');
  }
  if (environment.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
    throw new Error('Unsafe Firestore: hosted mode uses ADC, not a key file.');
  }
  const projectId = GoogleCloudProjectIdSchema.safeParse(
    configuration.projectId,
  );
  if (!projectId.success) {
    throw new Error('Unsafe Firestore: hosted project ID is invalid.');
  }
  if (configuration.databaseId !== HOSTED_TARGET.firestore.database) {
    throw new Error('Unsafe Firestore: hosted database is not accepted.');
  }
  return {
    projectId: projectId.data,
    databaseId: HOSTED_TARGET.firestore.database,
  };
}

export function createCloudFirestoreBoundary(
  configuration: { projectId: string; databaseId: string },
  environment: NodeJS.ProcessEnv = process.env,
  now: () => number = Date.now,
): CloudFirestoreBoundary {
  const validated = validateCloudFirestoreConfiguration(
    configuration,
    environment,
  );
  // No credential option: the Admin SDK resolves ADC from the metadata server.
  const app = initializeApp(
    { projectId: validated.projectId },
    `leadflow-ai-cloud-${randomUUID()}`,
  );
  const database = initializeFirestore(app, {}, validated.databaseId);
  registerRetentionPolicy(database, hostedRetentionPolicy(now));
  return {
    app,
    database,
    configuration: validated,
    close: async () => {
      await deleteApp(app);
    },
  };
}

export interface FirestoreDocumentStore {
  create(path: string, data: DocumentData): Promise<void>;
  set(path: string, data: DocumentData): Promise<void>;
  get(path: string): Promise<unknown | null>;
}

export interface FirestoreAtomicTransaction {
  get(path: string): Promise<unknown | null>;
  create(path: string, data: DocumentData): void;
  update(path: string, data: DocumentData): void;
}

export interface FirestoreAtomicStore {
  runTransaction<T>(
    operation: (transaction: FirestoreAtomicTransaction) => Promise<T>,
  ): Promise<T>;
}

export class AdminFirestoreDocumentStore implements FirestoreDocumentStore {
  constructor(private readonly database: Firestore) {}

  async create(path: string, data: DocumentData): Promise<void> {
    await this.database.doc(path).create(stampRetention(this.database, data));
  }

  async set(path: string, data: DocumentData): Promise<void> {
    await this.database.doc(path).set(stampRetention(this.database, data));
  }

  async get(path: string): Promise<unknown | null> {
    const snapshot = await this.database.doc(path).get();
    return snapshot.exists ? withoutRetention(snapshot.data()) : null;
  }
}

export class AdminFirestoreAtomicStore implements FirestoreAtomicStore {
  constructor(private readonly database: Firestore) {}

  async runTransaction<T>(
    operation: (transaction: FirestoreAtomicTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.runTransaction(async (transaction) =>
      operation({
        get: async (path) => {
          const snapshot = await transaction.get(this.database.doc(path));
          return snapshot.exists ? withoutRetention(snapshot.data()) : null;
        },
        create: (path, data) => {
          transaction.create(
            this.database.doc(path),
            stampRetention(this.database, data),
          );
        },
        update: (path, data) => {
          transaction.update(this.database.doc(path), data);
        },
      }),
    );
  }
}
