// Writes the hosted release manifest inside the container build: the
// system-bundle-v3 fields known at build time, bound later by the running
// revision to its image digest. Usage:
//   node scripts/write-release-manifest.mjs <commit-sha> <source-digest> <out>
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSystemBundleBase } from '../packages/evals/dist/index.js';
import { ReleaseManifestSchema } from '../packages/runtime/dist/index.js';

const [commit, sourceDigest, output] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/u.test(commit ?? '')) {
  throw new Error('A full 40-character commit SHA is required.');
}
if (!/^[a-f0-9]{64}$/u.test(sourceDigest ?? '')) {
  throw new Error('A SHA-256 source digest is required.');
}
if (output === undefined) throw new Error('An output path is required.');

const base = await createSystemBundleBase({
  enrichmentMode: 'recorded',
  runtime: 'cloud',
  // Cloud Build verified the clone is exactly this clean commit.
  source: { revision: commit, dirty: false, sourceDigest, patchDigest: null },
});
const manifest = ReleaseManifestSchema.parse({
  schemaVersion: 'release-manifest-v1',
  base,
});
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Release manifest for ${commit} written.`);
