import { describe, expect, it } from 'vitest';
import {
  HealthResponseSchema,
  MarketingReadinessScoreSchema,
  createHealthResponse,
  exportHealthJsonSchema,
} from './index.js';

describe('domain contracts', () => {
  it('creates a narrow process-health response', () => {
    expect(HealthResponseSchema.parse(createHealthResponse())).toEqual({
      status: 'ok',
      service: 'leadflow-api',
      scope: 'process',
      evidence: 'local-process',
    });
  });

  it('exports Draft 2020-12 JSON Schema', () => {
    expect(exportHealthJsonSchema()).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
    });
  });

  it('enforces criterion bounds and total equality', () => {
    expect(
      MarketingReadinessScoreSchema.safeParse({
        classification: 'marketing_readiness',
        criteria: {
          needTimeline: { points: 40, evidence: ['timeline supplied'] },
          requestClarity: { points: 30, evidence: ['request supplied'] },
          completeness: {
            points: 30,
            evidence: ['required demo fields supplied'],
          },
        },
        total: 99,
      }).success,
    ).toBe(false);
  });

  it('rejects unsupported positive criterion points', () => {
    expect(
      MarketingReadinessScoreSchema.safeParse({
        classification: 'marketing_readiness',
        criteria: {
          needTimeline: { points: 40, evidence: [] },
          requestClarity: { points: 0, evidence: [] },
          completeness: { points: 0, evidence: [] },
        },
        total: 40,
      }).success,
    ).toBe(false);
  });
});
