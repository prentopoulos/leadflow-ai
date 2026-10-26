import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLOUD_CONFIGURATION_VERSION,
  LOCAL_CONFIGURATION_VERSION,
  type EnrichmentMode,
} from '@leadflow-ai/domain';
import {
  LOCAL_DEPLOYMENT,
  bindSystemBundle,
  type SystemBundleBase,
} from '@leadflow-ai/runtime';
import { COMBINED_CASES } from './fixtures.js';
import {
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

export interface SourceIdentity {
  revision: string;
  dirty: boolean;
  sourceDigest: string;
  patchDigest: string | null;
}

export interface SystemBundleOptions {
  // The bundle identifies which enrichment evidence class its runs produce.
  enrichmentMode?: EnrichmentMode;
  // A hosted release build supplies its verified commit and tree digest; a
  // local bundle reads them from Git.
  source?: SourceIdentity;
  runtime?: 'local' | 'cloud';
}

async function gitSourceIdentity(): Promise<SourceIdentity> {
  const revision = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain']);
  const dirty = status.status !== 0 || status.stdout.trim().length > 0;
  return {
    revision: revision.status === 0 ? revision.stdout.trim() : 'unavailable',
    dirty,
    sourceDigest: await sourceDigest(),
    patchDigest: dirty ? await dirtyPatchDigest() : null,
  };
}

// Everything except the run-time deployment binding; a release build writes
// this into its image manifest.
export async function createSystemBundleBase(
  options: SystemBundleOptions = {},
): Promise<SystemBundleBase> {
  const enrichmentMode = options.enrichmentMode ?? 'recorded';
  const source = options.source ?? (await gitSourceIdentity());
  const lockfileDigest = sha256(
    await readFile(path.join(repoRoot, 'pnpm-lock.yaml')),
  );
  const pnpmVersion =
    /pnpm\/([^\s]+)/u.exec(process.env.npm_config_user_agent ?? '')?.[1] ??
    'unavailable';
  const toolchain = JSON.parse(
    await readFile(path.join(repoRoot, 'toolchain.phase1.json'), 'utf8'),
  );
  const fixtureDigest = sha256(JSON.stringify(COMBINED_CASES));

  return {
    schemaVersion: 'system-bundle-v3',
    code: {
      revision: source.revision,
      dirty: source.dirty,
      sourceDigest: source.sourceDigest,
      patchDigest: source.patchDigest,
    },
    lockfileDigest,
    fixtures: {
      version: DATASET_VERSION,
      digest: fixtureDigest,
    },
    versions: {
      intake: 'intake-v2',
      lead: 'lead-v2',
      run: 'run-v2',
      event: 'event-v2',
      checkpoint: 'checkpoint-v1',
      rubric: 'rubric-v1',
      interpreter: 'deterministic-interpreter-v1',
      graph: 'phase-2-graph-v1',
      checkpointer: 'firestore-checkpointer-v1',
      simulator: 'simulator-v1',
      enrichmentAdapters: 'enrichment-adapters-v1',
      composer: 'deterministic-template-v1',
      verificationRules: 'verification-rules-v1',
      decisionLanguage: 'decision-language-v1',
      metricsDefinitions: 'metrics-definitions-v1',
      evaluator: EVALUATOR_VERSION,
      configuration:
        options.runtime === 'cloud'
          ? CLOUD_CONFIGURATION_VERSION
          : LOCAL_CONFIGURATION_VERSION,
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
    },
    provider: { value: null, reason: 'provider gate unresolved' },
    model: { value: null, reason: 'model gate unresolved' },
    prompt: { value: null, reason: 'no model prompt; drafts use a template' },
    enrichmentMode,
    liveToolContracts: {
      hosts: ['vpic.nhtsa.dot.gov', 'api.zippopotam.us'],
      authorization:
        'owner-authorized read-only GET, 2026-10-25 (PROJECT.md Phase 2 decisions)',
    },
  };
}

export async function createSystemBundle(
  options: SystemBundleOptions = {},
): Promise<SystemBundle> {
  return bindSystemBundle(
    await createSystemBundleBase(options),
    LOCAL_DEPLOYMENT,
  );
}
