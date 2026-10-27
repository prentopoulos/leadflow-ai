import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repoRoot = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);

export function localPnpmExecutable() {
  const candidate =
    process.platform === 'win32'
      ? path.join(
          repoRoot,
          '.tools',
          'pnpm',
          'node_modules',
          'pnpm',
          'pnpm.exe',
        )
      : path.join(repoRoot, '.tools', 'pnpm', 'bin', 'pnpm');
  return existsSync(candidate) ? candidate : 'pnpm';
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
    timeout: options.timeout ?? 120_000,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
    }
    throw new Error(`${command} exited with ${result.status ?? 'no status'}`);
  }
  return result;
}

export function runPnpm(args, options = {}) {
  return run(localPnpmExecutable(), ['--dir', repoRoot, ...args], options);
}
