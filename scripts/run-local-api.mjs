// Starts the built API against an already running local Firestore Emulator for
// interactive operator use. It records the current code-bound system bundle
// (create-only, reused when unchanged) so intake is accepted, then runs the
// API in the foreground. Requires `pnpm build` and `pnpm emulator:start`.
// Enrichment is live (owner-authorized reads) unless `--enrichment=recorded`
// or `--enrichment=mock` is passed; the mode is part of the system bundle, so
// each mode has its own labelled dashboard window. `--agents=claude` turns on
// the Phase 5 agent team: it reads ANTHROPIC_API_KEY from the gitignored
// `.env` (never printed) and records a bundle naming the provider and models.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createSystemBundle } from '../packages/evals/dist/bundle.js';
import {
  createEmulatorFirestoreBoundary,
  createFirestoreRepositories,
} from '../packages/runtime/dist/index.js';
import { repoRoot } from './process-utils.mjs';

const modeArgument = process.argv
  .find((argument) => argument.startsWith('--enrichment='))
  ?.slice('--enrichment='.length);
const enrichmentMode = modeArgument ?? 'live';
if (!['live', 'recorded', 'mock'].includes(enrichmentMode)) {
  throw new Error('--enrichment must be live, recorded or mock.');
}

const agentsArgument = process.argv
  .find((argument) => argument.startsWith('--agents='))
  ?.slice('--agents='.length);
const agents = agentsArgument === 'claude';
if (agentsArgument !== undefined && !agents) {
  throw new Error('--agents must be claude.');
}
if (agents) {
  try {
    process.loadEnvFile(path.join(repoRoot, '.env'));
  } catch {
    // Fall through to the check below; the key may already be exported.
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('--agents=claude needs ANTHROPIC_API_KEY in .env.');
  }
}

const environment = {
  ...process.env,
  GCLOUD_PROJECT: 'demo-leadflow-ai-local',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  LEADFLOW_ENRICHMENT_MODE: enrichmentMode,
  ...(agents ? { LEADFLOW_AGENTS: 'claude' } : {}),
  // Override when another local app already holds Vite's default port.
  LEADFLOW_WEB_ORIGIN:
    process.env.LEADFLOW_WEB_ORIGIN ?? 'http://127.0.0.1:5173',
};

const bundle = await createSystemBundle({ enrichmentMode, agents });
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
  `System bundle ${bundle.systemBundleId} recorded; starting the API on 127.0.0.1:3001 with ${enrichmentMode} enrichment${agents ? ' and the Claude agent team (caps: $0.30 per lead, $8 per process)' : ''}.`,
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
