import { describe, expect, it } from 'vitest';
import { evaluateAll, evaluateCase } from './evaluator.js';
import { PHASE_ZERO_CASES } from './fixtures.js';
import { EvalCaseSchema, EvalReportSchema } from './schemas.js';

describe('Phase 0 evaluation scaffold', () => {
  it('has valid unique versioned synthetic cases', () => {
    const ids = PHASE_ZERO_CASES.map(
      (evaluationCase) => EvalCaseSchema.parse(evaluationCase).id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(20);
  });

  it('passes every runnable deterministic contract and keeps future work not_run', () => {
    const results = evaluateAll(PHASE_ZERO_CASES);
    expect(results.filter((result) => result.status === 'fail')).toEqual([]);
    expect(results.some((result) => result.status === 'not_run')).toBe(true);
    expect(
      results.every((result) => result.evidenceClass === 'synthetic-local'),
    ).toBe(true);
  });

  it('retains an intentional failing canary', () => {
    const baseline = PHASE_ZERO_CASES.find(
      (item) => item.id === 'p0-score-maximum-valid',
    );
    if (!baseline) throw new Error('Canary baseline missing.');
    const mutated = structuredClone(baseline);
    (mutated.candidate as { total: number }).total = 99;
    expect(evaluateCase(mutated)).toMatchObject({ status: 'fail' });
  });

  it('requires absent provider and model fields to remain explicit nulls', () => {
    const parsed = EvalReportSchema.safeParse({
      label: 'synthetic-local',
      generatedAt: new Date().toISOString(),
      bundle: {
        bundleVersion: 'phase-0.1',
        codeRevision: 'test',
        dirty: true,
        sourceDigest: 'test',
        lockfileDigest: null,
        nodeVersion: 'v24.22.1',
        pnpmVersion: '12.15.0',
        configurationVersion: 'phase-0.1',
        schemaVersion: 'phase-0.1',
        fixtureVersion: 'phase-0.1',
        fixtureDigest: 'test',
        evaluatorVersion: 'phase-0.1',
        model: null,
        provider: null,
        prompt: null,
        toolContract: null,
        environment: { platform: 'test', architecture: 'test' },
      },
      summary: { total: 0, passed: 0, failed: 0, notRun: 0 },
      results: [],
    });
    expect(parsed.success).toBe(true);
  });
});
