import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEPLOYED_CHECK_IDS,
  DeploymentEvidenceIndexSchema,
  deploymentReady,
} from './evidence.js';

const indexPath = path.resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
  'docs/evidence/phase-3/index.json',
);

describe('deployment evidence index', () => {
  it('lists every required deployed check and holds readiness until they pass', async () => {
    const index = DeploymentEvidenceIndexSchema.parse(
      JSON.parse(await readFile(indexPath, 'utf8')),
    );
    expect(index.checks.map((check) => check.id)).toEqual(
      expect.arrayContaining([...DEPLOYED_CHECK_IDS]),
    );
    expect(deploymentReady(index)).toBe(false);
    const cost = index.checks.find(
      (check) => check.id === 'deployed-cost-status',
    );
    expect(cost?.pending).toBe(true);
  });

  it('refuses a duplicate or missing check', async () => {
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    expect(
      DeploymentEvidenceIndexSchema.safeParse({
        ...index,
        checks: [...index.checks, index.checks[0]],
      }).success,
    ).toBe(false);
    expect(
      DeploymentEvidenceIndexSchema.safeParse({
        ...index,
        checks: index.checks.slice(1),
      }).success,
    ).toBe(false);
  });
});
