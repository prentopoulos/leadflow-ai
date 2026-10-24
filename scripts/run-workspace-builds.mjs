import path from 'node:path';
import { repoRoot, run } from './process-utils.mjs';

run(process.execPath, [
  path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-b',
  '--force',
  '--pretty',
  'false',
]);
run(process.execPath, [
  path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  'build',
  '--config',
  path.join(repoRoot, 'apps', 'web', 'vite.config.ts'),
]);
