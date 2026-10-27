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

// Phase 3 private deployment values. Generic shapes are refused everywhere;
// only the synthetic placeholders the tests and templates use are allowed.
const privateShapes = [
  {
    label: 'IAP stable subject',
    pattern: /accounts\.google\.com:(\d{6,32})/gu,
    allowed: (match) => /^10{17,}\d{1,2}$/u.test(match[1] ?? ''),
  },
  {
    label: 'IAP audience or project number',
    pattern: /\/projects\/(\d{6,20})\//gu,
    allowed: (match) => match[1] === '123456789012',
  },
  {
    label: 'Cloud Run service URL',
    pattern: /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app\b/gu,
    allowed: () => false,
  },
  {
    label: 'billing account ID',
    pattern: /\b[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}\b/gu,
    allowed: () => false,
  },
  {
    label: 'signed token',
    pattern: /\beyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}/gu,
    allowed: () => false,
  },
  {
    label: 'OAuth access token',
    pattern: /\bya29\.[A-Za-z0-9_-]{20,}/gu,
    allowed: () => false,
  },
  {
    label: 'IAP session cookie',
    pattern: /GCP_IAP_(?:UID|AUTH_TOKEN)[A-Za-z0-9_]*=[^\s;'"]{8,}/gu,
    allowed: () => false,
  },
  {
    label: 'service-account email',
    pattern:
      /\b[a-z][a-z0-9-]{4,28}@([a-z][a-z0-9-]{4,28}[a-z0-9])\.iam\.gserviceaccount\.com\b/gu,
    allowed: (match) =>
      match[1] === 'PROJECT_ID' || match[1] === 'synthetic-hosted-project',
  },
];

// Exact private values (project ID/number, owner email, subject, audience,
// service URL, billing ID) live one per line in an ignored file the owner
// keeps; tracked content is checked against them without printing any.
export function inspectPrivateValues(files, contents, privateValues = []) {
  const findings = [];
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    if (normalized === 'pnpm-lock.yaml') continue;
    const content = contents.get(file);
    if (!content || content.includes('\0')) continue;
    for (const shape of privateShapes) {
      for (const match of content.matchAll(shape.pattern)) {
        if (!shape.allowed(match)) {
          findings.push(`${normalized}: possible private ${shape.label}`);
          break;
        }
      }
    }
    if (privateValues.some((value) => content.includes(value))) {
      findings.push(
        `${normalized}: contains a listed private deployment value`,
      );
    }
  }
  return findings;
}

async function loadPrivateValues() {
  try {
    const text = await readFile(
      path.join(repoRoot, '.local', 'private-values.txt'),
      'utf8',
    );
    return text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length >= 6 && !line.startsWith('#'));
  } catch {
    return [];
  }
}

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
    if ([...content.matchAll(assignmentPattern)].length > 0) {
      findings.push(`${normalized}: possible embedded credential assignment`);
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
      '--cached',
      '--others',
      '--exclude-standard',
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
  const privateValues = await loadPrivateValues();
  const findings = [
    ...inspectTrackedFiles(files, contents),
    ...inspectPrivateValues(files, contents, privateValues),
  ];
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
  console.log(
    `Tracked-file hygiene passed for ${files.length} files (${privateValues.length} listed private values checked).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await checkHygiene();
}
