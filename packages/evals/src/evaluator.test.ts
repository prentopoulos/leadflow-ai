import { describe, expect, it } from 'vitest';
import { evaluateAll, evaluateCase } from './evaluator.js';
import {
  COMBINED_CASES,
  PHASE_ONE_CASES,
  PHASE_ZERO_CASES,
} from './fixtures.js';
import {
  DATASET_VERSION,
  EVALUATOR_VERSION,
  EvalCaseSchema,
  EvalReportSchema,
} from './schemas.js';

describe('combined Phase 0 and Phase 1 evaluation', () => {
  it('has valid unique versioned synthetic cases', () => {
    const ids = PHASE_ZERO_CASES.map(
      (evaluationCase) => EvalCaseSchema.parse(evaluationCase).id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(20);
  });

  it('adds fixed Phase 1 coverage without dropping a Phase 0 case', () => {
    const combinedIds = new Set(COMBINED_CASES.map((item) => item.id));
    expect(PHASE_ZERO_CASES.every((item) => combinedIds.has(item.id))).toBe(
      true,
    );
    expect(PHASE_ONE_CASES).toHaveLength(14);
    expect(COMBINED_CASES).toHaveLength(
      PHASE_ZERO_CASES.length + PHASE_ONE_CASES.length,
    );
  });

  it('passes every runnable deterministic contract and keeps future work not_run', () => {
    const results = evaluateAll(COMBINED_CASES);
    expect(results.filter((result) => result.status === 'fail')).toEqual([]);
    expect(results.some((result) => result.status === 'not_run')).toBe(true);
    expect(
      results.every((result) => result.evidenceClass === 'synthetic-local'),
    ).toBe(true);
    expect(results.every((result) => result.status !== 'stale')).toBe(true);
    expect(
      results.every(
        (result) =>
          result.datasetVersion === DATASET_VERSION &&
          result.evaluatorVersion === EVALUATOR_VERSION,
      ),
    ).toBe(true);
    expect(new Set(results.map((result) => result.evidenceScope))).toEqual(
      new Set([
        'pure-synthetic',
        'local-emulator',
        'rendered-local',
        'not-run',
      ]),
    );
  });

  it('never reports declared emulator or rendered observations as measured passes', () => {
    const results = evaluateAll(COMBINED_CASES);
    const declared = results.filter(
      (result) =>
        result.evidenceScope === 'local-emulator' ||
        result.evidenceScope === 'rendered-local',
    );
    expect(declared.length).toBeGreaterThan(0);
    for (const result of declared) {
      expect(result.status).toBe('not_run');
      expect(result.assertions.length).toBeGreaterThan(0);
      expect(result.reason).toMatch(/measured by/u);
    }
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

  it('marks bundle-bound evidence stale when a behavior input changes', () => {
    const baseline = PHASE_ONE_CASES.find(
      (item) => item.id === 'p1-bundle-freshness-detection',
    );
    if (!baseline) throw new Error('Freshness fixture missing.');
    const mutated = structuredClone(baseline);
    (mutated.candidate as { currentDigest: string }).currentDigest = 'b'.repeat(
      64,
    );
    expect(evaluateCase(mutated)).toMatchObject({
      status: 'stale',
      reason: expect.stringContaining('must be rerun'),
    });
  });

  it('fails a mutated Phase 1 recovery contract instead of preserving a favorable result', () => {
    const baseline = PHASE_ONE_CASES.find(
      (item) => item.id === 'p1-recovery-races-retries-and-unavailable-state',
    );
    if (!baseline) throw new Error('Recovery canary baseline missing.');
    const mutated = structuredClone(baseline);
    (
      mutated.candidate as {
        transientRetry: { thirdAttempt: boolean };
      }
    ).transientRetry.thirdAttempt = true;
    expect(evaluateCase(mutated)).toMatchObject({
      status: 'fail',
      reason: expect.stringContaining('no third attempt'),
    });
  });

  it('requires absent provider and model fields to remain explicit nulls with reasons', () => {
    const digest = 'a'.repeat(64);
    const parsed = EvalReportSchema.safeParse({
      label: 'synthetic-local',
      generatedAt: new Date().toISOString(),
      bundle: {
        schemaVersion: 'system-bundle-v2',
        systemBundleId: '11111111-1111-4111-8111-111111111111',
        createdAt: '2026-10-24T20:00:00.000Z',
        code: {
          revision: 'test',
          dirty: true,
          sourceDigest: digest,
          patchDigest: digest,
        },
        lockfileDigest: digest,
        fixtures: { version: DATASET_VERSION, digest },
        versions: {
          intake: 'intake-v2',
          lead: 'lead-v2',
          run: 'run-v2',
          event: 'event-v2',
          checkpoint: 'checkpoint-v1',
          rubric: 'rubric-v1',
          interpreter: 'deterministic-interpreter-v1',
          graph: 'phase-2-graph-v1',
          checkpointer: 'firestore-checkpointer-v1',
          simulator: 'simulator-v1',
          enrichmentAdapters: 'enrichment-adapters-v1',
          composer: 'deterministic-template-v1',
          verificationRules: 'verification-rules-v1',
          decisionLanguage: 'decision-language-v1',
          metricsDefinitions: 'metrics-definitions-v1',
          evaluator: EVALUATOR_VERSION,
          configuration: 'phase-2-local-v1',
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
        enrichmentMode: 'recorded',
        liveToolContracts: {
          hosts: ['vpic.nhtsa.dot.gov', 'api.zippopotam.us'],
          authorization:
            'owner-authorized read-only GET, 2026-10-25 (PROJECT.md Phase 2 decisions)',
        },
      },
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        notRun: 0,
        stale: 0,
        byScope: {
          'pure-synthetic': 0,
          'local-emulator': 0,
          'rendered-local': 0,
          'not-run': 0,
        },
      },
      results: [],
    });
    expect(parsed.success).toBe(true);
  });
});
