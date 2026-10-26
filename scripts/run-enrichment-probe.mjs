// Owner-authorized live enrichment probe (PROJECT.md "Phase 2 decisions",
// 2026-10-25). It sends read-only GETs to exactly vpic.nhtsa.dot.gov and
// api.zippopotam.us for the fixed fictional-lead subjects, carrying only make,
// model year or ZIP, with a 5 s timeout and at most one retry per URL. Answered
// responses become the `recorded` fixtures the offline gate and seed use.
// This command is separate from `pnpm check`. Requires `pnpm build`.
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import {
  ENRICHMENT_TIMEOUT_MS,
  EnrichmentFixtureFileSchema,
  EnrichmentNetworkError,
  EnrichmentTimeoutError,
  FixtureEnrichmentTransport,
  LiveEnrichmentTransport,
  PROBE_VEHICLE_SUBJECTS,
  PROBE_ZIP_SUBJECTS,
  RECORDED_ENRICHMENT_FIXTURE_PATH,
  assertAuthorizedEnrichmentUrl,
  loadEnrichmentFixtureFile,
  lookupVehicle,
  lookupZip,
  probeUrls,
  sha256,
} from '../packages/runtime/dist/index.js';

const transport = new LiveEnrichmentTransport();
const entries = [];
const unanswered = [];
// An unanswered URL keeps its earlier recording (with its own capture time)
// rather than losing it; nothing new is recorded for that subject.
const previous = existsSync(RECORDED_ENRICHMENT_FIXTURE_PATH)
  ? new Map(
      (
        await loadEnrichmentFixtureFile(RECORDED_ENRICHMENT_FIXTURE_PATH)
      ).entries.map((entry) => [entry.url, entry]),
    )
  : new Map();

const retryableStatus = (status) => status === 429 || status >= 500;

for (const { source, url } of probeUrls()) {
  assertAuthorizedEnrichmentUrl(source, url);
  let captured = null;
  let failure = null;
  for (const attempt of [1, 2]) {
    try {
      const response = await transport.get(url, ENRICHMENT_TIMEOUT_MS);
      captured = { response, capturedAt: new Date().toISOString() };
      failure = retryableStatus(response.status)
        ? `HTTP ${response.status}`
        : null;
    } catch (error) {
      if (
        !(error instanceof EnrichmentTimeoutError) &&
        !(error instanceof EnrichmentNetworkError)
      ) {
        throw error;
      }
      failure = error instanceof EnrichmentTimeoutError ? 'timeout' : 'network';
    }
    if (failure === null || attempt === 2) break;
    await new Promise((resolve) =>
      setTimeout(resolve, 250 + Math.floor(Math.random() * 500)),
    );
  }
  if (captured === null || failure !== null) {
    unanswered.push(`${url.href}: ${failure}`);
    const kept = previous.get(url.href);
    if (kept !== undefined) entries.push(kept);
    continue;
  }
  entries.push({
    kind: 'response',
    url: url.href,
    status: captured.response.status,
    body: captured.response.body,
    bodySha256: sha256(captured.response.body),
    capturedAt: captured.capturedAt,
  });
}

const file = EnrichmentFixtureFileSchema.parse({
  schemaVersion: 'enrichment-fixtures-v1',
  evidenceClass: 'recorded',
  description:
    'Responses captured by `pnpm enrichment:probe` from an owner-authorized live run. Vehicle data: NHTSA vPIC. ZIP data: Zippopotam.us / GeoNames.',
  entries: entries.sort((left, right) => left.url.localeCompare(right.url)),
});

// Report each subject's outcome through the same adapters the runtime uses.
const replay = new FixtureEnrichmentTransport(file);
const context = (index) => ({
  transport: replay,
  runId: '00000000-0000-4000-8000-000000000000',
  leadId: '00000000-0000-4000-8000-000000000000',
  evidenceId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  sleep: async () => {},
});
let index = 0;
for (const subject of PROBE_VEHICLE_SUBJECTS) {
  const { evidence } = await lookupVehicle(subject, context((index += 1)));
  console.log(
    `vPIC ${subject.vehicleYear} ${subject.vehicleMake} ${subject.vehicleModel}: ${evidence.outcome}${evidence.failureKind ? ` (${evidence.failureKind})` : ''}, HTTP ${evidence.httpStatus ?? '-'}`,
  );
}
for (const zipCode of PROBE_ZIP_SUBJECTS) {
  const { evidence } = await lookupZip(zipCode, context((index += 1)));
  const places =
    evidence.claim?.kind === 'zip_places'
      ? ` ${evidence.claim.places.map((place) => `${place.placeName}, ${place.stateAbbreviation}`).join('; ')}`
      : '';
  console.log(
    `ZIP ${zipCode}: ${evidence.outcome}${evidence.failureKind ? ` (${evidence.failureKind})` : ''}, HTTP ${evidence.httpStatus ?? '-'}${places}`,
  );
}

await writeFile(
  RECORDED_ENRICHMENT_FIXTURE_PATH,
  `${JSON.stringify(file, null, 2)}\n`,
);
console.log(
  `Wrote ${entries.length} recorded responses to ${RECORDED_ENRICHMENT_FIXTURE_PATH}.`,
);
if (unanswered.length > 0) {
  console.error(
    `${unanswered.length} request(s) went unanswered; no new recording was made for them:\n${unanswered.join('\n')}`,
  );
  process.exit(1);
}
