import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { repoRoot } from './process-utils.mjs';

export function extractConstitution(text) {
  const lines = text.split(/\r?\n/u).map((line) => line.trim());
  const start = lines.findIndex((line) =>
    /^\*\*Version \d+\.\d+\.\d+\*\*/u.test(line),
  );
  if (start < 0) {
    throw new Error('Constitution version line not found.');
  }

  const bullets = [];
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('- ')) {
      if (current) bullets.push(current);
      current = line;
      continue;
    }
    if (current && line && !line.startsWith('#') && !line.startsWith('|')) {
      current = `${current} ${line}`;
      continue;
    }
    if (current && (!line || line.startsWith('#') || line.startsWith('|'))) {
      bullets.push(current);
      current = null;
      if (bullets.length > 0) break;
    }
  }
  if (current) bullets.push(current);

  if (bullets.length === 0) {
    throw new Error('Constitution rules not found.');
  }

  return {
    version: lines[start].replace(/\s+/gu, ' '),
    rules: bullets.map((rule) => rule.replace(/\s+/gu, ' ')),
  };
}

export async function checkConstitution() {
  const paths = [
    'PROJECT.md',
    'AGENTS.md',
    path.join('openspec', 'config.yaml'),
  ];
  const records = await Promise.all(
    paths.map(async (relativePath) => ({
      path: relativePath,
      value: extractConstitution(
        await readFile(path.join(repoRoot, relativePath), 'utf8'),
      ),
    })),
  );
  const expected = JSON.stringify(records[0].value);
  const drift = records.filter(
    (record) => JSON.stringify(record.value) !== expected,
  );
  if (drift.length > 0) {
    throw new Error(
      `Constitution drift detected in: ${drift.map((item) => item.path).join(', ')}`,
    );
  }
  console.log(
    `Constitution copies match (${records[0].value.version}, ${records[0].value.rules.length} rules).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await checkConstitution();
}
