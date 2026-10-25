import { describe, expect, it } from 'vitest';
import {
  simulateOutcome,
  simulatedResponseRate,
  simulationSeed,
} from './simulator.js';

const runId = '22222222-2222-4222-8222-222222222222';
const generatedAt = '2026-10-24T20:00:00.000Z';

describe('simulator-v1', () => {
  it('repeats the same versioned seed and normalized outcome', () => {
    const first = simulateOutcome({ runId, generatedAt });
    const second = simulateOutcome({ runId, generatedAt });
    expect(first).toEqual(second);
    expect(first.seed).toBe(simulationSeed(runId));
    expect(first).toMatchObject({
      evidenceClass: 'synthetic',
      notices: ['not_live', 'not_predictive'],
    });
  });

  it('does not accept score or priority as an input', () => {
    expect(simulateOutcome).toHaveLength(1);
    const baseline = simulateOutcome({ runId, generatedAt });
    const withIgnoredQualification = simulateOutcome({
      runId,
      generatedAt,
      score: 100,
      priority: 'high',
    } as { runId: string; generatedAt: string });
    expect(withIgnoredQualification.outcome).toEqual(baseline.outcome);
  });

  it('reports empty denominators as unknown and names exclusions', () => {
    expect(simulatedResponseRate([])).toEqual({
      name: 'simulated_response_rate',
      value: null,
      numerator: 0,
      denominator: 0,
      exclusions: 0,
      window: 'all_supplied_records',
      minimumCount: 1,
      evidenceClass: 'synthetic',
      reason: 'insufficient_data',
    });

    const record = simulateOutcome({ runId, generatedAt });
    const metric = simulatedResponseRate([record], 2);
    expect(metric.exclusions).toBe(2);
    expect(metric.value === null || Number.isFinite(metric.value)).toBe(true);
  });
});
