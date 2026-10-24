import { createApp } from './app.js';
import { loadServerConfig } from './config.js';

const config = loadServerConfig();
const app = createApp();

try {
  await app.listen(config);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
