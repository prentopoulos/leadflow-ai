import {
  HOSTED_TARGET,
  RETENTION_DAYS,
  RETENTION_FIELD,
  RETENTION_POLICY_VERSION,
} from '@leadflow-ai/domain';
import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore';

// Every collection group the application writes. Firestore TTL needs one
// policy per collection group, subcollections included, and the guarded purge
// deletes only these. A runtime test keeps this list equal to the paths the
// repositories actually use.
export const RETAINED_COLLECTION_GROUPS = [
  'leads',
  'idempotency',
  'runs',
  'events',
  'checkpoints',
  'checkpointWrites',
  'systemBundles',
  'qualificationResults',
  'simulationRecords',
  'enrichmentEvidence',
  'emailChecks',
  'verificationResults',
  'outreachDrafts',
  'revisions',
  'reviews',
] as const;

export const RETAINED_TOP_LEVEL_COLLECTIONS = [
  'leads',
  'idempotency',
  'runs',
  'systemBundles',
  'qualificationResults',
  'simulationRecords',
  'enrichmentEvidence',
  'emailChecks',
  'verificationResults',
  'outreachDrafts',
] as const;

export interface RetentionPolicy {
  version: typeof RETENTION_POLICY_VERSION;
  days: typeof RETENTION_DAYS;
  now: () => number;
}

export class RetentionStampError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetentionStampError';
  }
}

// Hosted boundaries register their policy against the Admin SDK instance, so
// every store built from that instance stamps the same expiry without each
// repository carrying the policy.
const policies = new WeakMap<Firestore, RetentionPolicy>();

export function registerRetentionPolicy(
  database: Firestore,
  policy: RetentionPolicy,
): void {
  policies.set(database, policy);
}

export function retentionPolicyFor(
  database: Firestore,
): RetentionPolicy | undefined {
  return policies.get(database);
}

export function hostedRetentionPolicy(
  now: () => number = Date.now,
): RetentionPolicy {
  return { version: RETENTION_POLICY_VERSION, days: RETENTION_DAYS, now };
}

// Firestore TTL acts only on "Date and time" values and silently ignores
// text, so the stamp is always a Timestamp and is never derived from the ISO
// strings the domain records use.
export function isRetentionTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}

export function assertRetentionStamp(data: DocumentData): void {
  if (!(data[RETENTION_FIELD] instanceof Timestamp)) {
    throw new RetentionStampError(
      'Hosted documents must carry a timestamp-typed expiresAt.',
    );
  }
}

export function stampRetention(
  database: Firestore,
  data: DocumentData,
): DocumentData {
  const policy = policies.get(database);
  if (policy === undefined) return data;
  if (RETENTION_FIELD in data) {
    throw new RetentionStampError(
      'Domain records must not supply the retention field.',
    );
  }
  const stamped = {
    ...data,
    [RETENTION_FIELD]: Timestamp.fromMillis(
      policy.now() + policy.days * 24 * 60 * 60 * 1000,
    ),
  };
  assertRetentionStamp(stamped);
  return stamped;
}

// Reads hand domain schemas exactly the record they wrote. Only a real
// Timestamp is removed; any other expiresAt value stays and fails strict
// schema validation instead of being normalized away.
export function withoutRetention(data: DocumentData | undefined): unknown {
  if (data === undefined) return undefined;
  if (!(data[RETENTION_FIELD] instanceof Timestamp)) return data;
  const record = { ...data };
  delete record[RETENTION_FIELD];
  return record;
}

export const HOSTED_PURGE_CONFIRMATION =
  'PURGE SYNTHETIC LEADFLOW HOSTED DATA' as const;

export class HostedPurgeDeniedError extends Error {
  readonly code = 'purge_denied' as const;

  constructor(message: string) {
    super(message);
    this.name = 'HostedPurgeDeniedError';
  }
}

export interface HostedPurgeRequest {
  // The boundary's own configuration and the operator's explicit target must
  // name the same project and database.
  configured: { projectId: string; databaseId: string };
  requested: { projectId: string; databaseId: string };
  confirmation: string;
  operatorAuthenticated: boolean;
}

export interface HostedPurgeResult {
  deletedCollections: string[];
  unknownCollections: string[];
}

export function assertHostedPurgeAllowed(request: HostedPurgeRequest): void {
  if (!request.operatorAuthenticated) {
    throw new HostedPurgeDeniedError('Purge requires the authenticated owner.');
  }
  if (
    request.configured.projectId !== request.requested.projectId ||
    request.configured.databaseId !== request.requested.databaseId
  ) {
    throw new HostedPurgeDeniedError(
      'Purge target does not match the configured project and database.',
    );
  }
  if (request.requested.databaseId !== HOSTED_TARGET.firestore.database) {
    throw new HostedPurgeDeniedError('Purge database is not the accepted one.');
  }
  if (request.requested.projectId.startsWith('demo-')) {
    throw new HostedPurgeDeniedError(
      'Use the guarded local reset for emulator data.',
    );
  }
  if (request.confirmation !== HOSTED_PURGE_CONFIRMATION) {
    throw new HostedPurgeDeniedError('Purge confirmation did not match.');
  }
}

export interface PurgeDatabase {
  listCollections(): Promise<{ id: string }[]>;
  recursiveDelete(reference: { id: string }): Promise<void>;
}

// Intentionally unrecoverable: no backup or PITR exists for synthetic data.
// It stops before deleting anything when an unexpected collection exists.
export async function purgeHostedData(
  database: PurgeDatabase,
  request: HostedPurgeRequest,
): Promise<HostedPurgeResult> {
  assertHostedPurgeAllowed(request);
  const collections = await database.listCollections();
  const known = new Set<string>(RETAINED_TOP_LEVEL_COLLECTIONS);
  const unknownCollections = collections
    .map(({ id }) => id)
    .filter((id) => !known.has(id))
    .sort();
  if (unknownCollections.length > 0) {
    return { deletedCollections: [], unknownCollections };
  }
  const deletedCollections: string[] = [];
  for (const collection of collections) {
    await database.recursiveDelete(collection);
    deletedCollections.push(collection.id);
  }
  return { deletedCollections: deletedCollections.sort(), unknownCollections };
}
