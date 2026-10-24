import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const expectedNode = `v${manifest.engines.node}`;
const expectedPnpm = manifest.engines.pnpm;
const phaseOneMetadata = JSON.parse(
  await readFile(new URL('../toolchain.phase1.json', import.meta.url), 'utf8'),
);
const runtimeManifest = JSON.parse(
  await readFile(
    new URL('../packages/runtime/package.json', import.meta.url),
    'utf8',
  ),
);
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

const javaRoot = path.join(
  repoRoot,
  '.tools',
  'java',
  phaseOneMetadata.java.installDirectory,
);
const javaExecutable = path.join(javaRoot, 'bin', 'java.exe');
const structurizrExecutable = path.join(
  repoRoot,
  '.tools',
  phaseOneMetadata.structurizr.installDirectory,
  'structurizr.bat',
);
const firebaseEmulatorsPath = path.join(
  repoRoot,
  '.tools',
  'firebase',
  'emulators',
);
const firestoreEmulator = path.join(
  firebaseEmulatorsPath,
  phaseOneMetadata.firebase.emulatorFile,
);

for (const [label, candidate] of [
  ['Java', javaExecutable],
  ['Structurizr CLI', structurizrExecutable],
  ['Firestore Emulator', firestoreEmulator],
]) {
  if (!existsSync(candidate)) {
    errors.push(
      `${label} is missing at ${candidate}. Run pnpm tools:bootstrap.`,
    );
  }
}

if (existsSync(javaExecutable)) {
  const java = spawnSync(javaExecutable, ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const javaOutput = `${java.stdout ?? ''}${java.stderr ?? ''}`;
  if (
    java.status !== 0 ||
    !javaOutput.includes(`version "${phaseOneMetadata.java.runtimeVersion}`)
  ) {
    errors.push(
      `Java ${phaseOneMetadata.java.runtimeVersion} required; received ${javaOutput.trim() || 'unavailable'}.`,
    );
  }
}

if (
  process.env.JAVA_HOME === undefined ||
  path.resolve(process.env.JAVA_HOME) !== path.resolve(javaRoot)
) {
  errors.push(
    `JAVA_HOME must target the project-local Java ${phaseOneMetadata.java.version}. Activate the local toolchain.`,
  );
}
if (
  process.env.FIREBASE_EMULATORS_PATH === undefined ||
  path.resolve(process.env.FIREBASE_EMULATORS_PATH) !==
    path.resolve(firebaseEmulatorsPath)
) {
  errors.push(
    'FIREBASE_EMULATORS_PATH must target the project-local emulator cache. Activate the local toolchain.',
  );
}
if (
  manifest.devDependencies['firebase-tools'] !==
  phaseOneMetadata.firebase.cliVersion
) {
  errors.push('firebase-tools does not match toolchain.phase1.json.');
}
if (
  runtimeManifest.dependencies['@langchain/langgraph'] !== '1.5.2' ||
  runtimeManifest.dependencies['@langchain/core'] !== '1.3.0' ||
  runtimeManifest.dependencies['firebase-admin'] !== '14.5.0'
) {
  errors.push(
    'Phase 1 runtime dependencies do not match the accepted exact pins.',
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
    `Toolchain verified: Node ${process.version}, pnpm ${actualPnpm}, Java ${phaseOneMetadata.java.version}, Firestore Emulator ${phaseOneMetadata.firebase.emulatorVersion}, Structurizr CLI ${phaseOneMetadata.structurizr.version}.`,
  );
}
