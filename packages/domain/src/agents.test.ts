import { describe, expect, it } from 'vitest';
import {
  AgentBriefRecordSchema,
  callCostMicros,
  checkClaim,
  checkParagraph,
  keepClaims,
  numbersIn,
  type AgentClaim,
  type CandidateClaim,
} from './agents.js';

const claim = (overrides: Partial<CandidateClaim> = {}): CandidateClaim => ({
  topic: 'vehicle',
  text: 'The 2022 Camry has a five-star overall safety rating from NHTSA.',
  url: 'https://www.nhtsa.gov/vehicle/2022/TOYOTA/CAMRY',
  title: 'NHTSA ratings',
  quote:
    '2022 Toyota Camry overall safety rating: five-star (NHTSA New Car Assessment Program).',
  ...overrides,
});

describe('claim verifier', () => {
  it('keeps a claim whose numbers and words its quote supports', () => {
    expect(checkClaim(claim())).toBeNull();
  });

  it('rejects unsupported numbers, missing quotes and non-https sources', () => {
    expect(
      checkClaim(claim({ text: 'The 2023 Camry has a five-star rating.' })),
    ).toBe('number_unsupported');
    expect(checkClaim(claim({ quote: '  ' }))).toBe('quote_missing');
    expect(checkClaim(claim({ url: 'http://example.org/a' }))).toBe(
      'url_not_https',
    );
    expect(checkClaim(claim({ url: 'not a url' }))).toBe('url_not_https');
    expect(
      checkClaim(
        claim({ text: 'Owners praise comfortable seating and quiet cabins.' }),
      ),
    ).toBe('words_unsupported');
  });

  it('normalizes thousands separators when comparing numbers', () => {
    expect(numbersIn('about 2,500 miles and 3.5 years')).toEqual([
      '2500',
      '3.5',
    ]);
    expect(
      checkClaim(
        claim({
          text: 'Springfield has about 31,000 residents.',
          quote: 'Springfield population 31000 residents (2020 census)',
        }),
      ),
    ).toBeNull();
  });

  it('numbers kept claims, caps four per topic and drops duplicates', () => {
    const candidates = [
      claim(),
      claim(),
      claim({ text: 'The 2023 Camry is new.' }),
      ...Array.from({ length: 5 }, (_, index) =>
        claim({
          topic: 'area',
          text: `Springfield sits near route ${index + 1} highway.`,
          quote: `Springfield sits near route ${index + 1} highway`,
        }),
      ),
    ];
    const { claims, rejected } = keepClaims(candidates);
    expect(claims.map((kept) => kept.claimId)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
    ]);
    expect(claims.filter((kept) => kept.topic === 'area')).toHaveLength(4);
    expect(rejected).toBe(3);
  });
});

describe('paragraph rule checker', () => {
  const claims: AgentClaim[] = [{ ...claim(), claimId: 'c1' }];
  const good =
    'Your Camry earned a five-star overall safety rating from NHTSA. That record can be a useful starting point when you compare coverage options.';

  it('passes a cited, plain paragraph', () => {
    expect(checkParagraph(good, ['c1'], claims).failures).toEqual([]);
  });

  it('allows the vehicle model year the lead supplied', () => {
    const text =
      'Your 2022 Camry earned a five-star overall safety rating. We can walk through coverage choices for it.';
    expect(checkParagraph(text, ['c1'], claims, ['2022']).failures).toEqual([]);
  });

  it('names each failure', () => {
    expect(
      checkParagraph(
        'We can get you a better rate. Visit https://x.test for 30 days.',
        ['c9'],
        claims,
      ).failures,
    ).toEqual([
      'unknown_claim',
      'number_unsupported',
      'forbidden_characters',
      'decision_language',
    ]);
    expect(checkParagraph('One sentence only.', [], claims).failures).toEqual([
      'sentence_count',
      'no_citation',
    ]);
    expect(checkParagraph(` ${good}`, ['c1'], claims).failures).toEqual([
      'length',
    ]);
  });
});

describe('cost arithmetic', () => {
  it('prices tokens and searches in micro-dollars', () => {
    expect(
      callCostMicros('claude-sonnet-5-5', {
        inputTokens: 1_000,
        outputTokens: 500,
        webSearchRequests: 0,
      }),
    ).toBe(7_000);
    expect(
      callCostMicros('claude-haiku-5-5', {
        inputTokens: 20_000,
        outputTokens: 1_000,
        webSearchRequests: 3,
      }),
    ).toBe(2_000 + 500 + 30_000);
    expect(
      callCostMicros('claude-haiku-5-5', {
        inputTokens: 200_000,
        outputTokens: 0,
        webSearchRequests: 0,
      }),
    ).toBe(100_000);
  });
});

describe('agent brief record', () => {
  it('requires a drafted brief to carry a paragraph and matching total', () => {
    const base = {
      schemaVersion: 'agent-brief-v1',
      briefId: '88888888-8888-4888-8888-888888888888',
      runId: '22222222-2222-4222-8222-222222222222',
      leadId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-10-27T20:00:00.000Z',
      teamVersion: 'agent-team-v1',
      rulesVersion: 'agent-rules-v1',
      promptsSha256: 'a'.repeat(64),
      projectionSha256: 'b'.repeat(64),
      status: 'fallback',
      fallbackReason: 'no_research_subject',
      questions: { vehicle: [], area: [], coverage: [] },
      candidateClaims: 0,
      rejectedClaims: 0,
      claims: [],
      points: [],
      paragraph: null,
      paragraphClaimIds: [],
      attempts: 0,
      criticNotes: [],
      calls: [],
      totalCostMicros: 0,
    };
    expect(AgentBriefRecordSchema.safeParse(base).success).toBe(true);
    expect(
      AgentBriefRecordSchema.safeParse({ ...base, status: 'drafted' }).success,
    ).toBe(false);
    expect(
      AgentBriefRecordSchema.safeParse({ ...base, totalCostMicros: 5 }).success,
    ).toBe(false);
  });
});
