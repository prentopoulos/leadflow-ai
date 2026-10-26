// Offline Phase 3 container and configuration contract. It reads tracked
// files and the local web build only; no image is built and nothing is
// contacted. The real build and its inspection are separately run probes.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './process-utils.mjs';

const BASE_IMAGE =
  /^ARG NODE_IMAGE=node:24\.22\.1-slim@sha256:([a-f0-9]{64})$/mu;

// .gitignore patterns become root-anchored Docker patterns: an unanchored
// gitignore entry matches at any depth, which Docker spells with `**/`.
export function dockerignoreFrom(gitignore) {
  const lines = [
    '# Mirrors .gitignore with root-anchored Docker patterns, plus Git metadata, so',
    '# the build context is exactly the tracked tree. scripts/check-container.mjs',
    '# keeps the two files in step.',
    '.git',
  ];
  for (const raw of gitignore.split(/\r?\n/u)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      lines.push(line);
      continue;
    }
    const negated = line.startsWith('!');
    const pattern = (negated ? line.slice(1) : line).replace(/\/$/u, '');
    const anchored = pattern.includes('/');
    lines.push(
      `${negated ? '!' : ''}${anchored ? pattern.replace(/^\//u, '') : `**/${pattern}`}`,
    );
  }
  return `${lines.join('\n').replace(/\n+$/u, '')}\n`;
}

export function inspectDockerfile(dockerfile, dependencyRecord) {
  const findings = [];
  const base = BASE_IMAGE.exec(dockerfile);
  if (base === null) {
    findings.push(
      'Dockerfile: base image is not the digest-pinned Node 24.22.1 slim image',
    );
  } else if (!dependencyRecord.includes(base[1] ?? '')) {
    findings.push(
      'Dockerfile: base image digest is not recorded in docs/dependencies/phase-3.md',
    );
  }
  const fromLines = dockerfile.match(/^FROM .+$/gmu) ?? [];
  if (fromLines.some((line) => !line.startsWith('FROM ${NODE_IMAGE} AS '))) {
    findings.push('Dockerfile: every stage must use the pinned base image');
  }
  if (/^ADD /mu.test(dockerfile)) {
    findings.push('Dockerfile: ADD is not allowed; use COPY');
  }
  if (
    /^(?:ENV|ARG) .*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/imu.test(
      dockerfile,
    )
  ) {
    findings.push('Dockerfile: a credential-like build value is declared');
  }
  for (const [label, pattern] of [
    ['frozen lockfile install', /pnpm install --frozen-lockfile\n/u],
    [
      'production-only dependency stage',
      /pnpm install --frozen-lockfile --prod --filter @leadflow-ai\/api\.\.\./u,
    ],
    [
      'hosted runtime mode',
      /^ENV NODE_ENV=production LEADFLOW_RUNTIME_MODE=cloud$/mu,
    ],
    [
      'source digest before install',
      /source-digest\.mjs[^\n]*\n(?:.*\n)*?RUN pnpm install/u,
    ],
    ['release manifest', /write-release-manifest\.mjs/u],
  ]) {
    if (!pattern.test(dockerfile))
      findings.push(`Dockerfile: missing ${label}`);
  }
  const runtimeStage = dockerfile.slice(dockerfile.lastIndexOf('FROM '));
  const user = runtimeStage.indexOf('\nUSER node\n');
  const command = runtimeStage.indexOf(
    '\nCMD ["node", "apps/api/dist/server.js"]',
  );
  if (user < 0 || command < 0 || user > command) {
    findings.push(
      'Dockerfile: the runtime stage must run the API as the non-root node user',
    );
  }
  if (
    /COPY --from=build \/app(?:\/)? /u.test(runtimeStage) ||
    /COPY \. /u.test(runtimeStage)
  ) {
    findings.push('Dockerfile: the runtime stage must copy only built outputs');
  }
  return findings;
}

// Hosted mode is recorded-only, so the intake form's defaults must name a
// vehicle and ZIP that the recorded fixtures actually hold.
export function inspectIntakeDefaults(appSource, recordedFixtures) {
  const findings = [];
  const value = (field) =>
    new RegExp(`id="${field}"[\\s\\S]{0,240}?defaultValue="([^"]+)"`, 'u').exec(
      appSource,
    )?.[1];
  const year = value('vehicleYear');
  const make = value('vehicleMake');
  const zip = value('zip') ?? value('zipCode') ?? value('postalCode');
  const urls = recordedFixtures.entries.map((entry) => entry.url);
  if (year === undefined || make === undefined || zip === undefined) {
    findings.push('apps/web/src/App.tsx: intake defaults could not be read');
    return findings;
  }
  const vehicle = urls.find(
    (url) =>
      url.includes(`/make/${encodeURIComponent(make)}/modelyear/${year}?`) &&
      recordedFixtures.entries.find((entry) => entry.url === url)?.status !==
        404,
  );
  if (vehicle === undefined) {
    findings.push(
      'apps/web/src/App.tsx: default vehicle has no recorded response',
    );
  }
  if (!urls.includes(`https://api.zippopotam.us/us/${zip}`)) {
    findings.push('apps/web/src/App.tsx: default ZIP has no recorded response');
  }
  return findings;
}

async function scriptFiles(directory) {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, {
    withFileTypes: true,
    recursive: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

export async function checkContainer() {
  const read = (file) => readFile(path.join(repoRoot, file), 'utf8');
  const findings = [];
  findings.push(
    ...inspectDockerfile(
      await read('Dockerfile'),
      await read('docs/dependencies/phase-3.md'),
    ),
  );
  if (
    (await read('.dockerignore')) !== dockerignoreFrom(await read('.gitignore'))
  ) {
    findings.push('.dockerignore: does not mirror .gitignore');
  }
  findings.push(
    ...inspectIntakeDefaults(
      await read('apps/web/src/App.tsx'),
      JSON.parse(
        await read('packages/runtime/fixtures/recorded-enrichment.json'),
      ),
    ),
  );
  // Development fixtures are compiled out of the production web build.
  for (const file of await scriptFiles(
    path.join(repoRoot, 'apps', 'web', 'dist'),
  )) {
    const content = await readFile(file, 'utf8');
    if (/createDevelopmentFixture|developmentFixtureNames/u.test(content)) {
      findings.push(
        `${path.relative(repoRoot, file)}: contains development fixtures`,
      );
    }
  }
  if (findings.length > 0) {
    throw new Error(`Container contract failed:\n${findings.join('\n')}`);
  }
  console.log('Container and hosted configuration contract passed.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await checkContainer();
}
