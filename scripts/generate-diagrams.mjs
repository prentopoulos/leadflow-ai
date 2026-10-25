import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Diagram, fonts, page, rgba, tokens } from './diagram-kit.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

function architecture() {
  const d = new Diagram({ slug: 'architecture', width: 960, height: 592 });
  d.zone({
    x: 16,
    y: 112,
    w: 704,
    h: 448,
    label: 'LOCAL WORKSTATION · LOOPBACK ONLY · SYNTHETIC DATA',
    dashed: true,
    labelX: 224,
  });
  d.zone({ x: 224, y: 148, w: 220, h: 388, label: 'API PROCESS · NODE 24' });

  d.path([
    [106, 80],
    [106, 184],
  ]);
  d.path(
    [
      [176, 212],
      [244, 212],
    ],
    { role: 'link' },
  );
  d.label('HTTP /V1', 210, 198);
  d.path(
    [
      [424, 212],
      [528, 212],
    ],
    { role: 'accent' },
  );
  d.label('INTAKE TXN', 476, 198, { role: 'accent' });
  d.path([
    [304, 240],
    [304, 320],
  ]);
  d.label('AFTER COMMIT', 348, 280);
  d.path([
    [364, 376],
    [364, 456],
  ]);
  d.label('SCORES', 394, 416);
  d.path([
    [424, 334],
    [608, 334],
    [608, 240],
  ]);
  d.label('CHECKPOINTS', 650, 287);
  d.path(
    [
      [424, 362],
      [760, 362],
    ],
    { dashed: true },
  );
  d.label('NOT ENABLED', 640, 376);
  d.path([
    [176, 484],
    [244, 484],
  ]);
  d.label('CHECKS', 210, 470);

  d.node({
    x: 36,
    y: 24,
    w: 140,
    kind: 'input',
    tag: 'PERSON',
    name: 'Operator',
    sub: 'fictional intake only',
  });
  d.node({
    x: 36,
    y: 184,
    w: 140,
    kind: 'backend',
    tag: 'WEB',
    name: 'Operator dossier',
    sub: 'React · Vite',
  });
  d.node({
    x: 244,
    y: 184,
    w: 180,
    kind: 'backend',
    tag: 'API',
    name: 'Fastify API',
    sub: '127.0.0.1:3001 · /v1',
  });
  d.node({
    x: 528,
    y: 184,
    w: 160,
    kind: 'focal',
    tag: 'STORE',
    name: 'Firestore Emulator',
    sub: '127.0.0.1:8080',
  });
  d.node({
    x: 244,
    y: 320,
    w: 180,
    kind: 'backend',
    tag: 'GRAPH',
    name: 'Qualification runtime',
    sub: 'LangGraph.js · leases',
  });
  d.node({
    x: 760,
    y: 308,
    w: 160,
    h: 80,
    kind: 'optional',
    tag: 'DEFERRED',
    name: 'Deferred services',
    sub: ['model provider', 'live enrichment', 'cloud · Auth'],
  });
  d.node({
    x: 36,
    y: 456,
    w: 140,
    kind: 'store',
    tag: 'CLI',
    name: 'Offline evaluator',
    sub: 'fixed synthetic cases',
  });
  d.node({
    x: 244,
    y: 456,
    w: 180,
    kind: 'backend',
    tag: 'RULES',
    name: 'Domain contracts',
    sub: 'rubric-v1 · simulator-v1',
  });

  return page({
    diagram: d,
    eyebrow: 'Architecture · Phase 1',
    title: 'LeadFlow AI local architecture',
    desc: 'An operator uses the dossier, which calls a loopback Fastify API; the API commits intake to the Firestore Emulator before the LangGraph runtime scores it with domain contracts, while model, enrichment, cloud and Auth services stay deferred outside the workstation boundary.',
    intro:
      'Everything inside the boundary runs on one workstation against synthetic data. The intake transaction commits before any workflow step runs.',
  });
}

