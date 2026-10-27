import {
  AGENT_LIMITS,
  agentProjectionFrom,
  currentConsentRecord,
  ENRICHMENT_ENDPOINTS,
  VEHICLE_LISTING_STATEMENT,
  type AgentLeadProjection,
  type EnrichmentEvidence,
  type IntakeSubmission,
} from '@leadflow-ai/domain';
import { describe, expect, it } from 'vitest';
import {
  BudgetExceededError,
  ModelCallError,
  runAgentTeam,
  SpendLedger,
  worstCaseMicros,
  type ModelPort,
  type ModelRequest,
  type ModelResponse,
} from './agent-team.js';

const intake: IntakeSubmission = {
  schemaVersion: 'intake-v3',
  attribution: null,
  identityClass: 'fictional',
  givenName: 'Zebulon',
  familyName: 'Quistgaard',
  email: 'zebulon.quistgaard@example.com',
  zipCode: '22150',
  vehicleYear: 2022,
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  coverageFocus: 'stronger_protection',
  requestIntent: 'compare_options',
  needTimeline: 'within_30_days',
  requestDetails: 'My neighbour Petunia Featherstonehaugh recommended you.',
  emailContactConsent: true,
  consentRecord: currentConsentRecord(),
};

const evidence = (
  source: 'nhtsa_vpic' | 'zippopotam_us',
): EnrichmentEvidence => {
  const vehicle = source === 'nhtsa_vpic';
  return {
    schemaVersion: 'enrichment-evidence-v1',
    evidenceId: vehicle
      ? '33333333-3333-4333-8333-333333333333'
      : '44444444-4444-4444-8444-444444444444',
    runId: '22222222-2222-4222-8222-222222222222',
    leadId: '11111111-1111-4111-8111-111111111111',
    source,
    endpointTemplate: ENRICHMENT_ENDPOINTS[source].template,
    subject: vehicle
      ? { kind: 'vehicle', make: 'Toyota', modelYear: 2022, model: 'Camry' }
      : { kind: 'zip', zipCode: '22150' },
    requestedAt: '2026-10-27T20:00:00.000Z',
    retrievedAt: '2026-10-27T20:00:00.000Z',
    httpStatus: 200,
    outcome: 'found',
    failureKind: null,
    notAttemptedReason: null,
    attempts: 1,
    evidenceClass: 'mock',
    recordedCapturedAt: null,
    rawBody: null,
    rawBodyTruncated: false,
    rawBodySha256: null,
    claim: vehicle
      ? {
          kind: 'vehicle_listing',
          listed: true,
          makeName: 'TOYOTA',
          modelName: 'Camry',
          modelYear: 2022,
          statement: VEHICLE_LISTING_STATEMENT,
        }
      : {
          kind: 'zip_places',
          zipCode: '22150',
          places: [
            {
              placeName: 'Springfield',
              state: 'Virginia',
              stateAbbreviation: 'VA',
            },
          ],
        },
    attribution: ENRICHMENT_ENDPOINTS[source].attribution,
    createdAt: '2026-10-27T20:00:00.000Z',
  } as EnrichmentEvidence;
};

const projection = agentProjectionFrom({
  intake,
  evidence: [evidence('nhtsa_vpic'), evidence('zippopotam_us')],
});

const usage = { inputTokens: 1_000, outputTokens: 200, webSearchRequests: 0 };
const json = (value: unknown): ModelResponse => ({
  text: JSON.stringify(value),
  citedBlocks: [],
  usage,
});

