import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMBINED_CASES } from './fixtures.js';
import {
  CONFIGURATION_VERSION,
  DATASET_VERSION,
  EVALUATOR_VERSION,
  type SystemBundle,
} from './schemas.js';

const repoRoot = path.resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
const safeDirectory = repoRoot.replaceAll('\\', '/');

function git(args: string[]) {
  return spawnSync('git', ['-c', `safe.directory=${safeDirectory}`, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function sha256(content: string | Buffer) {
  return createHash('sha256').update(content).digest('hex');
}

async function sourceDigest() {
  const listed = git([
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  if (listed.status !== 0) return 'unavailable';
  const files = listed.stdout.split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    try {
      hash.update(await readFile(path.join(repoRoot, file)));
    } catch (error) {
      // A tracked file deleted in the working tree is part of the dirty
      // patch; mark it here instead of failing bundle creation.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      hash.update('\0deleted');
    }
  }
  return hash.digest('hex');
}

async function dirtyPatchDigest() {
  const trackedPatch = git(['diff', '--binary', '--no-ext-diff', 'HEAD', '--']);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']);
  if (trackedPatch.status !== 0 || untracked.status !== 0) {
    throw new Error('Unable to identify the dirty source patch.');
  }
  const hash = createHash('sha256');
  hash.update(trackedPatch.stdout);
  for (const file of untracked.stdout.split('\0').filter(Boolean).sort()) {
    hash.update(file);
    hash.update(await readFile(path.join(repoRoot, file)));
  }
  return hash.digest('hex');
}

function uuidFromDigest(digest: string) {
  const characters = digest.slice(0, 32).split('');
  characters[12] = '4';
  characters[16] = (
    (Number.parseInt(characters[16] ?? '0', 16) & 0x3) |
    0x8
  ).toString(16);
  const value = characters.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export async function createSystemBundle(): Promise<SystemBundle> {
  const revision = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain']);
  const lockfileDigest = sha256(
    await readFile(path.join(repoRoot, 'pnpm-lock.yaml')),
  );
  const currentSourceDigest = await sourceDigest();
  const dirty = status.status !== 0 || status.stdout.trim().length > 0;
  const currentPatchDigest = dirty ? await dirtyPatchDigest() : null;
  const pnpmVersion =
    /pnpm\/([^\s]+)/u.exec(process.env.npm_config_user_agent ?? '')?.[1] ??
    'unavailable';
  const toolchain = JSON.parse(
    await readFile(path.join(repoRoot, 'toolchain.phase1.json'), 'utf8'),
  );
  const codeRevision =
    revision.status === 0 ? revision.stdout.trim() : 'unavailable';
  const fixtureDigest = sha256(JSON.stringify(COMBINED_CASES));
  const identityDigest = sha256(
    JSON.stringify({
      codeRevision,
      dirty,
      currentSourceDigest,
      currentPatchDigest,
      lockfileDigest,
      fixtureDigest,
      evaluator: EVALUATOR_VERSION,
    }),
  );

  return {
    schemaVersion: 'system-bundle-v1',
    systemBundleId: uuidFromDigest(identityDigest),
    createdAt: new Date().toISOString(),
    code: {
      revision: codeRevision,
      dirty,
      sourceDigest: currentSourceDigest,
      patchDigest: currentPatchDigest,
    },
    lockfileDigest,
    fixtures: {
      version: DATASET_VERSION,
      digest: fixtureDigest,
    },
    versions: {
      intake: 'intake-v1',
      lead: 'lead-v1',
      run: 'run-v1',
      event: 'event-v1',
      checkpoint: 'checkpoint-v1',
      rubric: 'rubric-v1',
      interpreter: 'deterministic-interpreter-v1',
      graph: 'qualification-graph-v1',
      checkpointer: 'firestore-checkpointer-v1',
      simulator: 'simulator-v1',
      evaluator: EVALUATOR_VERSION,
      configuration: CONFIGURATION_VERSION,
    },
    environment: {
      node: process.version.replace(/^v/u, ''),
      pnpm: pnpmVersion,
      java: toolchain.java.runtimeVersion,
      firebaseCli: toolchain.firebase.cliVersion,
      firestoreEmulator: toolchain.firebase.emulatorVersion,
      structurizrCli: toolchain.structurizr.version,
      platform: process.platform,
      architecture: process.arch,
      projectId: toolchain.firebase.projectId,
    },
    provider: { value: null, reason: 'provider gate unresolved' },
    model: { value: null, reason: 'model gate unresolved' },
    prompt: { value: null, reason: 'no model prompt in Phase 1' },
    liveToolContracts: {
      value: null,
      reason: 'live enrichment and outbound tools are deferred',
    },
  };
}
