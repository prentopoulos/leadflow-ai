import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const expectedNode = `v${manifest.engines.node}`;
const expectedPnpm = manifest.engines.pnpm;
const userAgent = process.env.npm_config_user_agent ?? '';
const actualPnpm = /pnpm\/([^\s]+)/u.exec(userAgent)?.[1] ?? null;

const errors = [];
if (process.version !== expectedNode) {
  errors.push(`Node ${expectedNode} required; received ${process.version}.`);
}
if (actualPnpm !== expectedPnpm) {
  errors.push(
    `pnpm ${expectedPnpm} required; received ${actualPnpm ?? 'unknown'}.`,
  );
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error(
    'Activate the local toolchain with: . .\\scripts\\activate-toolchain.ps1',
  );
  process.exitCode = 1;
} else {
  console.log(
    `Toolchain verified: Node ${process.version}, pnpm ${actualPnpm}.`,
  );
}