function persistBeforeProcessing() {
  const d = new Diagram({
    slug: 'persist-before-processing',
    width: 960,
    height: 700,
  });
  const lane = { web: 120, api: 360, store: 600, graph: 840 };
  const top = 96;
  const bottom = 672;
  for (const x of Object.values(lane)) {
    d.under(
      `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${rgba(tokens.ink, 0.2)}" stroke-width="1" stroke-dasharray="3,3"/>`,
    );
  }
  const frame = { x: 556, y: 364, w: 328, h: 124 };
  d.under(
    [
      `<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="4" fill="${rgba(tokens.ink, 0.02)}" stroke="${rgba(tokens.ink, 0.22)}" stroke-width="1"/>`,
      `<rect x="${frame.x}" y="${frame.y}" width="40" height="16" rx="2" fill="${tokens.paper}" stroke="${rgba(tokens.ink, 0.22)}" stroke-width="1"/>`,
      `<text x="${frame.x + 20}" y="${frame.y + 12}" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.12em">LOOP</text>`,
      `<text x="${frame.x + 52}" y="${frame.y + 12}" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" letter-spacing="0.04em">[each graph step]</text>`,
    ].join('\n  '),
  );
  const bar = (x, y1, y2) =>
    d.under(
      `<rect x="${x - 4}" y="${y1}" width="8" height="${y2 - y1}" fill="${rgba(tokens.ink, 0.06)}" stroke="${tokens.muted}" stroke-width="0.8"/>`,
    );
  bar(lane.api, 132, 340);
  bar(lane.graph, 336, 524);
  bar(lane.api, 556, 644);

  const message = (from, to, y, text, options = {}) => {
    const direction = Math.sign(lane[to] - lane[from]);
    const start = lane[from] + direction * 4;
    const end = lane[to] - direction * 4;
    d.path(
      [
        [start, y],
        [end, y],
      ],
      options,
    );
    const centre = options.labelX ?? (start + end) / 2;
    d.label(text, centre, y - 14, {
      role: options.role === 'accent' ? 'accent' : 'soft',
    });
  };
  message('web', 'api', 136, 'POST INTAKE', { role: 'link' });
  message('api', 'store', 176, 'COMMIT INTAKE', { role: 'accent' });
  message('store', 'api', 216, 'COMMITTED', { dashed: true });
  message('api', 'web', 256, '202 ACCEPTED', { dashed: true });
  message('api', 'store', 296, 'CLAIM LEASE');
  message('api', 'graph', 336, 'INVOKE RUN', { labelX: 480 });
  message('graph', 'store', 412, 'CHECKPOINT');
  message('graph', 'store', 452, 'RUN EVENT');
  message('graph', 'store', 520, 'RUN COMPLETE');
  message('web', 'api', 560, 'POLL RUN', { role: 'link' });
  message('api', 'store', 600, 'READ RUN');
  message('api', 'web', 640, 'STORED DOSSIER', { dashed: true });

  d.callout(['four documents,', 'one transaction'], 616, 172);

  const actor = (key, tag, name, sub, kind = 'backend') =>
    d.node({ x: lane[key] - 80, y: 40, w: 160, kind, tag, name, sub });
  actor('web', 'WEB', 'Operator dossier', 'React · Vite');
  actor('api', 'API', 'Fastify API', 'loopback /v1');
  actor('store', 'STORE', 'Firestore Emulator', '127.0.0.1:8080', 'store');
  actor('graph', 'GRAPH', 'Qualification graph', 'LangGraph.js');

  return page({
    diagram: d,
    eyebrow: 'Sequence · Phase 1',
    title: 'Persist before processing',
    desc: 'The dossier posts intake, the API commits idempotency, lead, run and first event in one Firestore transaction and answers 202, and only then claims a lease and invokes the graph, which writes a checkpoint and event per step before the dossier polls the stored run.',
    intro:
      'No graph step runs until the intake transaction has committed. Each step then leaves a durable checkpoint and lifecycle event.',
  });
}

