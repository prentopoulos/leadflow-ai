import { runPnpm } from './process-utils.mjs';

const checks = [
  'preflight',
  'format:check',
  'lint',
  'typecheck',
  'test',
  'build',
  'eval',
  'smoke',
  'governance',
  'check:openspec',
];

for (const check of checks) {
  console.log(`\n==> ${check}`);
  runPnpm(['run', check], { timeout: 180_000 });
}

console.log('\nPhase 0 offline quality gate passed.');
