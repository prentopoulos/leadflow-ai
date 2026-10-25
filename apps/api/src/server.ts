import { createApp } from './app.js';
import { loadServerConfig } from './config.js';
import { createPhaseOneStartup } from './startup.js';
import {
  createPhaseOneApiDependencies,
  type PhaseOneApiDependencies,
} from './phase-one-runtime.js';

const config = loadServerConfig();
const phaseOne = createPhaseOneStartup();
let dependencies: PhaseOneApiDependencies | undefined;
if (
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
  ...(dependencies ?? {}),
});

try {
  await app.listen(config);
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