function runLifecycle() {
  const d = new Diagram({ slug: 'run-lifecycle', width: 960, height: 560 });
  d.zone({ x: 40, y: 48, w: 880, h: 148, label: 'PROGRESS' });
  d.zone({ x: 40, y: 276, w: 880, h: 100, label: 'RECOVERY' });
  d.zone({ x: 40, y: 436, w: 880, h: 100, label: 'STOPPED' });

  d.under(`<circle cx="72" cy="134" r="6" fill="${tokens.ink}"/>`);
  d.path([
    [78, 134],
    [100, 134],
  ]);
  d.path([
    [240, 134],
    [360, 134],
  ]);
  d.label('CLAIM', 300, 120);
  d.path([
    [400, 120],
    [400, 88],
    [460, 88],
    [460, 120],
  ]);
  d.label('LEASE RECLAIM', 430, 74);
  d.path([
    [500, 148],
    [740, 148],
  ]);
  d.label('FINALIZE', 620, 134);
  d.path([
    [360, 148],
    [280, 148],
    [280, 300],
  ]);
  d.label('FIRST FAULT', 238, 228);
  d.path([
    [320, 300],
    [320, 162],
    [360, 162],
  ]);
  d.label('RETRY ONCE', 360, 236);
  d.path([
    [430, 176],
    [430, 300],
  ]);
  d.label('STEP FAILS', 470, 270);
  d.path([
    [540, 328],
    [620, 328],
    [620, 460],
  ]);
  d.label('RETRYABLE', 578, 314);
  d.path([
    [450, 356],
    [450, 460],
  ]);
  d.label('NOT RETRYABLE', 402, 408);
  d.path(
    [
      [700, 460],
      [700, 240],
      [470, 240],
      [470, 176],
    ],
    { role: 'accent' },
  );
  d.label('RESUME', 585, 226, { role: 'accent' });

  const state = (x, y, w, name, status, kind = 'backend') =>
    d.node({ x, y, w, kind, tag: 'STATE', name, sub: `status: ${status}` });
  state(100, 120, 140, 'Persisted', 'persisted', 'store');
  state(360, 120, 140, 'Running', 'running');
  state(740, 120, 140, 'Complete', 'complete', 'store');
  state(200, 300, 140, 'Retrying', 'retrying');
  state(400, 300, 140, 'Partial', 'partial');
  state(380, 460, 160, 'Failed · terminal', 'failed_terminal', 'store');
  state(580, 460, 160, 'Failed · retryable', 'failed_retryable', 'focal');

  return page({
    diagram: d,
    eyebrow: 'State machine · Phase 1',
    title: 'Run lifecycle and recovery',
    desc: 'A persisted run is claimed into running, retries the first transient fault once, records partial then failed_retryable or failed_terminal when a step still fails, completes after finalize, and returns to running only through an expired-lease reclaim or an explicit operator resume of a retryable run.',
    intro:
      'Transitions shown are the ones the workflow commits. Resume requires the expected revision and a compatible stored checkpoint; complete and failed_terminal never resume.',
  });
}

