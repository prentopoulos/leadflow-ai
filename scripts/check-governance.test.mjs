import { describe, expect, it } from 'vitest';
import { extractConstitution } from './check-constitution.mjs';
import { inspectTrackedFiles } from './check-hygiene.mjs';

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
