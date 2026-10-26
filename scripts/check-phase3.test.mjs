import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dockerignoreFrom,
  inspectDockerfile,
  inspectIntakeDefaults,
} from './check-container.mjs';
import { inspectPrivateValues } from './check-hygiene.mjs';
import { inspectDeployTemplates } from './check-container.mjs';
import { renderService } from '../deploy/render-service.mjs';
import { ttlCommands } from '../deploy/firestore-ttl.mjs';
import { repoRoot } from './process-utils.mjs';
import { treeSourceDigest } from './source-digest.mjs';

const read = (file) => readFile(path.join(repoRoot, file), 'utf8');

describe('container contract', () => {
  it('accepts the checked-in Dockerfile and ignore file', async () => {
    expect(
      inspectDockerfile(
        await read('Dockerfile'),
        await read('docs/dependencies/phase-3.md'),
      ),
    ).toEqual([]);
    expect(await read('.dockerignore')).toBe(
      dockerignoreFrom(await read('.gitignore')),
    );
  });

  it.each([
    ['a mutable base tag', (text) => text.replace(/@sha256:[a-f0-9]{64}/u, '')],
    [
      'an unrecorded digest',
      (text) => text.replace(/[a-f0-9]{64}/u, 'f'.repeat(64)),
    ],
    ['a root runtime user', (text) => text.replace('USER node\n', '')],
    ['an ADD instruction', (text) => `${text}ADD https://example.com/x /x\n`],
    [
      'a credential build value',
      (text) => text.replace('ARG SOURCE_COMMIT', 'ARG API_TOKEN'),
    ],
    [
      'a mutable install',
      (text) =>
        text.replace('pnpm install --frozen-lockfile\n', 'pnpm install\n'),
    ],
    [
      'copying the whole build stage',
      (text) => `${text}COPY --from=build /app ./\n`,
    ],
  ])('fails for %s', async (_label, mutate) => {
    const findings = inspectDockerfile(
      mutate(await read('Dockerfile')),
      await read('docs/dependencies/phase-3.md'),
    );
    expect(findings.length).toBeGreaterThan(0);
  });

  it('anchors unanchored ignore patterns at every depth', () => {
    expect(
      dockerignoreFrom('# c\nnode_modules/\n!.env.example\nsrc/gen/\n'),
    ).toContain('**/node_modules\n!**/.env.example\nsrc/gen\n');
  });

  it('requires recorded intake defaults', async () => {
    const app = await read('apps/web/src/App.tsx');
    const fixtures = JSON.parse(
      await read('packages/runtime/fixtures/recorded-enrichment.json'),
    );
    expect(inspectIntakeDefaults(app, fixtures)).toEqual([]);
    const unrecorded = app.replace(
      /(id="vehicleYear"[\s\S]{0,240}?defaultValue=")\d{4}/u,
      '$12021',
    );
    expect(inspectIntakeDefaults(unrecorded, fixtures)).toEqual([
      'apps/web/src/App.tsx: default vehicle has no recorded response',
    ]);
  });
});

describe('private deployment values', () => {
  it('allows only the synthetic placeholders', () => {
    const synthetic = [
      'accounts.google.com:100000000000000000001',
      '/projects/123456789012/locations/northamerica-northeast2/services/leadflow-ai-demo',
      'leadflow-ai-runtime@PROJECT_ID.iam.gserviceaccount.com',
    ].join('\n');
    expect(
      inspectPrivateValues(['docs/a.md'], new Map([['docs/a.md', synthetic]])),
    ).toEqual([]);
  });

  // Canaries are assembled at run time so this file itself never holds a
  // contiguous private-looking value for the tracked-file scan to find.
  const join = (...parts) => parts.join('');
  it.each([
    ['subject', join('accounts.google.com:', '118274650938274650123')],
    ['audience', join('/projects/', '987654321098', '/locations/x/services/y')],
    ['service URL', join('https://leadflow-ai-demo-abc123-pd.a.', 'run.app/')],
    ['billing ID', join('01AB23-', '45CD67-', '89EF01')],
    ['token', `eyJ${'a'.repeat(20)}.eyJ${'b'.repeat(20)}.sig`],
    [
      'service account',
      join('leadflow-ai-runtime@my-real-project', '.iam.gserviceaccount.com'),
    ],
  ])('names the file without printing a %s', (_label, value) => {
    const findings = inspectPrivateValues(
      ['docs/evidence.md'],
      new Map([['docs/evidence.md', `value: ${value}`]]),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/^docs\/evidence\.md: possible private /u);
    expect(findings[0]).not.toContain(value);
  });

  it('matches exact values from the ignored private list', () => {
    const findings = inspectPrivateValues(
      ['README.md'],
      new Map([['README.md', 'deployed to owner-chosen-project-x']]),
      ['owner-chosen-project-x'],
    );
    expect(findings).toEqual([
      'README.md: contains a listed private deployment value',
    ]);
  });
});

describe('build-context source digest', () => {
  it('hashes sorted relative paths then bytes, ignoring Git metadata', async () => {
    const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
    const os = await import('node:os');
    const { createHash } = await import('node:crypto');
    const root = await mkdtemp(path.join(os.tmpdir(), 'leadflow-digest-'));
    try {
      await mkdir(path.join(root, 'b'));
      await mkdir(path.join(root, '.git'));
      await writeFile(path.join(root, 'b', 'z.txt'), 'two');
      await writeFile(path.join(root, 'a.txt'), 'one');
      await writeFile(path.join(root, '.git', 'HEAD'), 'ignored');
      const expected = createHash('sha256')
        .update('a.txt')
        .update('one')
        .update('b/z.txt')
        .update('two')
        .digest('hex');
      expect(await treeSourceDigest(root)).toEqual({
        digest: expected,
        files: 2,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('deploy templates', () => {
  const environment = {
    LEADFLOW_PROJECT_ID: 'synthetic-hosted-project',
    LEADFLOW_PROJECT_NUMBER: '123456789012',
    LEADFLOW_IMAGE_DIGEST: `sha256:${'a'.repeat(64)}`,
    LEADFLOW_COMMIT_SHA: 'c'.repeat(40),
    LEADFLOW_ALLOWED_SUBJECTS: 'accounts.google.com:100000000000000000001',
  };

  it('keeps the accepted limits and only placeholders in tracked templates', async () => {
    expect(
      inspectDeployTemplates(
        await read('deploy/service.template.yaml'),
        await read('deploy/cloudbuild.yaml'),
      ),
    ).toEqual([]);
  });

  it('renders a digest-pinned, IAP-only revision', async () => {
    const template = await read('deploy/service.template.yaml');
    const first = renderService(template, environment);
    expect(first.revision).toBe(`leadflow-ai-demo-${'c'.repeat(12)}`);
    expect(first.rendered).toContain(`app@sha256:${'a'.repeat(64)}`);
    expect(first.rendered).toContain(
      '/projects/123456789012/locations/northamerica-northeast2/services/leadflow-ai-demo',
    );
    expect(first.rendered).not.toMatch(/\$\{/u);
    const candidate = renderService(template, {
      ...environment,
      LEADFLOW_PREVIOUS_REVISION: 'leadflow-ai-demo-000000000001',
    });
    expect(candidate.rendered).toContain('percent: 0, tag: candidate');
  });

  it.each([
    ['a mutable tag', { LEADFLOW_IMAGE_DIGEST: 'latest' }],
    ['an email allowlist', { LEADFLOW_ALLOWED_SUBJECTS: 'owner@example.com' }],
    ['a demo project', { LEADFLOW_PROJECT_ID: 'demo-leadflow-ai-local' }],
    ['a short commit', { LEADFLOW_COMMIT_SHA: 'abc1234' }],
    ['a malformed previous revision', { LEADFLOW_PREVIOUS_REVISION: 'other' }],
  ])('refuses %s', async (_label, change) => {
    const template = await read('deploy/service.template.yaml');
    expect(() =>
      renderService(template, { ...environment, ...change }),
    ).toThrow();
  });

  it('prints one TTL policy and one index exemption per collection group', () => {
    const commands = ttlCommands(['leads', 'events']);
    expect(commands).toHaveLength(4);
    expect(commands[0]).toContain(
      'ttls update expiresAt --collection-group=leads',
    );
    expect(commands[1]).toContain('--disable-indexes');
  });
});
