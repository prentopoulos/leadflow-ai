// Builds the exact tracked commit in an isolated archive, then inspects the
// final runtime image metadata and exported /app filesystem. No cloud access,
// credentials or private values are required.
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './process-utils.mjs';

const execute = promisify(execFile);
const work = path.join(repoRoot, '.local', 'container-inspection');
const archive = path.join(work, 'source.tar');
const context = path.join(work, 'context');
const exported = path.join(work, 'runtime.tar');
const filesystem = path.join(work, 'filesystem');

async function run(command, args, options = {}) {
  return execute(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

async function filesBelow(directory) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function metadataFindings(image) {
  const findings = [];
  const config = image.Config ?? {};
  if (config.User !== 'node') findings.push('runtime user is not node');
  if (
    JSON.stringify(config.Cmd) !==
    JSON.stringify(['node', 'apps/api/dist/server.js'])
  ) {
    findings.push('runtime command differs from the reviewed server command');
  }
  const environment = config.Env ?? [];
  if (!environment.includes('NODE_ENV=production')) {
    findings.push('NODE_ENV is not production');
  }
  if (!environment.includes('LEADFLOW_RUNTIME_MODE=cloud')) {
    findings.push('runtime mode is not cloud');
  }
  if (
    environment.some((value) =>
      /(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|FIRESTORE_EMULATOR_HOST)=/iu.test(
        value,
      ),
    )
  ) {
    findings.push(
      'image metadata contains a credential-like environment value',
    );
  }
  return findings;
}

async function contentFindings(appDirectory, privateValues) {
  const findings = [];
  const files = await filesBelow(appDirectory);
  for (const file of files) {
    const relative = path.relative(appDirectory, file).replaceAll('\\', '/');
    if (
      /(?:^|\/)(?:\.git|\.env(?:\.|$)|docs|deploy|scripts)(?:\/|$)|(?:\.test|\.test-support)\.[^.]+$/u.test(
        relative,
      )
    ) {
      findings.push(`${relative}: forbidden runtime artifact`);
      continue;
    }
    const buffer = await readFile(file);
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    if (
      /demo-leadflow-ai-local|127\.0\.0\.1:8080|FIRESTORE_EMULATOR_HOST|[A-Za-z]:\\Users\\|\/(?:Users|home)\/[A-Za-z0-9._-]+/u.test(
        text,
      )
    ) {
      findings.push(`${relative}: local or emulator value`);
    }
    if (
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp|github_pat|xox[baprs])-[-A-Za-z0-9_]{20,}|\bAIza[0-9A-Za-z_-]{30,}/u.test(
        text,
      )
    ) {
      findings.push(`${relative}: credential-like content`);
    }
    for (const value of privateValues) {
      if (text.includes(value)) {
        findings.push(`${relative}: configured private value`);
      }
    }
  }
  return findings;
}

export async function inspectCandidateImage() {
  const { stdout: commitOutput } = await run('git', ['rev-parse', 'HEAD']);
  const commit = commitOutput.trim();
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error('HEAD is not a commit.');
  const { stdout: status } = await run('git', [
    'status',
    '--porcelain',
    '--untracked-files=no',
  ]);
  if (status.trim() !== '') {
    throw new Error(
      'Tracked worktree changes must be committed before image inspection.',
    );
  }

  await rm(work, { recursive: true, force: true });
  await mkdir(context, { recursive: true });
  await run('git', ['archive', '--format=tar', `--output=${archive}`, commit]);
  await run('tar', ['-xf', archive, '-C', context]);
  const tag = `leadflow-ai-candidate:${commit.slice(0, 12)}`;
  await run(
    'docker',
    ['build', '--build-arg', `SOURCE_COMMIT=${commit}`, '--tag', tag, '.'],
    { cwd: context, maxBuffer: 64 * 1024 * 1024 },
  );
  const { stdout: inspectOutput } = await run('docker', [
    'image',
    'inspect',
    tag,
  ]);
  const [image] = JSON.parse(inspectOutput);
  const findings = metadataFindings(image);
  const { stdout: containerOutput } = await run('docker', ['create', tag]);
  const container = containerOutput.trim();
  if (!/^[a-f0-9]{12,64}$/u.test(container)) {
    throw new Error('Docker did not return a container ID.');
  }
  try {
    await run('docker', ['export', '--output', exported, container], {
      maxBuffer: 64 * 1024 * 1024,
    });
  } finally {
    await run('docker', ['rm', container]);
  }
  await mkdir(filesystem, { recursive: true });
  await run('tar', ['-xf', exported, '-C', filesystem]);
  const appDirectory = path.join(filesystem, 'app');
  await access(appDirectory, constants.R_OK);
  let privateValues = [];
  try {
    privateValues = (
      await readFile(
        path.join(repoRoot, '.local', 'private-values.txt'),
        'utf8',
      )
    )
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value.length >= 4);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  findings.push(...(await contentFindings(appDirectory, privateValues)));
  if (findings.length > 0) {
    throw new Error(
      `Candidate image inspection failed:\n${findings.join('\n')}`,
    );
  }
  console.log(
    `Candidate image ${tag} passed metadata and filesystem inspection.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await inspectCandidateImage();
}
