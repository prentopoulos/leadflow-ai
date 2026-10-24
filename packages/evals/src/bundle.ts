import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE_ZERO_CASES } from './fixtures.js';
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
    hash.update(await readFile(path.join(repoRoot, file)));
  }
  return hash.digest('hex');
}

export async function createSystemBundle(): Promise<SystemBundle> {
  const revision = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain']);
  let lockfileDigest: string | null = null;
  try {
    lockfileDigest = sha256(
      await readFile(path.join(repoRoot, 'pnpm-lock.yaml')),
    );
  } catch {
    lockfileDigest = null;
  }
  const pnpmVersion =
    /pnpm\/([^\s]+)/u.exec(process.env.npm_config_user_agent ?? '')?.[1] ??
    null;

  return {
    bundleVersion: 'phase-0.1',
    codeRevision:
      revision.status === 0 ? revision.stdout.trim() : 'unavailable',
    dirty: status.status !== 0 || status.stdout.trim().length > 0,
    sourceDigest: await sourceDigest(),
    lockfileDigest,
    nodeVersion: process.version,
    pnpmVersion,
    configurationVersion: CONFIGURATION_VERSION,
    schemaVersion: 'phase-0.1',
    fixtureVersion: DATASET_VERSION,
    fixtureDigest: sha256(JSON.stringify(PHASE_ZERO_CASES)),
    evaluatorVersion: EVALUATOR_VERSION,
    model: null,
    provider: null,
    prompt: null,
    toolContract: null,
    environment: { platform: process.platform, architecture: process.arch },
  };
}
