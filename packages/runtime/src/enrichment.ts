import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_VERSIONS,
  EMAIL_CHECK_LIMITATION,
  ENRICHMENT_ENDPOINTS,
  EmailCheckSchema,
  EnrichmentEvidenceSchema,
  RAW_BODY_LIMIT_BYTES,
  TEST_EMAIL_DOMAINS,
  TestEmailSchema,
  VEHICLE_LISTING_STATEMENT,
  type EmailCheck,
  type EnrichmentEvidence,
  type EnrichmentFailureKind,
  type EnrichmentMode,
  type EnrichmentSource,
  type ExternalCallTelemetry,
} from '@leadflow-ai/domain';
import { z } from 'zod';

export const ENRICHMENT_TIMEOUT_MS = 5_000;
// Responses above this size are refused before parsing; they are far larger
// than either source returns for one subject.
const RESPONSE_READ_LIMIT_BYTES = 1_048_576;

export interface EnrichmentResponse {
  status: number;
  body: string;
  // Present only for recorded fixtures: when the live response was captured.
  capturedAt: string | null;
}

export class EnrichmentTimeoutError extends Error {
  constructor() {
    super('The enrichment request timed out.');
    this.name = 'EnrichmentTimeoutError';
  }
}

export class EnrichmentNetworkError extends Error {
  constructor() {
    super('The enrichment request failed before a response.');
    this.name = 'EnrichmentNetworkError';
  }
}

export class EnrichmentNotRecordedError extends Error {
  constructor() {
    super('No recorded response exists for this enrichment request.');
    this.name = 'EnrichmentNotRecordedError';
  }
}

export class EnrichmentRefusedError extends Error {
  readonly code = 'enrichment_refused' as const;

  constructor() {
    super('The enrichment request targets an unauthorized endpoint.');
    this.name = 'EnrichmentRefusedError';
  }
}

export interface EnrichmentTransport {
  readonly mode: EnrichmentMode;
  get(url: URL, timeoutMs: number): Promise<EnrichmentResponse>;
}

const authorizedPaths: Record<EnrichmentSource, RegExp> = {
  nhtsa_vpic:
    /^\/api\/vehicles\/GetModelsForMakeYear\/make\/[^/]+\/modelyear\/\d{4}$/u,
  zippopotam_us: /^\/us\/\d{5}$/u,
};

// The only outbound requests the product may make: HTTPS GETs to the two
// owner-authorized endpoint shapes. Everything else is refused before I/O.
export function assertAuthorizedEnrichmentUrl(
  source: EnrichmentSource,
  url: URL,
): void {
  const endpoint = ENRICHMENT_ENDPOINTS[source];
  const query = source === 'nhtsa_vpic' ? '?format=json' : '';
  if (
    url.protocol !== 'https:' ||
    url.host !== endpoint.host ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== '' ||
    url.search !== query ||
    !authorizedPaths[source].test(url.pathname)
  ) {
    throw new EnrichmentRefusedError();
  }
}

export function vehicleLookupUrl(make: string, modelYear: number): URL {
  return new URL(
    `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${modelYear}?format=json`,
  );
}

export function zipLookupUrl(zipCode: string): URL {
  return new URL(`https://api.zippopotam.us/us/${zipCode}`);
}

export class LiveEnrichmentTransport implements EnrichmentTransport {
  readonly mode = 'live' as const;

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async get(url: URL, timeoutMs: number): Promise<EnrichmentResponse> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: 'GET',
        redirect: 'error',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new EnrichmentTimeoutError();
      }
      throw new EnrichmentNetworkError();
    }
    let bytes: ArrayBuffer;
    try {
      bytes = await response.arrayBuffer();
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new EnrichmentTimeoutError();
      }
      throw new EnrichmentNetworkError();
    }
    if (bytes.byteLength > RESPONSE_READ_LIMIT_BYTES) {
      throw new EnrichmentNetworkError();
    }
    return {
      status: response.status,
      body: new TextDecoder().decode(bytes),
      capturedAt: null,
    };
  }
}

const FixtureEntrySchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('response'),
      url: z.string().url(),
      status: z.number().int().min(100).max(599),
      body: z.string().max(RESPONSE_READ_LIMIT_BYTES),
      bodySha256: z.string().regex(/^[a-f0-9]{64}$/u),
      capturedAt: z.iso.datetime().nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.enum(['timeout', 'network']),
      url: z.string().url(),
    })
    .strict(),
]);

