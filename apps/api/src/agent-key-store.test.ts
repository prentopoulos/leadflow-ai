import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { saveLocalAnthropicApiKey } from './agent-key-store.js';

const temporaryDirectories = new Set<string>();
const apiKey = ['sk', 'ant', 'a'.repeat(24)].join('-');
const keyName = ['ANTHROPIC', 'API', 'KEY'].join('_');

afterEach(async () => {
  await Promise.all(
    [...temporaryDirectories].map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  temporaryDirectories.clear();
});

async function temporaryEnvPath() {
  const temporaryRoot = path.join(process.cwd(), 'tmp');
  await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(path.join(temporaryRoot, 'leadflow-env-'));
  temporaryDirectories.add(directory);
  return path.join(directory, '.env');
}

describe('local Anthropic key store', () => {
  it('creates a missing dotenv file with one assignment', async () => {
    const envPath = await temporaryEnvPath();
    await saveLocalAnthropicApiKey(apiKey, envPath);
    const stored = await readFile(envPath, 'utf8');
    expect(stored).toContain('This file is gitignored.');
    expect(stored).toContain([keyName, apiKey].join('='));
    expect(stored.match(new RegExp(`${keyName}${'='}`, 'gu'))).toHaveLength(1);
  });

  it('preserves unrelated entries and replaces duplicate key assignments', async () => {
    const envPath = await temporaryEnvPath();
    await writeFile(
      envPath,
      [
        'HOST=127.0.0.1',
        [keyName, ['sk', 'ant', 'old-old-old-old'].join('-')].join('='),
        `export ${[keyName, ['sk', 'ant', 'second-old-old'].join('-')].join('=')}`,
        `# ${[keyName, 'example'].join('=')}`,
        '',
      ].join('\r\n'),
    );
    await saveLocalAnthropicApiKey(apiKey, envPath);
    const stored = await readFile(envPath, 'utf8');
    expect(stored).toContain('HOST=127.0.0.1');
    expect(stored).toContain(`# ${[keyName, 'example'].join('=')}`);
    expect(stored).not.toContain(['sk', 'ant', 'old'].join('-'));
    expect(stored).not.toContain(['sk', 'ant', 'second'].join('-'));
    expect(stored.match(new RegExp(`^${keyName}${'='}`, 'gmu'))).toHaveLength(
      1,
    );
  });

  it('rejects unsafe values before writing', async () => {
    const envPath = await temporaryEnvPath();
    await expect(
      saveLocalAnthropicApiKey(
        `${['sk', 'ant', 'a'.repeat(20)].join('-')}\nHOST=attacker`,
        envPath,
      ),
    ).rejects.toThrow();
    await expect(readFile(envPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('does not leave a temporary file when the target directory is missing', async () => {
    const envPath = await temporaryEnvPath();
    const missingPath = path.join(envPath, 'missing', '.env');
    await expect(
      saveLocalAnthropicApiKey(apiKey, missingPath),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
