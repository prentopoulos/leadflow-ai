// Builds the exact tracked commit in an isolated archive, then inspects the
// final runtime image metadata and exported /app filesystem. No cloud access,
// credentials or private values are required.
import { execFile } from 'node:child_process';
import { closeSync, openSync, readSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './process-utils.mjs';

const execute = promisify(execFile);
const work = path.join(repoRoot, '.local', 'container-inspection');
const archive = path.join(work, 'source.tar');
const context = path.join(work, 'context');
const exported = path.join(work, 'runtime.tar');

async function run(command, args, options = {}) {
  return execute(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

// Reads regular files from an exported image tar without extracting it:
// Windows cannot create the image's symlinks (zoneinfo, pnpm links), and a
// streamed read keeps memory flat. Supports ustar prefixes and PAX/GNU long
// names; symlinks and other entry types are skipped.
export function* tarFiles(tarPath, accept) {
  const handle = openSync(tarPath, 'r');
  const header = Buffer.alloc(512);
  const field = (start, length) => {
    const raw = header.subarray(start, start + length);
    const end = raw.indexOf(0);
    return raw.toString('utf8', 0, end < 0 ? length : end);
  };
  let offset = 0;
  let longName = null;
  try {
    while (readSync(handle, header, 0, 512, offset) === 512) {
      if (header.every((byte) => byte === 0)) break;
      const size = Number.parseInt(field(124, 12).trim() || '0', 8);
      const type = String.fromCharCode(header[156] || 48);
      const prefix = field(345, 155);
      const name =
        longName ??
        (prefix === '' ? field(0, 100) : `${prefix}/${field(0, 100)}`);
      const dataOffset = offset + 512;
      offset = dataOffset + Math.ceil(size / 512) * 512;
      const read = () => {
        const data = Buffer.alloc(size);
        readSync(handle, data, 0, size, dataOffset);
        return data;
      };
      if (type === 'x' || type === 'L') {
        const data = read();
        const end = data.indexOf(0);
        const text = data.toString('utf8', 0, end < 0 ? data.length : end);
        longName =
          type === 'L'
            ? text
            : (/(?:^|\n)\d+ path=([^\n]*)\n/u.exec(text)?.[1] ?? null);
        continue;
      }
      longName = null;
      if ((type === '0' || type === '7') && accept(name)) {
        yield { name, read };
      }
    }
  } finally {
    closeSync(handle);
  }
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

export function contentFindings(tarPath, privateValues) {
  const findings = [];
  let count = 0;
  for (const file of tarFiles(tarPath, (name) => name.startsWith('app/'))) {
    count += 1;
    const relative = file.name.slice('app/'.length);
    if (
      /(?:^|\/)(?:\.git|\.env(?:\.|$)|docs|deploy|scripts)(?:\/|$)|(?:\.test|\.test-support)\.[^.]+$/u.test(
        relative,
      )
    ) {
      findings.push(`${relative}: forbidden runtime artifact`);
      continue;
    }
    const buffer = file.read();
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
  if (count === 0) findings.push('runtime image has no /app files');
  return findings;
}

// The checkout may be owned by another local account (the Codex sandbox);
// trust it for these read-only calls without changing global Git config.
const git = (args) =>
  run('git', [
    '-c',
    `safe.directory=${repoRoot.replaceAll('\\', '/')}`,
    ...args,
  ]);

export async function inspectCandidateImage() {
  const { stdout: commitOutput } = await git(['rev-parse', 'HEAD']);
  const commit = commitOutput.trim();
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error('HEAD is not a commit.');
  const { stdout: status } = await git([
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
  await git(['archive', '--format=tar', `--output=${archive}`, commit]);
  // Relative paths: GNU tar reads a drive-letter path as a remote host.
  await run('tar', ['-xf', 'source.tar', '-C', 'context'], { cwd: work });
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
  findings.push(...contentFindings(exported, privateValues));
  if (findings.length > 0) {
    throw new Error(
      `Candidate image inspection failed:\n${findings.join('\n')}`,
    );
  }
  console.log(
    `Candidate image ${tag} (${image.Id}) passed metadata and filesystem inspection.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await inspectCandidateImage();
}
