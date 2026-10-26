import { describe, expect, it } from 'vitest';
import {
  EnrichmentNetworkError,
  EnrichmentRefusedError,
  EnrichmentTimeoutError,
  FixtureEnrichmentTransport,
  MOCK_ENRICHMENT_FIXTURE_PATH,
  assertAuthorizedEnrichmentUrl,
  checkEmail,
  loadEnrichmentFixtureFile,
  lookupVehicle,
  lookupZip,
  sha256,
  vehicleLookupUrl,
  zipLookupUrl,
  type EnrichmentResponse,
  type EnrichmentTransport,
  type LookupContext,
} from './enrichment.js';

const ids = {
  run: '22222222-2222-4222-8222-222222222222',
  lead: '11111111-1111-4111-8111-111111111111',
  evidence: '33333333-3333-4333-8333-333333333333',
};

type Step = EnrichmentResponse | Error;

class ScriptedTransport implements EnrichmentTransport {
  readonly requested: string[] = [];

  constructor(
    private readonly steps: Step[],
    readonly mode: EnrichmentTransport['mode'] = 'mock',
  ) {}

  get(url: URL): Promise<EnrichmentResponse> {
    this.requested.push(url.href);
    const step = this.steps.shift();
    if (step === undefined) throw new Error('unexpected extra request');
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step);
  }
}

const ok = (body: unknown, status = 200): EnrichmentResponse => ({
  status,
  body: typeof body === 'string' ? body : JSON.stringify(body),
  capturedAt: null,
});

function context(transport: EnrichmentTransport): LookupContext & {
  sleeps: number[];
} {
  let tick = 0;
  const sleeps: number[] = [];
  return {
    transport,
    runId: ids.run,
    leadId: ids.lead,
    evidenceId: ids.evidence,
    now: () =>
      new Date(Date.UTC(2026, 9, 25, 20, 0, 0, tick++ * 10)).toISOString(),
    sleep: (milliseconds) => {
      sleeps.push(milliseconds);
      return Promise.resolve();
    },
    random: () => 0.5,
    sleeps,
  };
}

const camry = {
  vehicleYear: 2022,
  vehicleMake: 'Toyota',
  vehicleModel: 'camry',
};
const vpicBody = {
  Count: 2,
  Message: 'Response returned successfully',
  Results: [
    { Make_ID: 448, Make_Name: 'TOYOTA', Model_ID: 2469, Model_Name: 'Camry' },
    {
      Make_ID: 448,
      Make_Name: 'TOYOTA',
      Model_ID: 2208,
      Model_Name: 'Corolla',
    },
  ],
};

describe('enrichment endpoint allowlist', () => {
  it('accepts only the two authorized HTTPS endpoint shapes', () => {
    expect(() =>
      assertAuthorizedEnrichmentUrl(
        'nhtsa_vpic',
        vehicleLookupUrl('Land Rover', 2020),
      ),
    ).not.toThrow();
    expect(() =>
      assertAuthorizedEnrichmentUrl('zippopotam_us', zipLookupUrl('22150')),
    ).not.toThrow();
    for (const [source, href] of [
      ['zippopotam_us', 'http://api.zippopotam.us/us/22150'],
      ['zippopotam_us', 'https://api.zippopotam.us/gb/22150'],
      ['zippopotam_us', 'https://api.zippopotam.us.example.com/us/22150'],
      [
        'nhtsa_vpic',
        'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1?format=json',
      ],
      [
        'nhtsa_vpic',
        'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/x/modelyear/2020?format=xml',
      ],
    ] as const) {
      expect(() =>
        assertAuthorizedEnrichmentUrl(source, new URL(href)),
      ).toThrow(EnrichmentRefusedError);
    }
  });
});

