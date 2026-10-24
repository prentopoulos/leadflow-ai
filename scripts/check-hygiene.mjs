import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { repoRoot } from './process-utils.mjs';

const forbiddenPaths = [
  /(^|\/)\.env(?:\.|$)/u,
  /(^|\/)(?:\.tools|node_modules)(?:\/|$)/u,
  /\.(?:key|p12|pfx|pem)$/iu,
];
const allowedEnv = new Set(['.env.example']);
const assignmentPattern =
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?([A-Za-z0-9+/_=-]{20,})/giu;

export function inspectTrackedFiles(files, contents) {
  const findings = [];
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    if (
      !allowedEnv.has(normalized) &&
      forbiddenPaths.some((pattern) => pattern.test(normalized))
    ) {
      findings.push(`${normalized}: forbidden tracked path`);
    }
    const content = contents.get(file);
    if (!content || content.includes('\0')) continue;
    for (const match of content.matchAll(assignmentPattern)) {
      findings.push(
        `${normalized}: possible embedded credential assignment (${match[1].slice(0, 4)}…)`,
      );
    }
  }
  return findings;
}

export async function checkHygiene() {
  const listed = spawnSync(
    'git',
    [
      '-c',
      `safe.directory=${repoRoot.replaceAll('\\', '/')}`,
      'ls-files',
      '-z',
    ],
    { cwd: repoRoot, encoding: 'utf8', windowsHide: true },
  );
  if (listed.status !== 0) {
    throw new Error(`Unable to inspect tracked files: ${listed.stderr}`);
  }
  const files = listed.stdout.split('\0').filter(Boolean);
  const contents = new Map();
  for (const file of files) {
    try {
      const content = await readFile(path.join(repoRoot, file), 'utf8');
      contents.set(file, content);
    } catch {
      // Binary or concurrently removed files are covered by path checks, not text scanning.
    }
  }
  const findings = inspectTrackedFiles(files, contents);
  const ignore = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');
  for (const required of [
    '.env',
    '.env.*',
    '!.env.example',
    '.tools/',
    'node_modules/',
  ]) {
    if (!ignore.split(/\r?\n/u).includes(required)) {
      findings.push(`.gitignore: missing ${required}`);
    }
  }
  if (findings.length > 0) {
    throw new Error(`Tracked-file hygiene failed:\n${findings.join('\n')}`);
  }
  console.log(`Tracked-file hygiene passed for ${files.length} files.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await checkHygiene();
}
