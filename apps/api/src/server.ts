import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  bindHostedSystemBundle,
  createFirestoreRepositories,
} from '@leadflow-ai/runtime';
import { createApp, type CreateAppOptions } from './app.js';
import { loadServerConfig } from './config.js';
import { GoogleIapKeySource, IapAssertionVerifier } from './iap.js';
import { createPhaseOneStartup, type ReadyStartup } from './startup.js';
import { loadStaticAssets } from './static-web.js';
import {
  createPhaseOneApiDependencies,
  type PhaseOneApiDependencies,
} from './phase-one-runtime.js';

const RELEASE_MANIFEST = fileURLToPath(
  new URL('../../../release/manifest.json', import.meta.url),
);
const WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url));

// The image carries a build-time manifest; the hosted process binds it to the
// revision serving it and records that bundle create-only before intake.
async function hostedSystemBundleId(startup: ReadyStartup): Promise<string> {
  if (startup.configuration.mode !== 'cloud') {
    throw new Error('Hosted bundle binding requires hosted mode.');
  }
  const manifest: unknown = JSON.parse(
    await readFile(RELEASE_MANIFEST, 'utf8'),
  );
  const bundle = bindHostedSystemBundle(manifest, {
    projectId: startup.configuration.projectId,
    revision: startup.configuration.revision,
    imageDigest: startup.configuration.imageDigest,
  });
  const repositories = createFirestoreRepositories(startup.firestore.database);
  if ((await repositories.systemBundles.get(bundle.systemBundleId)) === null) {
    try {
      await repositories.systemBundles.create(bundle);
    } catch (error) {
      // A concurrent instance may have recorded the same identity first.
      if (
        (await repositories.systemBundles.get(bundle.systemBundleId)) === null
      ) {
        throw error;
      }
    }
  }
  return bundle.systemBundleId;
}

const config = loadServerConfig();
const phaseOne = createPhaseOneStartup();
let dependencies: PhaseOneApiDependencies | undefined;
const hostedOptions: Pick<CreateAppOptions, 'iapVerifier' | 'staticAssets'> =
  {};
if (phaseOne.status === 'ready' && phaseOne.configuration.mode === 'cloud') {
  hostedOptions.iapVerifier = new IapAssertionVerifier({
    audience: phaseOne.configuration.iapAudience,
    allowedSubjects: phaseOne.configuration.allowedSubjects,
    keys: new GoogleIapKeySource(),
  });
  hostedOptions.staticAssets = await loadStaticAssets(WEB_DIST);
  try {
    dependencies = await createPhaseOneApiDependencies(
      phaseOne,
      await hostedSystemBundleId(phaseOne),
    );
  } catch {
    // Stateful routes answer 503; nothing falls back to local behavior.
    dependencies = undefined;
  }
} else if (
  phaseOne.status === 'ready' &&
  process.env.LEADFLOW_SYSTEM_BUNDLE_ID !== undefined
) {
  try {
    dependencies = await createPhaseOneApiDependencies(
      phaseOne,
      process.env.LEADFLOW_SYSTEM_BUNDLE_ID,
    );
  } catch {
    dependencies = undefined;
  }
}
const app = createApp({
  phaseOne,
  ...hostedOptions,
  ...(dependencies ?? {}),
});

try {
  await app.listen(config);
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