function dataModel() {
  const d = new Diagram({
    slug: 'data-model',
    width: 960,
    height: 680,
    maxNodes: 8,
  });
  const entity = ({ x, y, name, paths, fields, kind = 'backend' }) => {
    const w = 240;
    const fieldTop = y + 34 + paths.length * 14;
    const h = Math.ceil((fieldTop - y + 8 + fields.length * 14 + 6) / 4) * 4;
    const stroke = kind === 'focal' ? tokens.accent : tokens.ink;
    const markup = [
      d.text(name, {
        x: x + 12,
        y: y + 20,
        size: 12,
        font: 'sans',
        fill: tokens.ink,
        weight: 600,
        room: w - 24,
      }),
      ...paths.map((value, index) =>
        d.text(value, {
          x: x + 12,
          y: y + 36 + index * 14,
          size: 9,
          font: 'mono',
          fill: tokens.muted,
          room: w - 24,
        }),
      ),
      `<line x1="${x}" y1="${fieldTop}" x2="${x + w}" y2="${fieldTop}" stroke="${stroke}" stroke-opacity="0.3" stroke-width="0.8"/>`,
      ...fields.map((value, index) =>
        d.text(value, {
          x: x + 12,
          y: fieldTop + 16 + index * 14,
          size: 9,
          font: 'mono',
          fill: tokens.ink,
          room: w - 24,
        }),
      ),
    ];
    d.box({ x, y, w, h, kind, markup, name });
    return { x, y, w, h, right: x + w, bottom: y + h };
  };

  const idempotency = entity({
    x: 40,
    y: 40,
    name: 'Idempotency record',
    paths: ['idempotency/{keyDigest}'],
    fields: ['# keyDigest', 'requestDigest', '→ leadId', '→ runId'],
  });
  const lead = entity({
    x: 360,
    y: 40,
    name: 'Lead',
    paths: ['leads/{leadId}'],
    fields: [
      '# leadId',
      'intake · fictional values',
      'provenance · ZIP only exact',
    ],
  });
  const bundle = entity({
    x: 680,
    y: 40,
    name: 'System bundle',
    paths: ['systemBundles/{systemBundleId}'],
    fields: [
      '# systemBundleId',
      'code · lockfile · fixture digests',
      'contract and tool versions',
    ],
  });
  const events = entity({
    x: 40,
    y: 260,
    name: 'Lifecycle event',
    paths: ['runs/{runId}/events/{eventId}'],
    fields: [
      '# eventId',
      'sequence · runRevision',
      'name · status · step',
      'safeError · durationMs',
    ],
  });
  const run = entity({
    x: 360,
    y: 260,
    name: 'Run',
    kind: 'focal',
    paths: ['runs/{runId}'],
    fields: [
      '# runId',
      '→ leadId · → systemBundleId',
      'status · revision · lease',
      'attempt · retryCount · step',
      '→ qualificationResultId',
      '→ simulationRecordId',
    ],
  });
  const result = entity({
    x: 680,
    y: 260,
    name: 'Qualification result',
    paths: ['qualificationResults/{resultId}'],
    fields: [
      '# resultId',
      '→ runId · → leadId',
      'rubric-v1 criteria · total',
      'priority · integrityHold',
    ],
  });
  const checkpoint = entity({
    x: 40,
    y: 480,
    name: 'Checkpoint tuple',
    paths: ['runs/{runId}/checkpoints', 'runs/{runId}/checkpointWrites'],
    fields: [
      '# sha-256 storage id',
      'checkpointId · parent',
      'taskId · writeIndex',
    ],
  });
  const simulation = entity({
    x: 680,
    y: 480,
    name: 'Simulation record',
    paths: ['simulationRecords/{id}'],
    fields: [
      '# simulationRecordId',
      '→ runId',
      'simulator-v1 seed',
      'outcome · not_live',
    ],
  });

  const line = (points) => d.path(points, { marker: false });
  line([
    [idempotency.right, 96],
    [lead.x, 96],
  ]);
  d.tag('1', idempotency.right + 10, 90);
  d.tag('1', lead.x - 10, 90, { anchor: 'end' });
  line([
    [160, idempotency.bottom],
    [160, 224],
    [420, 224],
    [420, run.y],
  ]);
  d.tag('1', 168, idempotency.bottom + 16);
  d.tag('1', 428, run.y - 8);
  line([
    [480, lead.bottom],
    [480, run.y],
  ]);
  d.tag('1', 488, lead.bottom + 16);
  d.tag('1', 488, run.y - 8);
  line([
    [760, bundle.bottom],
    [760, 224],
    [540, 224],
    [540, run.y],
  ]);
  d.tag('1', 768, bundle.bottom + 16);
  d.tag('N', 548, run.y - 8);
  line([
    [run.x, 320],
    [events.right, 320],
  ]);
  d.tag('1', run.x - 10, 314, { anchor: 'end' });
  d.tag('N', events.right + 10, 314);
  line([
    [run.right, 320],
    [result.x, 320],
  ]);
  d.tag('1', run.right + 10, 314);
  d.tag('0..1', result.x - 10, 314, { anchor: 'end' });
  line([
    [420, run.bottom],
    [420, 540],
    [checkpoint.right, 540],
  ]);
  d.tag('1', 428, run.bottom + 16);
  d.tag('N', checkpoint.right + 10, 534);
  line([
    [540, run.bottom],
    [540, 540],
    [simulation.x, 540],
  ]);
  d.tag('1', 548, run.bottom + 16);
  d.tag('0..1', simulation.x - 10, 534, { anchor: 'end' });

  d.callout(
    [
      'Every event, checkpoint, result and simulation record also carries systemBundleId.',
      'Fields are structure only; stored fixture values are fictional and never drawn here.',
    ],
    40,
    642,
  );

  return page({
    diagram: d,
    eyebrow: 'Data model · Phase 1',
    title: 'Firestore Emulator data model',
    desc: 'The run is the aggregate root: one idempotency record binds one lead and one run, a system bundle versions many runs, and each run owns many lifecycle events and checkpoint tuples plus at most one qualification result and one simulation record.',
    intro:
      'Collection paths match the runtime repositories and checkpointer. Cardinalities describe what the Phase 1 workflow writes.',
  });
}

