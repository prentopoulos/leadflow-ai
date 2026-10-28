import { runPnpm } from './process-utils.mjs';

const checks = [
  'preflight',
  'format:check',
  'lint',
  'typecheck',
  'build',
  'test',
  'eval',
  'smoke',
  'governance',
  'docs:check',
  'check:openspec',
];

for (const check of checks) {
  console.log(`\n==> ${check}`);
  runPnpm(['run', check], { timeout: 180_000 });
}

console.log('\nOffline quality gate passed.');
