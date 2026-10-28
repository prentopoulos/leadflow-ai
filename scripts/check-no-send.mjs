// Enforces the MVP's no-send boundary (PROJECT.md section 5): approval means
// "approved for manual use" and nothing may deliver a message. It fails when a
// manifest or the lockfile gains an email/SMS delivery package, when product
// source gains a send route or mail transport, or when product source names an
// outbound host beyond the two owner-authorized enrichment sources.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from './process-utils.mjs';

const deniedPackages = [
  /^nodemailer(?:-|$)/u,
  /^@sendgrid\//u,
  /^mailgun(?:\.js)?$/u,
  /^postmark$/u,
  /^@aws-sdk\/client-sesv?2?$/u,
  /^@aws-sdk\/client-sns$/u,
  /^resend$/u,
  /^twilio$/u,
  /^@mailchimp\//u,
  /^@?emailjs(?:\/|$)/u,
  /^smtp-(?:server|connection|client)$/u,
  /^sendmail$/u,
  /^@vonage\//u,
  /^plivo$/u,
];

const sendPatterns = [
  { pattern: /\bnodemailer\b/iu, finding: 'mail transport library' },
  { pattern: /\bcreateTransport\s*\(/u, finding: 'mail transport' },
  { pattern: /\bsendMail\s*\(/u, finding: 'mail send call' },
  { pattern: /\bsmtps?:\/\//iu, finding: 'SMTP endpoint' },
  {
    pattern: /\.(?:post|put|patch|route)\(\s*['"`][^'"`]*\/send\b/iu,
    finding: 'send route',
  },
];

// Hosts product source may name. Only the two enrichment hosts are ever
// requested; the others are loopback or the dated provenance record.
const allowedHosts = new Set([
  'vpic.nhtsa.dot.gov',
  'api.zippopotam.us',
  '127.0.0.1',
  'localhost',
  'auto.military.com',
  // Interpolated loopback constant: the pinned 127.0.0.1:8080 emulator host.
  '${LEADFLOW_FIRESTORE_EMULATOR_HOST}',
  // IAP's JWT issuer (`https://cloud.google.com/iap`): compared with the
  // assertion's `iss` claim, never requested.
  'cloud.google.com',
  // Phase 5 opt-in agent team, owner-authorized 2026-10-27 (PROJECT.md):
  // the Anthropic SDK's default endpoint, local only.
  'api.anthropic.com',
  // Dossier link to NHTSA's public vehicle page (recalls and safety ratings),
  // owner-authorized 2026-10-27: opened by a person, never requested.
  'www.nhtsa.gov',
]);

// RFC 2606 reserves `.example`; such hosts never resolve, so fixtures may
// use them for illustrative citation URLs.
const reservedExampleHost = (host) => /\.example$/u.test(host);

function packageNamesFromLockfile(lockfile) {
  const names = new Set();
  for (const match of lockfile.matchAll(
    /^ {2}['"]?((?:@[^/\s'"]+\/)?[^@\s'":]+)@[^:\s]+['"]?:\s*$/gmu,
  )) {
    names.add(match[1]);
  }
  return names;
}

export function inspectOutboundSurface({ manifests, lockfile, sources }) {
  const findings = [];
  const names = new Set(packageNamesFromLockfile(lockfile));
  for (const [file, manifest] of manifests) {
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      for (const name of Object.keys(manifest[field] ?? {})) {
        names.add(name);
        if (deniedPackages.some((pattern) => pattern.test(name))) {
          findings.push(`${file}: message-delivery package ${name}`);
        }
      }
    }
  }
  for (const name of names) {
    if (deniedPackages.some((pattern) => pattern.test(name))) {
      findings.push(`pnpm-lock.yaml: message-delivery package ${name}`);
    }
  }
  for (const [file, content] of sources) {
    for (const { pattern, finding } of sendPatterns) {
      if (pattern.test(content)) findings.push(`${file}: ${finding}`);
    }
    for (const match of content.matchAll(
      /\b(?:https?|wss?):\/\/([^/\s'"`)?:]+)/gu,
    )) {
      if (!allowedHosts.has(match[1]) && !reservedExampleHost(match[1])) {
        findings.push(`${file}: outbound host ${match[1]} is not authorized`);
      }
    }
  }
  return [...new Set(findings)];
}

const productSource = (file) =>
  /^(?:apps|packages)\/[^/]+\/src\/.+\.(?:ts|tsx|mjs|js)$/u.test(file) &&
  !/\.test\.(?:ts|tsx|mjs|js)$/u.test(file);

export async function checkNoSend() {
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
    throw new Error(`Unable to list files: ${listed.stderr}`);
  }
  const files = listed.stdout.split('\0').filter(Boolean);
  const manifests = new Map();
  const sources = new Map();
  for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    if (/(^|\/)package\.json$/u.test(normalized)) {
      manifests.set(
        normalized,
        JSON.parse(await readFile(path.join(repoRoot, file), 'utf8')),
      );
    } else if (productSource(normalized)) {
      sources.set(
        normalized,
        await readFile(path.join(repoRoot, file), 'utf8'),
      );
    }
  }
  const lockfile = await readFile(
    path.join(repoRoot, 'pnpm-lock.yaml'),
    'utf8',
  );
  const findings = inspectOutboundSurface({ manifests, lockfile, sources });
  if (findings.length > 0) {
    throw new Error(`No-send boundary failed:\n${findings.join('\n')}`);
  }
  console.log(
    `No-send boundary passed for ${manifests.size} manifests, the lockfile and ${sources.size} product sources.`,
  );
}
