// Source digest of a build context without Git: every file under the root,
// sorted by its '/'-joined relative path, hashing each path then its bytes.
// For a clean clone this matches the Git-listed digest in the system bundle,
// because .dockerignore mirrors .gitignore and adds only `.git`.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function listFiles(root, relative = '') {
  const entries = await readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (child === '.git') continue;
    if (entry.isDirectory()) files.push(...(await listFiles(root, child)));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

export async function treeSourceDigest(root) {
  const files = (await listFiles(root)).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update(await readFile(path.join(root, file)));
  }
  return { digest: hash.digest('hex'), files: files.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = path.resolve(process.argv[2] ?? '.');
  const { digest } = await treeSourceDigest(root);
  process.stdout.write(`${digest}\n`);
}