export const EnrichmentFixtureFileSchema = z
  .object({
    schemaVersion: z.literal('enrichment-fixtures-v1'),
    evidenceClass: z.enum(['recorded', 'mock']),
    description: z.string().min(1).max(400),
    entries: z.array(FixtureEntrySchema).max(500),
  })
  .strict()
  .superRefine((file, context) => {
    const seen = new Set<string>();
    file.entries.forEach((entry, index) => {
      if (seen.has(entry.url)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'url'],
          message: 'each URL is recorded once',
        });
      }
      seen.add(entry.url);
      if (entry.kind !== 'response') {
        if (file.evidenceClass === 'recorded') {
          context.addIssue({
            code: 'custom',
            path: ['entries', index, 'kind'],
            message: 'recordings hold captured responses only',
          });
        }
        return;
      }
      if (sha256(entry.body) !== entry.bodySha256) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'bodySha256'],
          message: 'body digest mismatch',
        });
      }
      if ((file.evidenceClass === 'recorded') !== (entry.capturedAt !== null)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'capturedAt'],
          message: 'recorded responses, and only they, carry a capture time',
        });
      }
    });
  });
export type EnrichmentFixtureFile = z.infer<typeof EnrichmentFixtureFileSchema>;

// Serves recorded (captured from an authorized live call) or mock
// (hand-written) responses. It never touches the network.
export class FixtureEnrichmentTransport implements EnrichmentTransport {
  readonly mode: 'recorded' | 'mock';
  private readonly entries: Map<
    string,
    EnrichmentFixtureFile['entries'][number]
  >;

  constructor(file: EnrichmentFixtureFile) {
    const parsed = EnrichmentFixtureFileSchema.parse(file);
    this.mode = parsed.evidenceClass;
    this.entries = new Map(parsed.entries.map((entry) => [entry.url, entry]));
  }

  get(url: URL): Promise<EnrichmentResponse> {
    const entry = this.entries.get(url.href);
    if (entry === undefined) {
      return Promise.reject(new EnrichmentNotRecordedError());
    }
    if (entry.kind !== 'response') {
      return Promise.reject(
        entry.kind === 'timeout'
          ? new EnrichmentTimeoutError()
          : new EnrichmentNetworkError(),
      );
    }
    return Promise.resolve({
      status: entry.status,
      body: entry.body,
      capturedAt: entry.capturedAt,
    });
  }
}

export const RECORDED_ENRICHMENT_FIXTURE_PATH = fileURLToPath(
  new URL('../fixtures/recorded-enrichment.json', import.meta.url),
);
export const MOCK_ENRICHMENT_FIXTURE_PATH = fileURLToPath(
  new URL('../fixtures/mock-enrichment.json', import.meta.url),
);

export async function loadEnrichmentFixtureFile(
  filePath: string,
): Promise<EnrichmentFixtureFile> {
  return EnrichmentFixtureFileSchema.parse(
    JSON.parse(await readFile(filePath, 'utf8')),
  );
}

export async function createEnrichmentTransport(
  mode: EnrichmentMode,
): Promise<EnrichmentTransport> {
  if (mode === 'live') return new LiveEnrichmentTransport();
  const file = await loadEnrichmentFixtureFile(
    mode === 'recorded'
      ? RECORDED_ENRICHMENT_FIXTURE_PATH
      : MOCK_ENRICHMENT_FIXTURE_PATH,
  );
  if (file.evidenceClass !== mode) {
    throw new Error(
      `The ${mode} fixture file is labelled ${file.evidenceClass}.`,
    );
  }
  return new FixtureEnrichmentTransport(file);
}

// --- Lookups ------------------------------------------------------------------

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function boundBody(body: string): { rawBody: string; truncated: boolean } {
  const bytes = Buffer.from(body, 'utf8');
  if (bytes.byteLength <= RAW_BODY_LIMIT_BYTES) {
    return { rawBody: body, truncated: false };
  }
  // Drop any partial trailing character rather than storing U+FFFD.
  const cut = bytes.subarray(0, RAW_BODY_LIMIT_BYTES).toString('utf8');
  return { rawBody: cut.replace(/�+$/u, ''), truncated: true };
}