/** README brand asset (not a technical diagram): the three product principles. */
function principles() {
  const d = new Diagram({ slug: 'principles', width: 960, height: 168 });
  const columns = [
    {
      x: 40,
      w: 300,
      eyebrow: '01 · INVARIANT',
      title: 'Persist before processing',
      lines: [
        'Intake, lead, run and first event',
        'commit before any workflow step.',
      ],
    },
    {
      x: 372,
      w: 280,
      eyebrow: '02 · SCORING',
      title: 'Deterministic rubric',
      lines: [
        'rubric-v1 arithmetic lives in',
        'code; prose cannot move a score.',
      ],
    },
    {
      x: 684,
      w: 236,
      eyebrow: '03 · EVIDENCE',
      title: 'Synthetic by design',
      lines: ['Fictional leads, a local', 'emulator and no live calls.'],
    },
  ];
  for (const [index, column] of columns.entries()) {
    if (index > 0) {
      d.under(
        `<line x1="${column.x - 16}" y1="32" x2="${column.x - 16}" y2="136" stroke="${rgba(tokens.ink, 0.16)}" stroke-width="0.8"/>`,
      );
    }
    d.under(
      [
        d.text(column.eyebrow, {
          x: column.x,
          y: 44,
          size: 8,
          font: 'mono',
          fill: index === 0 ? tokens.accent : tokens.soft,
          room: column.w,
        }),
        d.text(column.title, {
          x: column.x,
          y: 76,
          size: 20,
          font: 'title',
          fill: tokens.ink,
          room: column.w,
        }),
        ...column.lines.map((line, lineIndex) =>
          d.text(line, {
            x: column.x,
            y: 104 + lineIndex * 20,
            size: 13,
            font: 'sans',
            fill: tokens.muted,
            room: column.w,
          }),
        ),
      ].join('\n  '),
    );
  }
  return page({
    diagram: d,
    eyebrow: 'README · LeadFlow AI',
    title: 'LeadFlow AI principles',
    desc: 'Three principles: intake is persisted before processing, scoring is deterministic rubric-v1 code, and every lead, store and outcome is synthetic and local.',
    intro: 'Brand asset for the README opening.',
  });
}

export const diagrams = {
  architecture,
  'persist-before-processing': persistBeforeProcessing,
  'run-lifecycle': runLifecycle,
  'data-model': dataModel,
};

export const readmeAssets = { principles };

export function renderDiagrams() {
  return {
    ...Object.fromEntries(
      Object.entries(diagrams).map(([slug, render]) => [
        `docs/diagrams/${slug}.html`,
        render(),
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(readmeAssets).map(([slug, render]) => [
        `docs/readme/${slug}.html`,
        render(),
      ]),
    ),
  };
}

/** Export through the diagram-design skill's own helper, offline fonts. */
function exportSvg(htmlPath) {
  const python =
    process.env.LEADFLOW_PYTHON ??
    (process.platform === 'win32' ? 'py -3.13' : 'python3');
  const [command, ...prefix] = python.split(' ');
  const result = spawnSync(
    command,
    [
      ...prefix,
      path.join(
        repoRoot,
        '.agents/skills/diagram-design/scripts/export_svg.py',
      ),
      htmlPath,
      htmlPath.replace(/\.html$/u, '.svg'),
      '--system-fonts',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(`SVG export failed for ${htmlPath}: ${result.stderr}`);
  }
  const svgPath = htmlPath.replace(/\.html$/u, '.svg');
  writeFileSync(svgPath, readFileSync(svgPath, 'utf8').replace(/\r\n/gu, '\n'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [file, html] of Object.entries(renderDiagrams())) {
    const target = path.join(repoRoot, file);
    if (check) {
      let current;
      try {
        current = readFileSync(target, 'utf8');
      } catch {
        current = null;
      }
      if (current !== html) stale.push(file);
    } else {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, html);
      exportSvg(target);
      console.log(`wrote ${file} and its SVG export`);
    }
  }
  if (stale.length > 0) {
    console.error(
      `Diagram sources are stale: ${stale.join(', ')}. Run pnpm docs:diagrams.`,
    );
    process.exit(1);
  }
}
