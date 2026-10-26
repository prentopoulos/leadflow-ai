import { describe, expect, it } from 'vitest';
import { extractConstitution } from './check-constitution.mjs';
import { inspectTrackedFiles } from './check-hygiene.mjs';
import { inspectOutboundSurface } from './check-no-send.mjs';

describe('constitution checker', () => {
  it('normalizes wrapped rule text', () => {
    const value = extractConstitution(`
**Version 1.0.0** · Ratified 2026-10-23 · Last amended 2026-10-23

- First rule wraps
  onto another line.
- Second rule.

### Next section
`);
    expect(value.rules).toEqual([
      '- First rule wraps onto another line.',
      '- Second rule.',
    ]);
  });

  it('rejects missing version text', () => {
    expect(() => extractConstitution('- a rule')).toThrow('version');
  });
});

describe('tracked-file hygiene', () => {
  it('detects forbidden environment files and credential-like assignments', () => {
    const syntheticCanary = 'abcd'.repeat(6);
    const findings = inspectTrackedFiles(
      ['.env', 'src/config.ts'],
      new Map([
        ['.env', ''],
        ['src/config.ts', `api_key = "${syntheticCanary}"`],
      ]),
    );
    expect(findings).toHaveLength(2);
    expect(findings.join('\n')).not.toContain(syntheticCanary.slice(0, 4));
  });

  it('allows the sanitized environment example', () => {
    expect(
      inspectTrackedFiles(
        ['.env.example'],
        new Map([['.env.example', 'HOST=127.0.0.1']]),
      ),
    ).toEqual([]);
  });
});

describe('no-send boundary', () => {
  const clean = {
    manifests: new Map([
      ['apps/api/package.json', { dependencies: { fastify: '5.0.0' } }],
    ]),
    lockfile: 'packages:\n\n  fastify@5.0.0:\n    resolution: {}\n',
    sources: new Map([
      [
        'packages/runtime/src/enrichment.ts',
        "const url = 'https://api.zippopotam.us/us/22150';",
      ],
    ]),
  };

  it('passes the authorized enrichment hosts and ordinary dependencies', () => {
    expect(inspectOutboundSurface(clean)).toEqual([]);
  });

  it('fails on a delivery package in a manifest or the lockfile', () => {
    const findings = inspectOutboundSurface({
      ...clean,
      manifests: new Map([
        ['apps/api/package.json', { dependencies: { nodemailer: '7.0.0' } }],
      ]),
      lockfile: "packages:\n\n  '@sendgrid/mail@8.1.0':\n    resolution: {}\n",
    });
    expect(findings.join('\n')).toContain('nodemailer');
    expect(findings.join('\n')).toContain('@sendgrid/mail');
  });

  it('fails on a send route, mail transport or unauthorized host', () => {
    const findings = inspectOutboundSurface({
      ...clean,
      sources: new Map([
        ['apps/api/src/app.ts', "app.post('/v1/drafts/:id/send', handler);"],
        ['packages/runtime/src/mail.ts', 'transport.sendMail({ to });'],
        [
          'packages/runtime/src/x.ts',
          "fetch('https://api.example-crm.com/leads');",
        ],
      ]),
    });
    expect(findings).toEqual([
      'apps/api/src/app.ts: send route',
      'packages/runtime/src/mail.ts: mail send call',
      'packages/runtime/src/x.ts: outbound host api.example-crm.com is not authorized',
    ]);
  });
});