const VpicResponseSchema = z.object({
  Count: z.number().int().nonnegative(),
  Results: z.array(
    z.object({
      Make_Name: z.string().min(1),
      Model_Name: z.string().min(1),
    }),
  ),
});

const ZippopotamResponseSchema = z.object({
  'post code': z.string().regex(/^\d{5}$/u),
  places: z
    .array(
      z.object({
        'place name': z.string().min(1).max(120),
        state: z.string().min(1).max(80),
        'state abbreviation': z.string().regex(/^[A-Z]{2}$/u),
      }),
    )
    .min(1)
    .max(20),
});

const normalizeName = (value: string) =>
  value.trim().toLocaleLowerCase('en-US');

type AnswerClassification =
  | { outcome: 'found' | 'not_found'; claim: EnrichmentEvidence['claim'] }
  | { outcome: 'unavailable'; failureKind: EnrichmentFailureKind };

export interface AttemptRecord {
  attempt: 1 | 2;
  startedAt: string;
  durationMs: number;
  failureKind: EnrichmentFailureKind | null;
  retryScheduled: boolean;
  telemetry: ExternalCallTelemetry;
}

export interface LookupResult {
  evidence: EnrichmentEvidence;
  attempts: AttemptRecord[];
}

export interface LookupContext {
  transport: EnrichmentTransport;
  runId: string;
  leadId: string;
  evidenceId: string;
  now?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  timeoutMs?: number;
}

const retryable = new Set<EnrichmentFailureKind>([
  'timeout',
  'network',
  'rate_limited',
  'server_error',
]);

function failureFromStatus(status: number): EnrichmentFailureKind | null {
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'client_error';
  return null;
}

async function performLookup(
  source: EnrichmentSource,
  url: URL,
  subject: EnrichmentEvidence['subject'],
  classify: (response: EnrichmentResponse) => AnswerClassification,
  context: LookupContext,
): Promise<LookupResult> {
  assertAuthorizedEnrichmentUrl(source, url);
  const now = context.now ?? (() => new Date().toISOString());
  const sleep =
    context.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const random = context.random ?? Math.random;
  const endpoint = ENRICHMENT_ENDPOINTS[source];
  const attempts: AttemptRecord[] = [];
  const requestedAt = now();
  let response: EnrichmentResponse | null = null;
  let retrievedAt: string | null = null;
  let classification: AnswerClassification = {
    outcome: 'unavailable',
    failureKind: 'network',
  };

  for (const attempt of [1, 2] as const) {
    const startedAt = attempt === 1 ? requestedAt : now();
    let failureKind: EnrichmentFailureKind | null = null;
    let status: number | null = null;
    try {
      response = await context.transport.get(
        url,
        context.timeoutMs ?? ENRICHMENT_TIMEOUT_MS,
      );
      retrievedAt = now();
      status = response.status;
      classification = classify(response);
      failureKind =
        classification.outcome === 'unavailable'
          ? classification.failureKind
          : null;
    } catch (error) {
      if (error instanceof EnrichmentRefusedError) throw error;
      failureKind =
        error instanceof EnrichmentTimeoutError
          ? 'timeout'
          : error instanceof EnrichmentNotRecordedError
            ? 'not_recorded'
            : 'network';
      classification = { outcome: 'unavailable', failureKind };
    }
    const finishedAt = now();
    const retryScheduled =
      attempt === 1 && failureKind !== null && retryable.has(failureKind);
    attempts.push({
      attempt,
      startedAt,
      durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
      failureKind,
      retryScheduled,
      telemetry: {
        httpRequestMethod: 'GET',
        serverAddress: endpoint.host,
        httpResponseStatusCode: status,
        errorType: failureKind,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
        evidenceClass: context.transport.mode,
      },
    });
    if (!retryScheduled) break;
    await sleep(250 + Math.floor(random() * 500));
  }

  const body = response === null ? null : boundBody(response.body);
  const answered = classification.outcome !== 'unavailable';
  const evidence = EnrichmentEvidenceSchema.parse({
    schemaVersion: CONTRACT_VERSIONS.enrichmentEvidence,
    evidenceId: context.evidenceId,
    runId: context.runId,
    leadId: context.leadId,
    source,
    endpointTemplate: endpoint.template,
    subject,
    requestedAt,
    retrievedAt: answered ? retrievedAt : null,
    httpStatus: response?.status ?? null,
    outcome: classification.outcome,
    failureKind:
      classification.outcome === 'unavailable'
        ? classification.failureKind
        : null,
    notAttemptedReason: null,
    attempts: attempts.length,
    evidenceClass: context.transport.mode,
    recordedCapturedAt:
      context.transport.mode === 'recorded'
        ? (response?.capturedAt ?? null)
        : null,
    rawBody: body?.rawBody ?? null,
    rawBodyTruncated: body?.truncated ?? false,
    rawBodySha256: response === null ? null : sha256(response.body),
    claim:
      classification.outcome === 'unavailable' ? null : classification.claim,
    attribution: endpoint.attribution,
    createdAt: now(),
  });
  return { evidence, attempts };
}