const workerClaims: Record<string, ModelResponse> = {
  vehicle: {
    text: '',
    citedBlocks: [
      {
        text: 'The 2022 Camry has a five-star overall safety rating from NHTSA.',
        citations: [
          {
            url: 'https://www.nhtsa.gov/vehicle/2022/TOYOTA/CAMRY',
            title: 'NHTSA',
            citedText:
              '2022 Toyota Camry overall safety rating five-star (NHTSA).',
          },
        ],
      },
      {
        text: 'The 2022 Camry was recalled 9 times.',
        citations: [
          {
            url: 'https://www.nhtsa.gov/recalls',
            title: 'Recalls',
            citedText: 'Recalls for the 2022 Camry: 2 campaigns.',
          },
        ],
      },
    ],
    usage: { inputTokens: 20_000, outputTokens: 400, webSearchRequests: 2 },
  },
  area: {
    text: '',
    citedBlocks: [
      {
        text: 'Springfield, Virginia winters bring occasional snow and ice.',
        citations: [
          {
            url: 'https://www.weather.gov/lwx/winter',
            title: 'NWS',
            citedText:
              'Northern Virginia winters, including Springfield, bring occasional snow and ice.',
          },
        ],
      },
    ],
    usage: { inputTokens: 15_000, outputTokens: 300, webSearchRequests: 1 },
  },
  coverage: {
    text: 'No sources found.',
    citedBlocks: [],
    usage: { inputTokens: 5_000, outputTokens: 100, webSearchRequests: 1 },
  },
};

const goodParagraph =
  'Your 2022 Camry earned a five-star overall safety rating from NHTSA. Springfield winters can bring occasional snow and ice, so it can help to compare coverage options before the season.';

function fakePort(
  overrides: Partial<
    Record<
      ModelRequest['role'],
      (request: ModelRequest, count: number) => ModelResponse
    >
  > = {},
) {
  const requests: ModelRequest[] = [];
  const counts = new Map<string, number>();
  const port: ModelPort = {
    async call(request) {
      requests.push(request);
      const count = (counts.get(request.role) ?? 0) + 1;
      counts.set(request.role, count);
      const override = overrides[request.role];
      if (override !== undefined) return override(request, count);
      switch (request.role) {
        case 'lead_plan':
          return json({
            vehicle: ['What safety ratings does the 2022 Toyota Camry have?'],
            area: ['What winter driving conditions does Springfield, VA see?'],
            coverage: ['What does comprehensive coverage include?'],
          });
        case 'worker':
          return workerClaims[request.topic ?? 'coverage']!;
        case 'lead_merge':
          return json({
            points: [
              { text: 'Five-star overall safety rating.', claimIds: ['c1'] },
              { text: 'Winter snow and ice.', claimIds: ['c2', 'c99'] },
            ],
          });
        case 'writer':
          return json({ paragraph: goodParagraph, claimIds: ['c1', 'c2'] });
        case 'critic':
          return json({ approved: true, issues: [] });
      }
    },
  };
  return { port, requests };
}

const run = (port: ModelPort, ledger = new SpendLedger(), input = projection) =>
  runAgentTeam({ projection: input, port, budget: ledger.forLead() });

