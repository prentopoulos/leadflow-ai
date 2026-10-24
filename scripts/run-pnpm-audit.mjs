import { readFile } from 'node:fs/promises';
import { localPnpmExecutable, repoRoot, run } from './process-utils.mjs';

const before = await readFile(
  new URL('../pnpm-lock.yaml', import.meta.url),
  'utf8',
);
run(
  localPnpmExecutable(),
  ['--dir', repoRoot, 'audit', '--audit-level', 'high'],
  {
    timeout: 180_000,
  },
);
const after = await readFile(
  new URL('../pnpm-lock.yaml', import.meta.url),
  'utf8',
);

if (before !== after) {
  throw new Error('Dependency audit modified pnpm-lock.yaml.');
}

console.log(
  'Connected dependency audit completed without modifying the lockfile.',
);
