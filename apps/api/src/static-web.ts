import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Recharts and React set style attributes, so inline styles are allowed;
// scripts, connections and frames stay same-origin only.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export interface StaticAsset {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

// The built web app is read once into an exact path map. Requests are looked
// up, never joined onto the filesystem, so no traversal path exists.
export async function loadStaticAssets(
  distDirectory: string,
): Promise<Map<string, StaticAsset>> {
  const assets = new Map<string, StaticAsset>();
  for (const file of await listFiles(distDirectory)) {
    const relative = path.relative(distDirectory, file).split(path.sep);
    const extension = path.extname(file).toLowerCase();
    const contentType = CONTENT_TYPES[extension];
    if (contentType === undefined) continue;
    const urlPath = `/${relative.join('/')}`;
    assets.set(urlPath, {
      body: await readFile(file),
      contentType,
      // Vite fingerprints everything under /assets; the HTML entry must
      // always revalidate so a new revision is picked up.
      cacheControl: urlPath.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
  }
  const index = assets.get('/index.html');
  if (index === undefined) {
    throw new Error('The built web entry is missing.');
  }
  assets.set('/', index);
  return assets;
}

export function registerStaticWeb(
  app: FastifyInstance,
  assets: ReadonlyMap<string, StaticAsset>,
): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
    reply.header('content-security-policy', CONTENT_SECURITY_POLICY);
    return payload;
  });
  for (const [urlPath, asset] of assets) {
    app.get(urlPath, async (_request, reply) =>
      reply
        .header('content-type', asset.contentType)
        .header('cache-control', asset.cacheControl)
        .send(asset.body),
    );
  }
}