describe('agent team', () => {
  it('researches, verifies claims, drafts and records every call', async () => {
    const { port, requests } = fakePort();
    const outcome = await run(port);
    expect(outcome.status).toBe('drafted');
    expect(outcome.paragraph).toBe(goodParagraph);
    expect(outcome.paragraphClaimIds).toEqual(['c1', 'c2']);
    // The recall claim's number is not in its quote, so it is rejected.
    expect(outcome.candidateClaims).toBe(3);
    expect(outcome.rejectedClaims).toBe(1);
    expect(outcome.claims.map((claim) => claim.topic)).toEqual([
      'vehicle',
      'area',
    ]);
    // Unknown claim IDs are dropped from brief points.
    expect(outcome.points[1]?.claimIds).toEqual(['c2']);
    expect(outcome.calls.map((call) => call.role)).toEqual([
      'lead_plan',
      'worker',
      'worker',
      'worker',
      'lead_merge',
      'writer',
      'critic',
    ]);
    const workers = requests.filter((request) => request.role === 'worker');
    expect(
      workers.every((request) => request.model === 'claude-haiku-5-5'),
    ).toBe(true);
    expect(
      workers.every(
        (request) =>
          request.webSearchMaxUses === AGENT_LIMITS.searchesPerWorker,
      ),
    ).toBe(true);
    expect(outcome.totalCostMicros).toBe(
      outcome.calls.reduce((sum, call) => sum + call.costMicros, 0),
    );
    expect(outcome.totalCostMicros).toBeGreaterThan(0);
  });

  it('never sends the person to a model', async () => {
    const { port, requests } = fakePort();
    await run(port);
    const sent = JSON.stringify(requests);
    for (const value of [
      'Zebulon',
      'Quistgaard',
      'example.com',
      '22150',
      'Petunia',
      'Featherstonehaugh',
    ]) {
      expect(sent).not.toContain(value);
    }
    expect(sent).toContain('Camry');
    expect(sent).toContain('Springfield');
  });

  it('rewrites after a rule failure and uses the fixed paragraph', async () => {
    const { port } = fakePort({
      writer: (_request, count) =>
        json({
          paragraph:
            count === 1
              ? 'Your Camry has a five-star rating. We can find you a better rate.'
              : goodParagraph,
          claimIds: ['c1', 'c2'],
        }),
    });
    const outcome = await run(port);
    expect(outcome.status).toBe('drafted');
    expect(outcome.attempts).toBe(2);
    expect(outcome.calls.filter((call) => call.role === 'critic')).toHaveLength(
      1,
    );
  });

  it('falls back when the critic never approves', async () => {
    const { port } = fakePort({
      critic: () => json({ approved: false, issues: ['Too vague.'] }),
    });
    const outcome = await run(port);
    expect(outcome).toMatchObject({
      status: 'fallback',
      fallbackReason: 'critic_unresolved',
      paragraph: null,
      attempts: 3,
    });
    expect(outcome.criticNotes).toEqual([
      'Too vague.',
      'Too vague.',
      'Too vague.',
    ]);
  });

  it('falls back when every attempt breaks a rule', async () => {
    const { port } = fakePort({
      writer: () => json({ paragraph: 'Get a quote today.', claimIds: [] }),
    });
    const outcome = await run(port);
    expect(outcome.fallbackReason).toBe('rule_check_failed');
    expect(outcome.calls.filter((call) => call.role === 'critic')).toHaveLength(
      0,
    );
  });

  it('stops without calling when the lead cap would be exceeded', async () => {
    const { port, requests } = fakePort();
    const ledger = new SpendLedger({
      leadMicros: 1_000,
      processMicros: 8_000_000,
    });
    const outcome = await run(port, ledger);
    expect(outcome.fallbackReason).toBe('budget_exceeded');
    expect(requests).toHaveLength(0);
    expect(outcome.calls[0]).toMatchObject({
      outcome: 'not_made',
      errorCode: 'budget_exceeded',
      costMicros: 0,
    });
  });

  it('keeps the process cap across leads and settles to actual cost', async () => {
    const shared = new SpendLedger();
    const first = await run(fakePort().port, shared);
    expect(first.status).toBe('drafted');
    expect(shared.processSpentMicros).toBe(first.totalCostMicros);

    const ledger = new SpendLedger({
      leadMicros: 300_000,
      processMicros: 400_000,
    });
    ledger.forLead().reserve(250_000)(200_000);
    const next = ledger.forLead();
    next.reserve(150_000)(150_000);
    expect(ledger.processSpentMicros).toBe(350_000);
    expect(() => next.reserve(100_000)).toThrow(
      expect.objectContaining({ scope: 'process' }),
    );
  });

  it('reserves at least the cost a call can reach', () => {
    const request: ModelRequest = {
      role: 'worker',
      topic: 'area',
      model: 'claude-haiku-5-5',
      system: 'x'.repeat(1_000),
      user: 'y'.repeat(1_000),
      maxTokens: 2_000,
      webSearchMaxUses: 3,
    };
    // 1,000 + 90,000 input tokens, 2,000 output tokens, three searches.
    expect(worstCaseMicros(request)).toBe(9_100 + 1_000 + 30_000);
    const ledger = new SpendLedger({ leadMicros: 100, processMicros: 100 });
    expect(() => ledger.forLead().reserve(101)).toThrow(BudgetExceededError);
  });

  it('records model errors and falls back', async () => {
    const { port } = fakePort({
      lead_plan: () => {
        throw new ModelCallError('refusal', usage);
      },
    });
    const outcome = await run(port);
    expect(outcome.fallbackReason).toBe('model_error');
    expect(outcome.calls[0]).toMatchObject({
      outcome: 'error',
      errorCode: 'refusal',
    });
    expect(outcome.calls[0]?.costMicros).toBeGreaterThan(0);
  });

  it('persists a conservative reservation before an ambiguous provider call', async () => {
    const progress: Awaited<ReturnType<typeof runAgentTeam>>[] = [];
    const { port } = fakePort({
      lead_plan: () => {
        throw new ModelCallError('timeout');
      },
    });
    const outcome = await runAgentTeam({
      projection,
      port,
      budget: new SpendLedger().forLead(),
      onProgress: async (snapshot) => {
        progress.push(structuredClone(snapshot));
      },
    });
    expect(progress[0]?.calls[0]).toMatchObject({
      outcome: 'reserved',
      errorCode: 'call_pending',
      inputTokens: null,
      outputTokens: null,
      webSearchRequests: null,
    });
    expect(progress[0]?.calls[0]?.costMicros).toBe(
      progress[0]?.calls[0]?.reservedMicros,
    );
    expect(outcome).toMatchObject({
      status: 'fallback',
      fallbackReason: 'model_error',
    });
    expect(outcome.calls[0]).toMatchObject({
      outcome: 'error',
      errorCode: 'timeout',
      inputTokens: null,
      outputTokens: null,
      webSearchRequests: null,
    });
    expect(outcome.calls[0]?.costMicros).toBe(outcome.calls[0]?.reservedMicros);
  });

  it('falls back when any worker call fails', async () => {
    const { port } = fakePort({
      worker: (request) => {
        if (request.topic === 'area') throw new ModelCallError('timeout');
        return workerClaims[request.topic ?? 'coverage']!;
      },
    });
    const outcome = await run(port);
    expect(outcome).toMatchObject({
      status: 'fallback',
      fallbackReason: 'model_error',
    });
    expect(outcome.calls).not.toContainEqual(
      expect.objectContaining({ role: 'lead_merge' }),
    );
  });

  it('rejects a plan that omits questions for an available topic', async () => {
    const { port } = fakePort({
      lead_plan: () =>
        json({
          vehicle: [],
          area: ['What winter conditions are common?'],
          coverage: ['What does comprehensive coverage include?'],
        }),
    });
    const outcome = await run(port);
    expect(outcome).toMatchObject({
      status: 'fallback',
      fallbackReason: 'model_error',
    });
    expect(outcome.calls).toHaveLength(1);
  });

  it('treats unparseable JSON as a model error', async () => {
    const { port } = fakePort({
      lead_merge: () => ({ text: 'not json', citedBlocks: [], usage }),
    });
    const outcome = await run(port);
    expect(outcome.fallbackReason).toBe('model_error');
    expect(outcome.calls.at(-1)).toMatchObject({
      role: 'lead_merge',
      outcome: 'error',
      errorCode: 'invalid_json',
    });
  });

  it('keeps a truncated worker answer but not a truncated JSON answer', async () => {
    const truncatedWorker = fakePort({
      worker: (request) => ({
        ...workerClaims[request.topic ?? 'coverage']!,
        truncated: true,
      }),
    });
    const kept = await run(truncatedWorker.port);
    expect(kept.status).toBe('drafted');
    expect(
      kept.calls
        .filter((call) => call.role === 'worker')
        .every(
          (call) => call.outcome === 'ok' && call.errorCode === 'max_tokens',
        ),
    ).toBe(true);

    const truncatedPlan = fakePort({
      lead_plan: () => ({
        ...json({ vehicle: [], area: [], coverage: [] }),
        truncated: true,
      }),
    });
    const stopped = await run(truncatedPlan.port);
    expect(stopped.fallbackReason).toBe('model_error');
    expect(stopped.calls[0]).toMatchObject({
      outcome: 'error',
      errorCode: 'max_tokens',
    });
  });

  it('falls back when no claim survives verification', async () => {
    const { port } = fakePort({ worker: () => workerClaims.coverage! });
    const outcome = await run(port);
    expect(outcome.fallbackReason).toBe('no_verified_claims');
  });

  it('makes no call without a research subject', async () => {
    const { port, requests } = fakePort();
    const empty: AgentLeadProjection = {
      vehicle: null,
      area: null,
      needs: { needTimeline: null, coverageFocus: null, requestIntent: null },
    };
    const outcome = await run(port, new SpendLedger(), empty);
    expect(outcome.fallbackReason).toBe('no_research_subject');
    expect(requests).toHaveLength(0);
  });
});
