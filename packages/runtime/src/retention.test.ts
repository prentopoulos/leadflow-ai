import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import {
  HOSTED_PURGE_CONFIRMATION,
  HostedPurgeDeniedError,
  RETAINED_COLLECTION_GROUPS,
  RETAINED_TOP_LEVEL_COLLECTIONS,
  RetentionStampError,
  assertRetentionStamp,
  hostedRetentionPolicy,
  purgeHostedData,
  registerRetentionPolicy,
  stampRetention,
  withoutRetention,
  type HostedPurgeRequest,
} from './retention.js';
import {
  createCloudFirestoreBoundary,
  validateCloudFirestoreConfiguration,
} from './firestore.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('seven-day timestamp retention', () => {
  it('stamps a Firestore Timestamp exactly seven days ahead', () => {
    const database = {} as Firestore;
    registerRetentionPolicy(
      database,
      hostedRetentionPolicy(() => 1_000),
    );
    const record = { recordedAt: '2026-10-26T00:00:00.000Z', value: 1 };
    const stamped = stampRetention(database, record);
    expect(stamped.expiresAt).toBeInstanceOf(Timestamp);
    expect((stamped.expiresAt as Timestamp).toMillis()).toBe(
      1_000 + 7 * DAY_MS,
    );
    // Domain evidence and event time are untouched.
    expect(stamped).toMatchObject(record);
    expect(record).not.toHaveProperty('expiresAt');
  });

  it('leaves unregistered (local emulator) writes unchanged', () => {
    const record = { value: 1 };
    expect(stampRetention({} as Firestore, record)).toBe(record);
  });

  it('refuses a domain record that supplies its own expiry', () => {
    const database = {} as Firestore;
    registerRetentionPolicy(database, hostedRetentionPolicy());
    expect(() =>
      stampRetention(database, { expiresAt: '2026-11-02T00:00:00.000Z' }),
    ).toThrow(RetentionStampError);
  });

  it.each([
    ['text', '2026-11-02T00:00:00.000Z'],
    ['null', null],
    ['number', 1_765_000_000_000],
    ['missing', undefined],
  ])(
    'rejects a %s expiry, which TTL would silently ignore',
    (_label, value) => {
      expect(() => assertRetentionStamp({ expiresAt: value })).toThrow(
        RetentionStampError,
      );
    },
  );

  it('removes only a real Timestamp on read', () => {
    const expiresAt = Timestamp.fromMillis(0);
    expect(withoutRetention({ value: 1, expiresAt })).toEqual({ value: 1 });
    // Anything else stays and fails strict schema validation downstream.
    expect(withoutRetention({ value: 1, expiresAt: 'text' })).toEqual({
      value: 1,
      expiresAt: 'text',
    });
    expect(withoutRetention(undefined)).toBeUndefined();
  });
});

