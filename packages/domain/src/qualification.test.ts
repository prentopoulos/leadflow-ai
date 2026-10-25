import { describe, expect, it } from 'vitest';
import { priorityForTotal, scoreQualification } from './qualification.js';

const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  result: '33333333-3333-4333-8333-333333333333',
};
const context = {
  resultId: ids.result,
  runId: ids.run,
  leadId: ids.lead,
  generatedAt: '2026-10-24T20:00:00.000Z',
};

function interpretation(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'qualification-interpretation-v1',
    interpreterVersion: 'deterministic-interpreter-v1',
    leadId: ids.lead,
    interpretedAt: '2026-10-24T19:59:00.000Z',
    needTimeline: 'within_30_days',
    requestIntent: 'compare_options',
    coverageFocus: 'balanced',
    hasRequestDetails: true,
    completeFields: [
      'givenName',
      'familyName',
      'email',
      'zipCode',
      'vehicleYear',
      'vehicleMake',
      'vehicleModel',
      'coverageFocus',
      'requestIntent',
      'needTimeline',
      'requestDetails',
    ],
    missingFields: [],
    evidenceSource: 'normalized_intake',
    ...overrides,
  };
}

describe('rubric-v1', () => {
  it.each([
    ['within_30_days', 40],
    ['days_31_to_90', 30],
    ['over_90_days', 20],
    ['researching', 10],
    ['not_sure', 0],
  ] as const)('scores timeline %s as %i', (needTimeline, points) => {
    const result = scoreQualification(
      interpretation({ needTimeline }),
      context,
    );
    expect(result.criteria?.needTimeline.points).toBe(points);
  });

  it('scores exact clarity and completeness components to 100', () => {
    const result = scoreQualification(interpretation(), context);
    expect(result.criteria).toMatchObject({
      needTimeline: { points: 40, maximum: 40 },
      requestClarity: { points: 30, maximum: 30 },
      completeness: { points: 30, maximum: 30 },
    });
    expect(result.total).toBe(100);
    expect(result.priority).toBe('high');
    expect(result.integrityHold).toBeNull();
  });

  it('awards no unsupported clarity or optional completeness points', () => {
    const completeFields = [
      'givenName',
      'familyName',
      'email',
      'zipCode',
      'needTimeline',
    ];
    const missingFields = [
      'vehicleYear',
      'vehicleMake',
      'vehicleModel',
      'coverageFocus',
      'requestIntent',
      'requestDetails',
    ];
    const result = scoreQualification(
      interpretation({
        needTimeline: 'not_sure',
        requestIntent: null,
        coverageFocus: null,
        hasRequestDetails: false,
        completeFields,
        missingFields,
      }),
      context,
    );
    expect(result.criteria?.requestClarity.points).toBe(0);
    expect(result.criteria?.completeness.points).toBe(14);
    expect(result.total).toBe(14);
    expect(result.priority).toBe('nurture');
    expect(result.missingInformation).toEqual([...missingFields].sort());
  });

  it.each([
    [49, 'nurture'],
    [50, 'standard'],
    [79, 'standard'],
    [80, 'high'],
  ] as const)('maps total %i to %s', (total, priority) => {
    expect(priorityForTotal(total)).toBe(priority);
  });

  it('rejects totals outside the versioned range', () => {
    expect(() => priorityForTotal(-1)).toThrow(/0 to 100/u);
    expect(() => priorityForTotal(101)).toThrow(/0 to 100/u);
    expect(() => priorityForTotal(Number.NaN)).toThrow(/0 to 100/u);
  });

  it('places malformed, contradictory, and mismatched evidence on hold', () => {
    for (const candidate of [
      { malformed: true },
      interpretation({
        needTimeline: 'within_30_days',
        completeFields: [],
      }),
      interpretation({ leadId: '44444444-4444-4444-8444-444444444444' }),
    ]) {
      const result = scoreQualification(candidate, context);
      expect(result).toMatchObject({
        criteria: null,
        total: null,
        priority: null,
        integrityHold: { code: 'invalid_qualification_evidence' },
      });
    }
  });

  it('has no consent input or outbound authority', () => {
    const before = scoreQualification(interpretation(), context);
    const after = scoreQualification(
      { ...interpretation(), emailContactConsent: true },
      context,
    );
    expect(before.total).toBe(100);
    expect(after.priority).toBeNull();
    expect(after.integrityHold).not.toBeNull();
  });
});
