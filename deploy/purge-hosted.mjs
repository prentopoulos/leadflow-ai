// Guarded destructive operation for the hosted proof. Run only from Cloud
// Shell after exporting final evidence; see docs/operations/runbook.md.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  HOSTED_PURGE_CONFIRMATION,
  createCloudFirestoreBoundary,
  purgeHostedData,
} from '../packages/runtime/dist/index.js';

const execute = promisify(execFile);
const PROJECT = /^(?!demo-)[a-z][a-z0-9-]{4,28}[a-z0-9]$/u;
const ACCOUNT = /^[^\s@]+@[^\s@]+$/u;

async function gcloud(args) {
  const { stdout } = await execute('gcloud', args, {
    encoding: 'utf8',
    windowsHide: true,
  });
  return stdout.trim();
}

export async function verifyPurgeAuthority({
  projectId,
  requiredAccount,
  runGcloud = gcloud,
  fetcher = fetch,
}) {
  if (!PROJECT.test(projectId) || !ACCOUNT.test(requiredAccount)) {
    throw new Error('Purge target or required owner account is malformed.');
  }
  const activeAccount = await runGcloud([
    'auth',
    'list',
    '--filter=status:ACTIVE',
    '--format=value(account)',
  ]);
  const activeProject = await runGcloud(['config', 'get-value', 'project']);
  if (activeAccount !== requiredAccount || activeProject !== projectId) {
    throw new Error(
      'Active gcloud owner or project does not match the purge target.',
    );
  }

  // Deletion uses ADC, so verify that identity separately from the gcloud CLI
  // account. The token stays in memory and is never printed or written.
  const accessToken = await runGcloud([
    'auth',
    'application-default',
    'print-access-token',
  ]);
  const response = await fetcher(
    'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error('ADC owner identity could not be verified.');
  }
  const identity = await response.json();
  if (identity.email_verified !== true || identity.email !== requiredAccount) {
    throw new Error('ADC identity is not the required owner.');
  }
  return activeAccount;
}

export async function runHostedPurge(environment = process.env) {
  const projectId = environment.LEADFLOW_PROJECT_ID ?? '';
  const requiredAccount = environment.LEADFLOW_OWNER_EMAIL ?? '';
  const confirmation = environment.LEADFLOW_PURGE_CONFIRMATION ?? '';
  if (confirmation !== HOSTED_PURGE_CONFIRMATION) {
    throw new Error('Exact hosted purge confirmation is required.');
  }
  const authenticatedAccount = await verifyPurgeAuthority({
    projectId,
    requiredAccount,
  });
  const boundary = createCloudFirestoreBoundary({
    projectId,
    databaseId: '(default)',
  });
  try {
    return await purgeHostedData(
      {
        target: boundary.configuration,
        listCollections: () => boundary.database.listCollections(),
        recursiveDelete: (reference) =>
          boundary.database.recursiveDelete(reference),
      },
      {
        configured: boundary.configuration,
        requested: { projectId, databaseId: '(default)' },
        confirmation,
        operator: { requiredAccount, authenticatedAccount },
      },
    );
  } finally {
    await boundary.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = await runHostedPurge();
  if (result.unknownCollections.length > 0) {
    throw new Error('Unknown collections blocked the purge.');
  }
  console.log(`Purged ${result.deletedCollections.length} known collections.`);
}
