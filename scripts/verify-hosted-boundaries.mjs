// Phase 3 boundaries proved against the isolated emulator (synthetic data):
// timestamp-typed TTL on real writes, strict reads that remove only the
// stamp, client denial by the deny-all rules, and the purge guard. Called by
// verify-runtime-firestore.mjs before its final verified flush.
import { randomUUID } from 'node:crypto';
import {
  HOSTED_PURGE_CONFIRMATION,
  HostedPurgeDeniedError,
  createEmulatorFirestoreBoundary,
  createFirestoreRepositories,
  createIntakePersistenceService,
  hostedRetentionPolicy,
  isRetentionTimestamp,
  purgeHostedData,
  registerRetentionPolicy,
} from '../packages/runtime/dist/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const EMULATOR_DOCUMENTS =
  'http://127.0.0.1:8080/v1/projects/demo-leadflow-ai-local/databases/(default)/documents';

export async function verifyHostedBoundaries({ systemBundleId }) {
  const fixedNow = Date.parse('2026-10-26T12:00:00.000Z');
  const hosted = createEmulatorFirestoreBoundary();
  try {
    // The hosted boundary registers this policy on its own Admin SDK
    // instance; the probe does the same on a separate emulator instance.
    registerRetentionPolicy(
      hosted.database,
      hostedRetentionPolicy(() => fixedNow),
    );
    const accepted = await createIntakePersistenceService(
      hosted.database,
    ).persist({
      idempotencyKey: `hosted-retention-probe-${randomUUID()}`,
      intake: {
        schemaVersion: 'intake-v2',
        identityClass: 'fictional',
        givenName: 'Riley',
        familyName: 'Example',
        email: 'riley@example.com',
        zipCode: '22150',
        vehicleYear: 2020,
        vehicleMake: 'Subaru',
        vehicleModel: 'Outback',
        coverageFocus: 'balanced',
        requestIntent: 'compare_options',
        needTimeline: 'days_31_to_90',
        requestDetails: 'Synthetic hosted retention probe.',
        emailContactConsent: false,
        consentRecord: null,
      },
      systemBundleId,
      traceId: randomUUID(),
      requestId: randomUUID(),
    });

    const raw = [
      (await hosted.database.doc(`leads/${accepted.leadId}`).get()).data(),
      (await hosted.database.doc(`runs/${accepted.runId}`).get()).data(),
      ...(
        await hosted.database.collection(`runs/${accepted.runId}/events`).get()
      ).docs.map((document) => document.data()),
    ];
    for (const document of raw) {
      if (
        !isRetentionTimestamp(document?.expiresAt) ||
        document.expiresAt.toMillis() !== fixedNow + 7 * DAY_MS
      ) {
        throw new Error(
          'A hosted write lacked its timestamp-typed seven-day expiry.',
        );
      }
    }

    // Strict repository reads see exactly the domain record.
    const repositories = createFirestoreRepositories(hosted.database);
    const lead = await repositories.leads.get(accepted.leadId);
    const run = await repositories.runs.get(accepted.runId);
    if (
      lead === null ||
      run === null ||
      'expiresAt' in lead ||
      'expiresAt' in run
    ) {
      throw new Error('A strict read did not remove only the retention stamp.');
    }

    // A text expiry is not normalized away: TTL would ignore it, so the
    // strict schema must reject the stored document.
    await hosted.database
      .doc(`runs/${accepted.runId}`)
      .update({ expiresAt: '2026-11-02T12:00:00.000Z' });
    let textExpiryRejected = false;
    try {
      await repositories.runs.get(accepted.runId);
    } catch {
      textExpiryRejected = true;
    }
    if (!textExpiryRejected) {
      throw new Error('A text-typed expiry was accepted on read.');
    }

    // Without an owner credential the deny-all client rules apply.
    for (const [method, url, body] of [
      ['GET', `${EMULATOR_DOCUMENTS}/leads/${accepted.leadId}`, undefined],
      [
        'PATCH',
        `${EMULATOR_DOCUMENTS}/leads/${accepted.leadId}`,
        JSON.stringify({ fields: { givenName: { stringValue: 'Changed' } } }),
      ],
    ]) {
      const response = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body }),
      });
      if (response.status !== 403) {
        throw new Error(
          `Client ${method} was not denied by the rules (${response.status}).`,
        );
      }
    }
    const unchanged = await repositories.leads.get(accepted.leadId);
    if (unchanged?.intake.givenName !== 'Riley') {
      throw new Error('A denied client write changed stored state.');
    }

    // The hosted purge refuses the emulator project before any delete.
    let purgeRefused = false;
    try {
      await purgeHostedData(
        {
          target: {
            projectId: 'demo-leadflow-ai-local',
            databaseId: '(default)',
          },
          listCollections: () => hosted.database.listCollections(),
          recursiveDelete: (reference) =>
            hosted.database.recursiveDelete(reference),
        },
        {
          configured: {
            projectId: 'demo-leadflow-ai-local',
            databaseId: '(default)',
          },
          requested: {
            projectId: 'demo-leadflow-ai-local',
            databaseId: '(default)',
          },
          confirmation: HOSTED_PURGE_CONFIRMATION,
          operator: {
            requiredAccount: 'owner@example.com',
            authenticatedAccount: 'owner@example.com',
          },
        },
      );
    } catch (error) {
      purgeRefused = error instanceof HostedPurgeDeniedError;
    }
    if (
      !purgeRefused ||
      (await repositories.leads.get(accepted.leadId)) === null
    ) {
      throw new Error('The hosted purge guard did not refuse the emulator.');
    }
  } finally {
    await hosted.close();
  }
}
