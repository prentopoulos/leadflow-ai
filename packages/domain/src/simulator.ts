import {
  CONTRACT_VERSIONS,
  SimulationRecordSchema,
  type SimulationRecord,
} from './phase1.js';

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function xorshift32(seed: number): number {
  let value = seed || 0x6d2b79f5;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function simulationSeed(runId: string): number {
  return fnv1a32(`${runId}:${CONTRACT_VERSIONS.simulator}:seed-v1`);
}

export function simulateOutcome(input: {
  runId: string;
  generatedAt: string;
}): SimulationRecord {
  const seed = simulationSeed(input.runId);
  const roll = xorshift32(seed) % 8;
  const contacted = roll >= 2;
  const responded = contacted && roll >= 4;
  const appointment = responded && roll >= 6;
  return SimulationRecordSchema.parse({
    schemaVersion: 'simulation-record-v1',
    simulatorVersion: CONTRACT_VERSIONS.simulator,
    seedVersion: 'seed-v1',
    simulationRecordId: `${input.runId}:${CONTRACT_VERSIONS.simulator}`,
    runId: input.runId,
    generatedAt: input.generatedAt,
    seed,
    fixtureClass: 'synthetic',
    outcome: { contacted, responded, appointment },
    evidenceClass: 'synthetic',
    notices: ['not_live', 'not_predictive'],
  });
}

export interface SyntheticMetric {
  name: 'simulated_response_rate';
  value: number | null;
  numerator: number;
  denominator: number;
  exclusions: number;
  window: 'all_supplied_records';
  minimumCount: 1;
  evidenceClass: 'synthetic';
  reason: 'insufficient_data' | null;
}

export function simulatedResponseRate(
  records: readonly SimulationRecord[],
  exclusions = 0,
): SyntheticMetric {
  const denominator = records.filter(
    (record) => record.outcome.contacted,
  ).length;
  const numerator = records.filter((record) => record.outcome.responded).length;
  return {
    name: 'simulated_response_rate',
    value: denominator === 0 ? null : numerator / denominator,
    numerator,
    denominator,
    exclusions,
    window: 'all_supplied_records',
    minimumCount: 1,
    evidenceClass: 'synthetic',
    reason: denominator === 0 ? 'insufficient_data' : null,
  };
}