describe('collection-group coverage', () => {
  it('names every collection group the runtime writes', async () => {
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const sources = (await readdir(directory)).filter(
      (file) => file.endsWith('.ts') && !file.includes('.test'),
    );
    const groups = new Set<string>();
    for (const file of sources) {
      const text = await readFile(path.join(directory, file), 'utf8');
      // Path templates such as `runs/${id}/events/${eventId}`.
      for (const match of text.matchAll(/`([a-zA-Z]+)\/\$\{[^`]*`/gu)) {
        const template = match[0];
        for (const segment of template.matchAll(
          /(?:^`|\}\/)([a-zA-Z]+)(?=\/|`)/gu,
        )) {
          if (segment[1] !== undefined) groups.add(segment[1]);
        }
        if (match[1] !== undefined) groups.add(match[1]);
      }
    }
    groups.delete('emulator');
    expect([...groups].sort()).toEqual([...RETAINED_COLLECTION_GROUPS].sort());
    for (const topLevel of RETAINED_TOP_LEVEL_COLLECTIONS) {
      expect(RETAINED_COLLECTION_GROUPS).toContain(topLevel);
    }
  });
});

describe('guarded hosted purge', () => {
  const allowed: HostedPurgeRequest = {
    configured: {
      projectId: 'synthetic-hosted-project',
      databaseId: '(default)',
    },
    requested: {
      projectId: 'synthetic-hosted-project',
      databaseId: '(default)',
    },
    confirmation: HOSTED_PURGE_CONFIRMATION,
    operator: {
      requiredAccount: 'owner@example.com',
      authenticatedAccount: 'owner@example.com',
    },
  };

  function fakeDatabase(ids: string[]) {
    const deleted: string[] = [];
    return {
      deleted,
      target: {
        projectId: 'synthetic-hosted-project',
        databaseId: '(default)',
      },
      listCollections: async () => ids.map((id) => ({ id })),
      recursiveDelete: async (reference: { id: string }) => {
        deleted.push(reference.id);
      },
    };
  }

  it.each([
    [
      'unauthenticated operator',
      {
        operator: {
          requiredAccount: 'owner@example.com',
          authenticatedAccount: null,
        },
      },
    ],
    [
      'different operator',
      {
        operator: {
          requiredAccount: 'owner@example.com',
          authenticatedAccount: 'other@example.com',
        },
      },
    ],
    [
      'different project',
      {
        requested: { projectId: 'other-project-name', databaseId: '(default)' },
      },
    ],
    [
      'different database',
      {
        configured: {
          projectId: 'synthetic-hosted-project',
          databaseId: 'other',
        },
        requested: {
          projectId: 'synthetic-hosted-project',
          databaseId: 'other',
        },
      },
    ],
    [
      'emulator project',
      {
        configured: {
          projectId: 'demo-leadflow-ai-local',
          databaseId: '(default)',
        },
        requested: {
          projectId: 'demo-leadflow-ai-local',
          databaseId: '(default)',
        },
      },
    ],
    ['missing confirmation', { confirmation: 'yes' }],
  ])('issues no delete for a %s', async (_label, change) => {
    const database = fakeDatabase(['leads', 'runs']);
    await expect(
      purgeHostedData(database, { ...allowed, ...change }),
    ).rejects.toThrow(HostedPurgeDeniedError);
    expect(database.deleted).toEqual([]);
  });

  it('stops before deleting when an unexpected collection exists', async () => {
    const database = fakeDatabase(['leads', 'billingExports']);
    await expect(purgeHostedData(database, allowed)).resolves.toEqual({
      deletedCollections: [],
      unknownCollections: ['billingExports'],
    });
    expect(database.deleted).toEqual([]);
  });

  it('stops before deleting when the connection target differs', async () => {
    const database = fakeDatabase(['leads']);
    database.target.projectId = 'different-hosted-project';
    await expect(purgeHostedData(database, allowed)).rejects.toThrow(
      HostedPurgeDeniedError,
    );
    expect(database.deleted).toEqual([]);
  });

  it('recursively deletes only the known application collections', async () => {
    const database = fakeDatabase(['runs', 'leads', 'systemBundles']);
    await expect(purgeHostedData(database, allowed)).resolves.toEqual({
      deletedCollections: ['leads', 'runs', 'systemBundles'],
      unknownCollections: [],
    });
  });
});

describe('hosted Firestore boundary', () => {
  const configuration = {
    projectId: 'synthetic-hosted-project',
    databaseId: '(default)',
  };

  it.each([
    ['emulator host', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }],
    ['key file', { GOOGLE_APPLICATION_CREDENTIALS: '/tmp/key.json' }],
  ])('refuses ADC mode with a %s present', (_label, environment) => {
    expect(() =>
      validateCloudFirestoreConfiguration(configuration, environment),
    ).toThrow(/Unsafe Firestore/u);
  });

  it.each([
    [{ projectId: 'demo-leadflow-ai-local', databaseId: '(default)' }],
    [{ projectId: 'Bad_Project', databaseId: '(default)' }],
    [{ projectId: 'synthetic-hosted-project', databaseId: 'leadflow' }],
  ])('refuses an unaccepted target %#', (target) => {
    expect(() => validateCloudFirestoreConfiguration(target, {})).toThrow(
      /Unsafe Firestore/u,
    );
  });

  it('registers retention on the hosted Admin SDK instance without network', async () => {
    const boundary = createCloudFirestoreBoundary(configuration, {}, () => 0);
    try {
      const stamped = stampRetention(boundary.database, { value: 1 });
      expect((stamped.expiresAt as Timestamp).toMillis()).toBe(7 * DAY_MS);
    } finally {
      await boundary.close();
    }
  });
});
