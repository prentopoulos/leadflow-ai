import { createApp } from './app.js';
import { loadServerConfig } from './config.js';
import { createPhaseOneStartup } from './startup.js';

const config = loadServerConfig();
const app = createApp({ phaseOne: createPhaseOneStartup() });

try {
  await app.listen(config);
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
