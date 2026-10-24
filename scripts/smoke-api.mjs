import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { repoRoot } from './process-utils.mjs';

export async function smokeApi() {
  const { createApp } = await import(
    pathToFileURL(path.join(repoRoot, 'apps', 'api', 'dist', 'app.js')).href
  );
  const app = createApp();
  try {
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (
      !address ||
      typeof address === 'string' ||
      address.address !== '127.0.0.1'
    ) {
      throw new Error(
        `API smoke listener was not loopback-only: ${JSON.stringify(address)}`,
      );
    }
    const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json();
    if (!response.ok || body.status !== 'ok' || body.scope !== 'process') {
      throw new Error(
        `Unexpected API health response: ${response.status} ${JSON.stringify(body)}`,
      );
    }
    console.log(`API smoke passed on 127.0.0.1:${address.port}.`);
  } finally {
    await app.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await smokeApi();
}
