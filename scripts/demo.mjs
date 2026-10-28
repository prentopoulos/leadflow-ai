// One-command local demo for Windows and macOS: starts a fresh Firestore
// Emulator, builds, serves the API with recorded enrichment and the web app,
// then prints the dashboard link. Press "Run 60 leads" on Metrics to
// play the flight live. Ctrl+C stops everything; the emulator keeps no data.
// Run from an activated toolchain shell: `pnpm demo` (add `-- --open` to open
// the browser; add `-- --agents` to draft with the paid Claude agent team).
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { repoRoot } from './process-utils.mjs';

const node = process.execPath;
const children = [];

function start(label, args, readyPattern, env = process.env) {
  const child = spawn(node, args, {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // A process group lets Ctrl+C stop the emulator's Java child on macOS.
    detached: process.platform !== 'win32',
  });
  children.push(child);
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      if (readyPattern.test(String(chunk))) resolve(child);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) =>
      reject(new Error(`${label} stopped early (exit ${code}).`)),
    );
  });
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

function stopAll() {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

for (const port of [8080, 3001]) {
  if (!(await portFree(port))) {
    console.error(
      `Port ${port} is in use. Stop the other app or emulator, then run again.`,
    );
    process.exit(1);
  }
}

// Another local Vite app often holds 5173; take the next free port and tell
// the API, which accepts browser calls from that one origin only.
let webPort = 5173;
while (!(await portFree(webPort)) && webPort < 5190) webPort += 1;
const webOrigin = `http://127.0.0.1:${webPort}`;

try {
  console.log('Starting the Firestore Emulator…');
  await start(
    'Firestore Emulator',
    ['scripts/run-firestore-emulator.mjs', 'start'],
    /All emulators ready/u,
  );
  console.log('Building…');
  const build = spawnSync(node, ['scripts/run-workspace-builds.mjs'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  if (build.status !== 0) throw new Error('The build failed; run pnpm build.');
  const agents = process.argv.includes('--agents');
  console.log(
    agents
      ? 'Starting the API (saved responses, Claude agent team on)…'
      : 'Starting the API (saved responses only)…',
  );
  await start(
    'API',
    [
      'scripts/run-local-api.mjs',
      '--enrichment=recorded',
      ...(agents ? ['--agents=claude'] : []),
    ],
    /starting the API|listening/iu,
    { ...process.env, LEADFLOW_WEB_ORIGIN: webOrigin },
  );
  console.log('Starting the web app…');
  await start(
    'Web app',
    [
      path.join('node_modules', 'vite', 'bin', 'vite.js'),
      '--config',
      'apps/web/vite.config.ts',
      '--port',
      String(webPort),
      '--strictPort',
    ],
    /ready in|Local:/u,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stopAll();
  process.exit(1);
}

const url = `${webOrigin}/#metrics`;
console.log(`\nLeadFlow AI demo is running: ${url}`);
console.log(
  'Press "Run 60 leads" to send 60 fictional leads, one every 10 s. Ctrl+C stops the demo.',
);
if (process.argv.includes('--open')) {
  const opener =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
}
