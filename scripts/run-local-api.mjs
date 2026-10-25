// Starts the built API against an already running local Firestore Emulator for
// interactive operator use. It records the current code-bound system bundle
// (create-only, reused when unchanged) so intake is accepted, then runs the
// API in the foreground. Requires `pnpm build` and `pnpm emulator:start`.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createSystemBundle } from '../packages/evals/dist/bundle.js';
import {
  createEmulatorFirestoreBoundary,
  createFirestoreRepositories,
} from '../packages/runtime/dist/index.js';
import { repoRoot } from './process-utils.mjs';

const environment = {
  ...process.env,
  GCLOUD_PROJECT: 'demo-leadflow-ai-local',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
};

const bundle = await createSystemBundle();
const boundary = createEmulatorFirestoreBoundary(environment);
try {
  const repositories = createFirestoreRepositories(boundary.database);
  if ((await repositories.systemBundles.get(bundle.systemBundleId)) === null) {
    await repositories.systemBundles.create(bundle);
  }
} catch (error) {
  console.error(
    'Could not record the system bundle. Is `pnpm emulator:start` running?',
  );
  throw error;
} finally {
  await boundary.close();
}

console.log(
  `System bundle ${bundle.systemBundleId} recorded; starting the API on 127.0.0.1:3001.`,
);
const server = spawn(
  process.execPath,
  [path.join(repoRoot, 'apps/api/dist/server.js')],
  {
    cwd: repoRoot,
    env: { ...environment, LEADFLOW_SYSTEM_BUNDLE_ID: bundle.systemBundleId },
    stdio: 'inherit',
  },
);
server.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