export interface VehicleInput {
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
}

export async function lookupVehicle(
  input: VehicleInput,
  context: LookupContext,
): Promise<LookupResult> {
  const subject = {
    kind: 'vehicle' as const,
    make: input.vehicleMake,
    modelYear: input.vehicleYear,
    model: input.vehicleModel,
  };
  const {
    vehicleMake: make,
    vehicleYear: modelYear,
    vehicleModel: model,
  } = input;
  if (make === null || modelYear === null || model === null) {
    const now = context.now ?? (() => new Date().toISOString());
    const endpoint = ENRICHMENT_ENDPOINTS.nhtsa_vpic;
    return {
      attempts: [],
      evidence: EnrichmentEvidenceSchema.parse({
        schemaVersion: CONTRACT_VERSIONS.enrichmentEvidence,
        evidenceId: context.evidenceId,
        runId: context.runId,
        leadId: context.leadId,
        source: 'nhtsa_vpic',
        endpointTemplate: endpoint.template,
        subject,
        requestedAt: null,
        retrievedAt: null,
        httpStatus: null,
        outcome: 'not_attempted',
        failureKind: null,
        notAttemptedReason: 'missing_vehicle_fields',
        attempts: 0,
        evidenceClass: context.transport.mode,
        recordedCapturedAt: null,
        rawBody: null,
        rawBodyTruncated: false,
        rawBodySha256: null,
        claim: null,
        attribution: endpoint.attribution,
        createdAt: now(),
      }),
    };
  }
  return performLookup(
    'nhtsa_vpic',
    vehicleLookupUrl(make, modelYear),
    subject,
    (response) => {
      const statusFailure = failureFromStatus(response.status);
      if (statusFailure !== null) {
        return { outcome: 'unavailable', failureKind: statusFailure };
      }
      let parsed: z.infer<typeof VpicResponseSchema>;
      try {
        parsed = VpicResponseSchema.parse(JSON.parse(response.body));
      } catch {
        return { outcome: 'unavailable', failureKind: 'malformed' };
      }
      // Exact, case-insensitive match on both names; nothing is corrected.
      const match = parsed.Results.find(
        (result) =>
          normalizeName(result.Make_Name) === normalizeName(make) &&
          normalizeName(result.Model_Name) === normalizeName(model),
      );
      const listed = match !== undefined;
      return {
        outcome: listed ? 'found' : 'not_found',
        claim: {
          kind: 'vehicle_listing',
          listed,
          makeName: match?.Make_Name.slice(0, 120) ?? null,
          modelName: match?.Model_Name.slice(0, 120) ?? null,
          modelYear,
          statement: VEHICLE_LISTING_STATEMENT,
        },
      };
    },
    context,
  );
}