describe('vehicle lookup', () => {
  it('sends only make and year and matches the model locally', async () => {
    const transport = new ScriptedTransport([ok(vpicBody)]);
    const { evidence, attempts } = await lookupVehicle(
      camry,
      context(transport),
    );
    expect(transport.requested).toEqual([
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/Toyota/modelyear/2022?format=json',
    ]);
    expect(evidence).toMatchObject({
      outcome: 'found',
      httpStatus: 200,
      attempts: 1,
      evidenceClass: 'mock',
      claim: { listed: true, makeName: 'TOYOTA', modelName: 'Camry' },
      rawBodySha256: sha256(JSON.stringify(vpicBody)),
    });
    expect(attempts[0]?.telemetry).toMatchObject({
      serverAddress: 'vpic.nhtsa.dot.gov',
      httpResponseStatusCode: 200,
      errorType: null,
    });
  });

  it('reports an unlisted model as not found and never corrects it', async () => {
    const { evidence } = await lookupVehicle(
      { ...camry, vehicleModel: 'Camero' },
      context(new ScriptedTransport([ok(vpicBody)])),
    );
    expect(evidence.outcome).toBe('not_found');
    expect(evidence.claim).toMatchObject({ listed: false, modelName: null });
    expect(evidence.subject).toMatchObject({ model: 'Camero' });
  });

  it('records a not-attempted lookup without any request', async () => {
    const transport = new ScriptedTransport([]);
    const { evidence, attempts } = await lookupVehicle(
      { ...camry, vehicleModel: null },
      context(transport),
    );
    expect(transport.requested).toEqual([]);
    expect(attempts).toEqual([]);
    expect(evidence).toMatchObject({
      outcome: 'not_attempted',
      notAttemptedReason: 'missing_vehicle_fields',
    });
  });

  it('does not retry a client error or a malformed answer', async () => {
    const client = await lookupVehicle(
      camry,
      context(new ScriptedTransport([ok('Bad Request', 400)])),
    );
    expect(client.evidence).toMatchObject({
      outcome: 'unavailable',
      failureKind: 'client_error',
      attempts: 1,
    });
    const malformed = await lookupVehicle(
      camry,
      context(new ScriptedTransport([ok('<html>')])),
    );
    expect(malformed.evidence).toMatchObject({
      outcome: 'unavailable',
      failureKind: 'malformed',
      attempts: 1,
    });
  });
});

describe('ZIP lookup', () => {
  const zipBody = {
    'post code': '22150',
    country: 'United States',
    places: [
      {
        'place name': 'Springfield',
        state: 'Virginia',
        'state abbreviation': 'VA',
      },
    ],
  };

  it('stores every returned place without choosing one', async () => {
    const twoPlaces = {
      ...zipBody,
      places: [
        ...zipBody.places,
        {
          'place name': 'Franconia',
          state: 'Virginia',
          'state abbreviation': 'VA',
        },
      ],
    };
    const { evidence } = await lookupZip(
      '22150',
      context(new ScriptedTransport([ok(twoPlaces)])),
    );
    expect(evidence.claim).toEqual({
      kind: 'zip_places',
      zipCode: '22150',
      places: [
        {
          placeName: 'Springfield',
          state: 'Virginia',
          stateAbbreviation: 'VA',
        },
        { placeName: 'Franconia', state: 'Virginia', stateAbbreviation: 'VA' },
      ],
    });
  });

  it('treats the empty 404 as a valid not-found answer', async () => {
    const { evidence } = await lookupZip(
      '00000',
      context(new ScriptedTransport([ok('{}', 404)])),
    );
    expect(evidence).toMatchObject({
      outcome: 'not_found',
      claim: null,
      httpStatus: 404,
    });
  });

  it('retries a timeout once and keeps both attempts', async () => {
    const lookup = context(
      new ScriptedTransport([new EnrichmentTimeoutError(), ok(zipBody)]),
    );
    const { evidence, attempts } = await lookupZip('22150', lookup);
    expect(evidence).toMatchObject({ outcome: 'found', attempts: 2 });
    expect(attempts.map((attempt) => attempt.failureKind)).toEqual([
      'timeout',
      null,
    ]);
    expect(attempts[0]?.retryScheduled).toBe(true);
    expect(lookup.sleeps).toEqual([500]);
  });

  it('becomes unavailable after two transient failures without a third attempt', async () => {
    const transport = new ScriptedTransport([
      ok('Too Many Requests', 429),
      ok('Internal Server Error', 500),
    ]);
    const { evidence, attempts } = await lookupZip('22150', context(transport));
    expect(transport.requested).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.failureKind)).toEqual([
      'rate_limited',
      'server_error',
    ]);
    expect(evidence).toMatchObject({
      outcome: 'unavailable',
      failureKind: 'server_error',
      claim: null,
      retrievedAt: null,
      attempts: 2,
    });
  });

  it('retries a network failure and reports it unavailable when it repeats', async () => {
    const { evidence } = await lookupZip(
      '22150',
      context(
        new ScriptedTransport([
          new EnrichmentNetworkError(),
          new EnrichmentNetworkError(),
        ]),
      ),
    );
    expect(evidence).toMatchObject({
      outcome: 'unavailable',
      failureKind: 'network',
      httpStatus: null,
      rawBody: null,
    });
  });

  it('describes only the final attempt when a 503 is followed by a timeout', async () => {
    const { evidence } = await lookupZip(
      '22150',
      context(
        new ScriptedTransport([
          ok('<html>Service Unavailable</html>', 503),
          new EnrichmentTimeoutError(),
        ]),
      ),
    );
    expect(evidence).toMatchObject({
      outcome: 'unavailable',
      failureKind: 'timeout',
      httpStatus: null,
      rawBody: null,
      rawBodySha256: null,
      attempts: 2,
    });
  });

  it('bounds the stored body and keeps the digest of the full body', async () => {
    const huge = { ...zipBody, padding: 'x'.repeat(70_000) };
    const { evidence } = await lookupZip(
      '22150',
      context(new ScriptedTransport([ok(huge)])),
    );
    expect(evidence.rawBodyTruncated).toBe(true);
    expect(evidence.rawBody?.length).toBeLessThanOrEqual(65_536);
    expect(evidence.rawBodySha256).toBe(sha256(JSON.stringify(huge)));
  });
});

