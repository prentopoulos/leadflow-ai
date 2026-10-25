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

  it('requires absent provider and model fields to remain explicit nulls with reasons', () => {
    const digest = 'a'.repeat(64);
    const parsed = EvalReportSchema.safeParse({
      label: 'synthetic-local',
      generatedAt: new Date().toISOString(),
      bundle: {
        schemaVersion: 'system-bundle-v1',
        systemBundleId: '11111111-1111-4111-8111-111111111111',
        createdAt: '2026-10-24T20:00:00.000Z',
        code: {
          revision: 'test',
          dirty: true,
          sourceDigest: digest,
          patchDigest: digest,
        },
        lockfileDigest: digest,
        fixtures: { version: 'phase-0.1', digest },
        versions: {
          intake: 'intake-v1',
          lead: 'lead-v1',
          run: 'run-v1',
          event: 'event-v1',
          checkpoint: 'checkpoint-v1',
          rubric: 'rubric-v1',
          interpreter: 'deterministic-interpreter-v1',
          graph: 'qualification-graph-v1',
          checkpointer: 'firestore-checkpointer-v1',
          simulator: 'simulator-v1',
          evaluator: 'phase-0.1',
          configuration: 'phase-1-local-v1',
        },
        environment: {
          node: '24.22.1',
          pnpm: '12.15.0',
          java: '21.0.12.1',
          firebaseCli: '15.34.1',
          firestoreEmulator: '1.22.0',
          structurizrCli: '2025.11.09',
          platform: 'test',
          architecture: 'test',
          projectId: 'demo-leadflow-ai-local',
        },
        model: { value: null, reason: 'gate unresolved' },
        provider: { value: null, reason: 'gate unresolved' },
        prompt: { value: null, reason: 'not used' },
        liveToolContracts: { value: null, reason: 'deferred' },
      },
      summary: { total: 0, passed: 0, failed: 0, notRun: 0 },
      results: [],
    });
    expect(parsed.success).toBe(true);
  });
});