export async function lookupZip(
  zipCode: string,
  context: LookupContext,
): Promise<LookupResult> {
  return performLookup(
    'zippopotam_us',
    zipLookupUrl(zipCode),
    { kind: 'zip', zipCode },
    (response) => {
      // Zippopotam.us answers an unknown ZIP with 404 and an empty object.
      if (response.status === 404) {
        try {
          const body: unknown = JSON.parse(response.body);
          if (
            body !== null &&
            typeof body === 'object' &&
            !Array.isArray(body) &&
            Object.keys(body).length === 0
          ) {
            return { outcome: 'not_found', claim: null };
          }
        } catch {
          // Fall through: an unconfirmed 404 shape is malformed.
        }
        return { outcome: 'unavailable', failureKind: 'malformed' };
      }
      const statusFailure = failureFromStatus(response.status);
      if (statusFailure !== null) {
        return { outcome: 'unavailable', failureKind: statusFailure };
      }
      let parsed: z.infer<typeof ZippopotamResponseSchema>;
      try {
        parsed = ZippopotamResponseSchema.parse(JSON.parse(response.body));
      } catch {
        return { outcome: 'unavailable', failureKind: 'malformed' };
      }
      if (parsed['post code'] !== zipCode) {
        return { outcome: 'unavailable', failureKind: 'malformed' };
      }
      return {
        outcome: 'found',
        claim: {
          kind: 'zip_places',
          zipCode,
          places: parsed.places.map((place) => ({
            placeName: place['place name'],
            state: place.state,
            stateAbbreviation: place['state abbreviation'],
          })),
        },
      };
    },
    context,
  );
}

export function checkEmail(input: {
  email: string;
  emailCheckId: string;
  runId: string;
  leadId: string;
  checkedAt: string;
}): EmailCheck {
  const email = TestEmailSchema.parse(input.email);
  const domain = email.slice(email.lastIndexOf('@') + 1);
  const reserved = TEST_EMAIL_DOMAINS.find((candidate) => candidate === domain);
  if (reserved === undefined) {
    throw new Error('Email is outside the reserved test domains.');
  }
  return EmailCheckSchema.parse({
    schemaVersion: CONTRACT_VERSIONS.emailCheck,
    emailCheckId: input.emailCheckId,
    runId: input.runId,
    leadId: input.leadId,
    checkedAt: input.checkedAt,
    syntaxValid: true,
    reservedTestDomain: true,
    domain: reserved,
    limitation: EMAIL_CHECK_LIMITATION,
    evidenceClass: 'local-check',
  });
}

// The fixed subjects the authorized probe captures and the seed reuses. Each
// URL is requested once per probe run; Camero and Chevy are deliberate
// non-matches that reuse a recorded make/year response or test vPIC naming.
export const PROBE_VEHICLE_SUBJECTS: readonly VehicleInput[] = [
  { vehicleYear: 2022, vehicleMake: 'Toyota', vehicleModel: 'Camry' },
  { vehicleYear: 2022, vehicleMake: 'Toyota', vehicleModel: 'Camero' },
  { vehicleYear: 2021, vehicleMake: 'Honda', vehicleModel: 'Civic' },
  { vehicleYear: 2023, vehicleMake: 'Ford', vehicleModel: 'F-150' },
  { vehicleYear: 2020, vehicleMake: 'Subaru', vehicleModel: 'Outback' },
  { vehicleYear: 2024, vehicleMake: 'Tesla', vehicleModel: 'Model 3' },
  { vehicleYear: 2019, vehicleMake: 'Jeep', vehicleModel: 'Wrangler' },
  { vehicleYear: 2021, vehicleMake: 'Chevy', vehicleModel: 'Malibu' },
  {
    vehicleYear: 2024,
    vehicleMake: 'Example Motors',
    vehicleModel: 'Demo One',
  },
];
export const PROBE_ZIP_SUBJECTS: readonly string[] = [
  '22150',
  '10001',
  '90210',
  '60614',
  '98101',
  '78201',
  '30303',
  '02108',
  '00000',
  '99999',
];

export function probeUrls(): { source: EnrichmentSource; url: URL }[] {
  const seen = new Set<string>();
  const urls: { source: EnrichmentSource; url: URL }[] = [];
  for (const subject of PROBE_VEHICLE_SUBJECTS) {
    if (subject.vehicleMake === null || subject.vehicleYear === null) continue;
    const url = vehicleLookupUrl(subject.vehicleMake, subject.vehicleYear);
    if (!seen.has(url.href)) urls.push({ source: 'nhtsa_vpic', url });
    seen.add(url.href);
  }
  for (const zipCode of PROBE_ZIP_SUBJECTS) {
    urls.push({ source: 'zippopotam_us', url: zipLookupUrl(zipCode) });
  }
  return urls;
}
