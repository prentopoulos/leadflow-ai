import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSystemBundle } from './bundle.js';
import { evaluateAll } from './evaluator.js';
import { COMBINED_CASES } from './fixtures.js';
import { EvalCaseSchema, EvalReportSchema } from './schemas.js';

const repoRoot = path.resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
const ids = new Set<string>();
for (const evaluationCase of COMBINED_CASES) {
  EvalCaseSchema.parse(evaluationCase);
  if (ids.has(evaluationCase.id))
    throw new Error(`Duplicate evaluation case ID: ${evaluationCase.id}`);
  ids.add(evaluationCase.id);
}

const results = await evaluateAll(COMBINED_CASES);
const byScope = {
  'pure-synthetic': results.filter(
    (result) => result.evidenceScope === 'pure-synthetic',
  ).length,
  'local-emulator': results.filter(
    (result) => result.evidenceScope === 'local-emulator',
  ).length,
  'rendered-local': results.filter(
    (result) => result.evidenceScope === 'rendered-local',
  ).length,
  'not-run': results.filter((result) => result.evidenceScope === 'not-run')
    .length,
};
const report = EvalReportSchema.parse({
  label: 'synthetic-local',
  generatedAt: new Date().toISOString(),
  bundle: await createSystemBundle(),
  summary: {
    total: results.length,
    passed: results.filter((result) => result.status === 'pass').length,
    failed: results.filter((result) => result.status === 'fail').length,
    notRun: results.filter((result) => result.status === 'not_run').length,
    stale: results.filter((result) => result.status === 'stale').length,
    byScope,
  },
  results,
});

const outputDirectory = path.join(repoRoot, '.local', 'evals');
await mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, 'phase-5-report.json');
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(
  `Synthetic-local evaluation: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.notRun} not_run, ${report.summary.stale} stale.`,
);
console.log(`Report: ${outputPath}`);
if (report.summary.failed > 0) process.exitCode = 1;
