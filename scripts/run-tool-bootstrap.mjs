import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const offline = process.argv.includes('--offline');
const command = process.platform === 'win32' ? 'powershell' : 'bash';
const args =
  process.platform === 'win32'
    ? [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(repoRoot, 'scripts/bootstrap-phase1-tools.ps1'),
        ...(offline ? ['-Offline'] : []),
      ]
    : [
        path.join(repoRoot, 'scripts/bootstrap-phase1-tools.sh'),
        ...(offline ? ['--offline'] : []),
      ];

if (!['win32', 'darwin'].includes(process.platform)) {
  console.error(`Tool bootstrap is not supported on ${process.platform}.`);
  process.exit(1);
}

const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
process.exit(result.status ?? 1);