describe('fixture transports', () => {
  it('labels hand-written fixtures as mock and serves their failure shapes', async () => {
    const transport = new FixtureEnrichmentTransport(
      await loadEnrichmentFixtureFile(MOCK_ENRICHMENT_FIXTURE_PATH),
    );
    expect(transport.mode).toBe('mock');
    const timeout = await lookupZip('11111', context(transport));
    expect(timeout.evidence).toMatchObject({
      outcome: 'unavailable',
      failureKind: 'timeout',
      evidenceClass: 'mock',
      attempts: 2,
    });
  });

  it('reports a missing recording as not_recorded without retrying', async () => {
    const transport = new FixtureEnrichmentTransport({
      schemaVersion: 'enrichment-fixtures-v1',
      evidenceClass: 'recorded',
      description: 'empty recording',
      entries: [],
    });
    const { evidence } = await lookupZip('22150', context(transport));
    expect(evidence).toMatchObject({
      outcome: 'unavailable',
      failureKind: 'not_recorded',
      evidenceClass: 'recorded',
      recordedCapturedAt: null,
      attempts: 1,
    });
  });

  it('carries the live capture time on recorded evidence', async () => {
    const body = JSON.stringify({
      'post code': '22150',
      places: [
        {
          'place name': 'Springfield',
          state: 'Virginia',
          'state abbreviation': 'VA',
        },
      ],
    });
    const transport = new FixtureEnrichmentTransport({
      schemaVersion: 'enrichment-fixtures-v1',
      evidenceClass: 'recorded',
      description: 'one recording',
      entries: [
        {
          kind: 'response',
          url: 'https://api.zippopotam.us/us/22150',
          status: 200,
          body,
          bodySha256: sha256(body),
          capturedAt: '2026-10-25T19:00:00.000Z',
        },
      ],
    });
    const { evidence } = await lookupZip('22150', context(transport));
    expect(evidence).toMatchObject({
      evidenceClass: 'recorded',
      recordedCapturedAt: '2026-10-25T19:00:00.000Z',
    });
  });

  it('rejects a recording whose body does not match its digest', () => {
    expect(
      () =>
        new FixtureEnrichmentTransport({
          schemaVersion: 'enrichment-fixtures-v1',
          evidenceClass: 'recorded',
          description: 'tampered',
          entries: [
            {
              kind: 'response',
              url: 'https://api.zippopotam.us/us/22150',
              status: 200,
              body: '{}',
              bodySha256: 'c'.repeat(64),
              capturedAt: '2026-10-25T19:00:00.000Z',
            },
          ],
        }),
    ).toThrow();
  });
});

describe('local email check', () => {
  it('reports only syntax and reserved test domain', () => {
    expect(
      checkEmail({
        email: 'avery@example.org',
        emailCheckId: ids.evidence,
        runId: ids.run,
        leadId: ids.lead,
        checkedAt: '2026-10-25T20:00:00.000Z',
      }),
    ).toMatchObject({
      domain: 'example.org',
      limitation: 'no mailbox existence, deliverability or ownership claim',
      evidenceClass: 'local-check',
    });
  });
});
