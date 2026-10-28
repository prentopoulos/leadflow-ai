import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnthropicApiKeySchema } from '@leadflow-ai/domain';

export const LOCAL_ENV_PATH = fileURLToPath(
  new URL('../../../.env', import.meta.url),
);

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

// Writes one fixed dotenv key and preserves every unrelated line. The
// temporary file stays beside .env so rename is a same-volume replacement.
export async function saveLocalAnthropicApiKey(
  value: string,
  envPath = LOCAL_ENV_PATH,
): Promise<void> {
  const validatedValue = AnthropicApiKeySchema.parse(value);
  let existing = '';
  try {
    existing = await readFile(envPath, 'utf8');
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  const eol = existing.includes('\r\n') ? '\r\n' : '\n';
  const lines = existing
    .split(/\r?\n/u)
    .filter(
      (line) =>
        !new RegExp(
          `^\\s*(?:export\\s+)?ANTHROPIC_API_KEY\\s*${'='}`,
          'u',
        ).test(line),
    );
  while (lines.at(-1) === '') lines.pop();
  if (lines.length === 0) {
    lines.push('# Local-only secrets. This file is gitignored.');
  }
  lines.push(['ANTHROPIC_API_KEY', validatedValue].join('='));
  const next = `${lines.join(eol)}${eol}`;

  const temporaryPath = path.join(
    path.dirname(envPath),
    `${path.basename(envPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, next, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporaryPath, envPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}
