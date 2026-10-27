import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEPLOYED_CHECK_IDS,
  DeploymentEvidenceIndexSchema,
  PHASE_FOUR_DEPLOYED_CHECK_IDS,
  deploymentCandidateFingerprint,
  deploymentReady,
} from './evidence.js';

const indexPath = path.resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
  'docs/evidence/phase-3/index.json',
);

describe('phase 4 deployment evidence index', () => {
  it('lists every Phase 4 check as not run, with cost pending, until the authorized probe', async () => {
    const index = DeploymentEvidenceIndexSchema.parse(
      JSON.parse(
        await readFile(indexPath.replace('phase-3', 'phase-4'), 'utf8'),
      ),
    );
    expect(index.phase).toBe('phase-4');
    expect(index.checks.map((check) => check.id)).toEqual([
      ...PHASE_FOUR_DEPLOYED_CHECK_IDS,
    ]);
    expect(index.checks.every((check) => check.outcome === 'not_run')).toBe(
      true,
    );
    expect(deploymentReady(index)).toBe(false);
  });
});

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

  it('binds deployed passes to the complete current candidate', async () => {
    const raw = JSON.parse(await readFile(indexPath, 'utf8'));
    const candidate = {
      ...raw.candidate,
      sourceCommit: 'a'.repeat(40),
      lockfileDigest: 'b'.repeat(64),
      systemBundleId: '11111111-1111-4111-8111-111111111111',
      buildId: '22222222-2222-4222-8222-222222222222',
      imageDigest: `sha256:${'c'.repeat(64)}`,
      revision: 'leadflow-ai-demo-aaaaaaaaaaaa',
    };
    const fingerprint = deploymentCandidateFingerprint(candidate);
    const ready = DeploymentEvidenceIndexSchema.parse({
      ...raw,
      candidate,
      checks: raw.checks.map((check: Record<string, unknown>) => ({
        ...check,
        outcome: 'pass',
        recordedAt: '2026-10-26T12:00:00.000Z',
        observed: 'Sanitized deployed observation.',
        reason: null,
        pending: false,
        candidateFingerprint: fingerprint,
      })),
    });
    expect(deploymentReady(ready)).toBe(true);
    expect(
      DeploymentEvidenceIndexSchema.safeParse({
        ...ready,
        candidate: { ...ready.candidate, sourceCommit: 'd'.repeat(40) },
      }).success,
    ).toBe(false);
  });

  it('rejects local-scoped deployed IDs and incomplete identities', async () => {
    const raw = JSON.parse(await readFile(indexPath, 'utf8'));
    const checks = raw.checks.map((check: Record<string, unknown>) => ({
      ...check,
      scope: 'local',
      outcome: 'pass',
      recordedAt: '2026-10-26T12:00:00.000Z',
      observed: 'Local-only observation.',
      reason: null,
      pending: false,
      candidateFingerprint: 'e'.repeat(64),
    }));
    expect(
      DeploymentEvidenceIndexSchema.safeParse({ ...raw, checks }).success,
    ).toBe(false);
  });
});
