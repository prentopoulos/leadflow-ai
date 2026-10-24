import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { preview } from 'vite';
import { repoRoot } from './process-utils.mjs';

export async function smokeWeb() {
  const server = await preview({
    configFile: path.join(repoRoot, 'apps', 'web', 'vite.config.ts'),
    root: path.join(repoRoot, 'apps', 'web'),
    preview: { host: '127.0.0.1', port: 0, strictPort: true },
  });
  try {
    const address = server.httpServer.address();
    if (
      !address ||
      typeof address === 'string' ||
      address.address !== '127.0.0.1'
    ) {
      throw new Error(
        `Web smoke listener was not loopback-only: ${JSON.stringify(address)}`,
      );
    }
    const response = await fetch(`http://127.0.0.1:${address.port}/`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.text();
    if (!response.ok || !body.includes('LeadFlow AI')) {
      throw new Error(`Unexpected web shell response: ${response.status}`);
    }
    console.log(`Web smoke passed on 127.0.0.1:${address.port}.`);
  } finally {
    await new Promise((resolve, reject) => {
      server.httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await smokeWeb();
}
