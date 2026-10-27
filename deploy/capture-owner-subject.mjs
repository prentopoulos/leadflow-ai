// Captures the stable Google subject from the owner's own gcloud identity
// token before the first IAP deployment. The private subject is written only
// to the ignored .local directory and is never printed.
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function decodePayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[1] === undefined) {
    throw new Error('gcloud did not return an identity token.');
  }
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

export function ownerSubjectFromIdentityToken(
  token,
  requiredAccount,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const payload = decodePayload(token);
  if (
    !['accounts.google.com', 'https://accounts.google.com'].includes(
      payload.iss,
    ) ||
    payload.email_verified !== true ||
    payload.email !== requiredAccount ||
    !/^\d{6,32}$/u.test(payload.sub ?? '') ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= nowSeconds
  ) {
    throw new Error('The identity token is not the current required owner.');
  }
  return `accounts.google.com:${payload.sub}`;
}

export async function captureOwnerSubject(environment = process.env) {
  const requiredAccount = environment.LEADFLOW_OWNER_EMAIL ?? '';
  if (!/^[^\s@]+@[^\s@]+$/u.test(requiredAccount)) {
    throw new Error('LEADFLOW_OWNER_EMAIL is missing or malformed.');
  }
  const { stdout: activeOutput } = await execute(
    'gcloud',
    ['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'],
    { encoding: 'utf8', windowsHide: true },
  );
  if (activeOutput.trim() !== requiredAccount) {
    throw new Error('The active gcloud account is not the required owner.');
  }
  const { stdout: tokenOutput } = await execute(
    'gcloud',
    ['auth', 'print-identity-token'],
    { encoding: 'utf8', windowsHide: true },
  );
  const subject = ownerSubjectFromIdentityToken(
    tokenOutput.trim(),
    requiredAccount,
  );
  const output = path.join(root, '.local', 'owner-subject.txt');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${subject}\n`, { encoding: 'utf8', mode: 0o600 });
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await captureOwnerSubject();
  console.log('Captured the owner subject in the ignored private record.');
}
