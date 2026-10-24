import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { repoRoot, run } from './process-utils.mjs';

const mode = process.argv[2];
const allowedModes = new Set(['start', 'exec', 'retain', 'export']);
if (!allowedModes.has(mode)) {
  throw new Error('Expected emulator mode: start, exec, retain, or export.');
}

const metadata = JSON.parse(
  await readFile(path.join(repoRoot, 'toolchain.phase1.json'), 'utf8'),
);
const firebaseConfigPath = path.join(repoRoot, 'firebase.json');
const firebaseConfig = JSON.parse(await readFile(firebaseConfigPath, 'utf8'));
const firebaseRc = JSON.parse(
  await readFile(path.join(repoRoot, '.firebaserc'), 'utf8'),
);
const expectedProjectId = 'demo-leadflow-ai-local';
const expectedHost = '127.0.0.1';
const expectedPort = 8080;

if (
  metadata.firebase.projectId !== expectedProjectId ||
  metadata.firebase.firestoreHost !== expectedHost ||
  metadata.firebase.firestorePort !== expectedPort ||
  firebaseRc.projects?.default !== expectedProjectId ||
  firebaseConfig.emulators?.firestore?.host !== expectedHost ||
  firebaseConfig.emulators?.firestore?.port !== expectedPort ||
  firebaseConfig.emulators?.ui?.enabled !== false ||
  firebaseConfig.emulators?.singleProjectMode !== true
) {
  throw new Error(
    'Unsafe Firebase configuration: expected the exact synthetic project, loopback Firestore host, fixed port, disabled UI, and single-project mode.',
  );
}

const firebaseCli = path.join(
  repoRoot,
  'node_modules',
  'firebase-tools',
  'lib',
  'bin',
  'firebase.js',
);
if (!existsSync(firebaseCli)) {
  throw new Error(
    'firebase-tools is missing. Run pnpm install --frozen-lockfile.',
  );
}

const emulatorCache = path.join(repoRoot, '.tools', 'firebase', 'emulators');
const emulatorJar = path.join(emulatorCache, metadata.firebase.emulatorFile);
if (!existsSync(emulatorJar)) {
  throw new Error(
    'The pinned Firestore Emulator is missing. Run pnpm tools:bootstrap.',
  );
}

process.env.CI = 'true';
process.env.NO_UPDATE_NOTIFIER = '1';
process.env.XDG_CONFIG_HOME = path.join(
  repoRoot,
  '.tools',
  'firebase',
  'config',
);
process.env.FIREBASE_EMULATORS_PATH = emulatorCache;

const common = ['--config', firebaseConfigPath, '--project', expectedProjectId];
const retainedState = path.join(repoRoot, '.local', 'firestore');
const retainedMetadata = path.join(
  retainedState,
  'firebase-export-metadata.json',
);
let args;

if (mode === 'start') {
  args = ['emulators:start', '--only', 'firestore', ...common];
} else if (mode === 'exec') {
  const probe = path.join(repoRoot, 'scripts', 'verify-firestore-emulator.mjs');
  const command = `"${process.execPath}" "${probe}"`;
  args = ['emulators:exec', '--only', 'firestore', ...common, command];
} else if (mode === 'retain') {
  args = [
    'emulators:start',
    '--only',
    'firestore',
    ...common,
    `--export-on-exit=${retainedState}`,
  ];
  if (existsSync(retainedMetadata)) {
    args.push(`--import=${retainedState}`);
  }
} else {
  args = ['emulators:export', retainedState, '--force', ...common];
}

run(process.execPath, [firebaseCli, ...args], {
  timeout: mode === 'exec' ? 120_000 : 86_400_000,
});
