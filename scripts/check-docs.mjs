import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderDiagrams } from './generate-diagrams.mjs';
import { repoRoot } from './process-utils.mjs';

const read = (relative) => readFileSync(path.join(repoRoot, relative), 'utf8');

/** Local Markdown link and image targets, ignoring URLs, anchors and code. */
export function localTargets(markdown) {
  const prose = markdown
    .replace(/```[\s\S]*?```/gu, '')
    .replace(/`[^`]*`/gu, '');
  const targets = [
    ...[...prose.matchAll(/\]\(([^)\s]+)\)/gu)].map((match) => match[1]),
    ...[...prose.matchAll(/<img[^>]*\ssrc="([^"]+)"/gu)].map(
      (match) => match[1],
    ),
  ];
  return targets
    .filter((target) => !/^[a-z]+:/iu.test(target) && !target.startsWith('#'))
    .map((target) => target.split('#')[0]);
}

export function bottomLine(markdown) {
  const match =
    /<!-- bottom-line:start -->\n([\s\S]*?)<!-- bottom-line:end -->/u.exec(
      markdown,
    );
  if (match === null) throw new Error('README has no bottom-line markers');
  return match[1].trim();
}

export function expectedBottomLine({ caseCount, weights }) {
  const [timeline, clarity, completeness] = weights;
  return [
    `- ${caseCount} fixed synthetic evaluation cases`,
    `- rubric-v1 weights: need timeline ${timeline}, request clarity ${clarity}, completeness ${completeness}`,
  ].join('\n');
}

/** Visible text content of an SVG fragment, order-independent. */
export function svgTexts(markup) {
  return [...markup.matchAll(/<text\b[^>]*>([^<]*)<\/text>/gu)]
    .map((match) => match[1])
    .sort();
}

/** Names declared in the Structurizr model. */
export function modelNames(dsl) {
  return [
    ...dsl.matchAll(
      /=\s*(?:person|softwareSystem|container|component)\s+"([^"]+)"/gu,
    ),
  ].map((match) => match[1]);
}

/** Firestore collection names used by the runtime repositories and checkpointer. */
export function runtimeCollections(...sources) {
  const names = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/`([A-Za-z]+)\/\$\{/gu))
      names.add(match[1]);
    for (const match of source.matchAll(/\}\/([A-Za-z]+)(?:\/\$\{|`)/gu)) {
      names.add(match[1]);
    }
  }
  return names;
}

/** Collection names written as paths in the data-model view. */
export function diagramCollections(markup) {
  const names = new Set();
  for (const text of svgTexts(markup)) {
    if (!text.includes('/{') && !text.endsWith('}')) continue;
    for (const segment of text.split('/')) {
      if (/^[A-Za-z]+$/u.test(segment)) names.add(segment);
    }
  }
  return names;
}

function trackedFiles() {
  const listed = spawnSync(
    'git',
    [
      '-c',
      `safe.directory=${repoRoot.replaceAll('\\', '/')}`,
      'ls-files',
      '-z',
    ],
    { cwd: repoRoot, encoding: 'utf8', windowsHide: true },
  );
  if (listed.status !== 0) {
    throw new Error(`Unable to inspect tracked files: ${listed.stderr}`);
  }
  return new Set(listed.stdout.split('\0').filter(Boolean));
}

async function caseCount() {
  const built = path.join(repoRoot, 'packages/evals/dist/fixtures.js');
  if (!existsSync(built)) {
    throw new Error('Build the workspaces before docs:check (pnpm build).');
  }
  const { COMBINED_CASES } = await import(pathToFileURL(built).href);
  return COMBINED_CASES.length;
}

export async function checkDocs() {
  const errors = [];
  const readme = read('README.md');
  const tracked = trackedFiles();
  for (const target of localTargets(readme)) {
    const normalized = path.posix.normalize(target);
    if (!tracked.has(normalized)) {
      errors.push(`README link does not resolve to a tracked file: ${target}`);
    }
  }

  const weights = [
    ...read('packages/domain/src/qualification.ts').matchAll(
      /maximum: (\d+)/gu,
    ),
  ].map((match) => Number(match[1]));
  const expected = expectedBottomLine({
    caseCount: await caseCount(),
    weights,
  });
  if (bottomLine(readme) !== expected) {
    errors.push(`README bottom line drifted; expected:\n${expected}`);
  }

  for (const [file, html] of Object.entries(renderDiagrams())) {
    if (!existsSync(path.join(repoRoot, file)) || read(file) !== html) {
      errors.push(`${file} is stale; run pnpm docs:diagrams`);
      continue;
    }
    const svgFile = file.replace(/\.html$/u, '.svg');
    if (!existsSync(path.join(repoRoot, svgFile))) {
      errors.push(`${svgFile} is missing; run pnpm docs:diagrams`);
      continue;
    }
    const svg = read(svgFile);
    if (JSON.stringify(svgTexts(svg)) !== JSON.stringify(svgTexts(html))) {
      errors.push(
        `${svgFile} does not match its HTML source; run pnpm docs:diagrams`,
      );
    }
    if (/@import|fonts\.googleapis|<script/iu.test(svg)) {
      errors.push(`${svgFile} must render offline without imports or scripts`);
    }
    if (!/role="img"/u.test(svg) || !/<title id="[a-z-]+-title">/u.test(svg)) {
      errors.push(`${svgFile} is missing its accessible title`);
    }
  }

  const architecture = svgTexts(read('docs/diagrams/architecture.svg')).join(
    ' ',
  );
  const architectureTitle = /<title[^>]*>([^<]*)<\/title>/u.exec(
    read('docs/diagrams/architecture.svg'),
  )?.[1];
  for (const name of modelNames(read('docs/architecture/workspace.dsl'))) {
    const haystack = `${architecture} ${architectureTitle ?? ''}`.toLowerCase();
    if (!haystack.includes(name.toLowerCase())) {
      errors.push(`Architecture view is missing model element "${name}"`);
    }
  }

  const fromRuntime = runtimeCollections(
    read('packages/runtime/src/repositories.ts'),
    read('packages/runtime/src/checkpointer.ts'),
  );
  // The Phase 1 and Phase 2 data-model views together cover every collection.
  const fromDiagram = new Set([
    ...diagramCollections(read('docs/diagrams/data-model.svg')),
    ...diagramCollections(read('docs/diagrams/data-model-outreach.svg')),
  ]);
  for (const name of fromRuntime) {
    if (!fromDiagram.has(name))
      errors.push(`Data model is missing collection ${name}`);
  }
  for (const name of fromDiagram) {
    if (!fromRuntime.has(name))
      errors.push(`Data model shows unknown collection ${name}`);
  }

  const research = read('docs/research/military-com-intake-2026-10-24.md');
  if (!/ZIP/u.test(research) || !/parity/iu.test(research)) {
    errors.push(
      'Military.com research record lost its ZIP or parity statement',
    );
  }
  return errors;
}

function validateWorkspace() {
  const cli = process.env.LEADFLOW_STRUCTURIZR_CLI;
  if (!cli) {
    return ['LEADFLOW_STRUCTURIZR_CLI is unset; activate the toolchain first'];
  }
  // The pinned CLI uses a .bat launcher on Windows and a .sh launcher on macOS.
  // Both paths come from the project-local activation script.
  const options = {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  };
  const result =
    process.platform === 'win32'
      ? spawnSync(
          `"${cli}" validate -workspace docs/architecture/workspace.dsl`,
          { ...options, shell: true },
        )
      : spawnSync(
          cli,
          ['validate', '-workspace', 'docs/architecture/workspace.dsl'],
          options,
        );
  return result.status === 0
    ? []
    : [`Structurizr validation failed: ${result.stdout}${result.stderr}`];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = [...(await checkDocs()), ...validateWorkspace()];
  if (errors.length > 0) {
    for (const error of errors) console.error(`docs: ${error}`);
    process.exit(1);
  }
  console.log(
    'Docs verified: README links and figures, diagram freshness, model and schema drift, Structurizr.',
  );
}
