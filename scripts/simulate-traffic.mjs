// Feeds the fixed fictional `traffic-plan-v1` through the real local intake
// API at a steady pace so the dashboard fills like live traffic. Run the API
// with recorded enrichment first:
//   pnpm api:local -- --enrichment=recorded
//   pnpm simulate:traffic -- [--interval=10] [--count=60]
// The script refuses unless the running API's system bundle is in recorded
// mode, so simulated traffic never multiplies live source reads. Idempotency
// keys are fixed per system bundle, so a second run adds nothing. Every lead,
// channel, campaign and click ID is synthetic. Requires `pnpm build`.
import {
  DEFAULT_TRAFFIC_INTERVAL_MS,
  PLANNED_TRAFFIC_LEADS,
  runTrafficPlan,
  trafficIdempotencyKey,
  trafficRefusal,
} from '../packages/domain/dist/index.js';
import {
  createEmulatorFirestoreBoundary,
  createFirestoreRepositories,
} from '../packages/runtime/dist/index.js';

const api = 'http://127.0.0.1:3001';

function option(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix));
  if (raw === undefined) return fallback;
  const value = Number(raw.slice(prefix.length));
  if (!Number.isFinite(value)) {
    console.error(`--${name} must be a number.`);
    process.exit(1);
  }
  return value;
}

async function runningBundle() {
  const response = await fetch(`${api}/v1/metrics`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`The local API is not ready (HTTP ${response.status}).`);
  }
  const { report } = await response.json();
  const boundary = createEmulatorFirestoreBoundary({
    ...process.env,
    GCLOUD_PROJECT: 'demo-leadflow-ai-local',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  });
  try {
    const bundle = await createFirestoreRepositories(
      boundary.database,
    ).systemBundles.get(report.systemBundleId);
    return { id: report.systemBundleId, mode: bundle?.enrichmentMode ?? null };
  } finally {
    await boundary.close();
  }
}

const intervalMs =
  option('interval', DEFAULT_TRAFFIC_INTERVAL_MS / 1000) * 1000;
const count = option('count', PLANNED_TRAFFIC_LEADS);
const { id: bundleId, mode } = await runningBundle();
const refusal = trafficRefusal(mode);
if (refusal !== null) {
  console.error(
    `Refusing to simulate: ${refusal} Start the API with \`pnpm api:local -- --enrichment=recorded\`.`,
  );
  process.exit(1);
}

console.log(
  `Simulating ${count} fictional leads, one every ${intervalMs / 1000} s (SIMULATED attribution, recorded enrichment).`,
);
try {
  const result = await runTrafficPlan({
    count,
    intervalMs,
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    async submit(entry) {
      const response = await fetch(`${api}/v1/intake`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': trafficIdempotencyKey(bundleId, entry.index),
        },
        body: JSON.stringify(entry.intake),
        signal: AbortSignal.timeout(5_000),
      });
      const label = `Lead ${entry.index + 1}/${count} (${entry.intake.attribution?.campaign ?? 'unattributed'})`;
      if (response.status === 202) {
        console.log(`${label}: stored`);
        return 'created';
      }
      if (response.status === 200) {
        console.log(`${label}: already present`);
        return 'replayed';
      }
      throw new Error(`${label} was rejected with HTTP ${response.status}.`);
    },
  });
  console.log(
    `Simulated traffic finished: ${result.created} new, ${result.replayed} already present.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
