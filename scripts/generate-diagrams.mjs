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
  d.label('RULES', 394, 416);
  d.path([
    [424, 334],
    [608, 334],
    [608, 240],
  ]);
  d.label('RECORDS', 650, 287);
  d.path([
    [424, 352],
    [760, 352],
  ]);
  d.label('READ-ONLY GET', 684, 338);
  d.path([
    [424, 368],
    [760, 368],
  ]);
  d.label('OPT-IN CALLS', 592, 384);
  d.path(
    [
      [424, 500],
      [760, 500],
    ],
    { dashed: true },
  );
  d.label('NOT ENABLED', 592, 514);
  d.path([
    [176, 484],
    [244, 484],
  ]);
  d.label('CHECKS', 210, 470);
  d.path([
    [106, 456],
    [106, 420],
    [214, 420],
    [214, 228],
    [244, 228],
  ]);
  d.label('SIM INTAKE', 150, 406);

  d.node({
    x: 36,
    y: 24,
    w: 140,
    kind: 'input',
    tag: 'PERSON',
    name: 'Operator',
    sub: 'fictional leads',
  });
  d.node({
    x: 36,
    y: 184,
    w: 140,
    kind: 'backend',
    tag: 'WEB',
    name: 'Operator dossier',
    sub: 'runs · metrics',
  });
  d.node({
    x: 244,
    y: 184,
    w: 180,
    kind: 'backend',
    tag: 'API',
    name: 'Fastify API',
    sub: '127.0.0.1:3001 · Host/Origin',
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
    name: 'Workflow runtime',
    sub: 'LangGraph.js · 7 nodes',
  });
  d.node({
    x: 760,
    y: 320,
    w: 160,
    h: 112,
    kind: 'input',
    tag: 'EXTERNAL',
    name: 'External services',
    sub: ['NHTSA vPIC', 'Zippopotam.us', 'Anthropic API', 'opt-in · capped'],
  });
  d.node({
    x: 760,
    y: 460,
    w: 160,
    h: 80,
    kind: 'optional',
    tag: 'DEFERRED',
    name: 'Deferred services',
    sub: ['hosted model calls', 'outreach sending', 'real personal data'],
  });
  d.node({
    x: 36,
    y: 456,
    w: 140,
    h: 80,
    kind: 'store',
    tag: 'CLI',
    name: 'Local tools',
    sub: ['Offline evaluator', 'Traffic simulator', 'SIMULATED leads'],
  });
  d.node({
    x: 244,
    y: 456,
    w: 180,
    kind: 'backend',
    tag: 'RULES',
    name: 'Domain contracts',
    sub: 'rubric · rules · spend',
  });

  return page({
    diagram: d,
    eyebrow: 'Architecture · local mode',
    title: 'LeadFlow AI local architecture',
    desc: 'An operator uses the dossier, which calls a loopback Fastify API that checks Host and Origin; the API commits intake to the Firestore Emulator before the seven-node LangGraph runtime scores, enriches through read-only GETs to NHTSA vPIC and Zippopotam.us, drafts and verifies with domain contracts, and, only when started with --agents, calls the Anthropic API for a capped research and drafting agent team, while a traffic simulator feeds fictional leads with simulated attribution through the same intake API, and hosted model calls, outreach sending and real personal data stay deferred; the private hosted topology has its own deployment view.',
    intro:
      'Everything inside the boundary runs on one workstation against synthetic data. Outbound calls are read-only GETs to the two authorized enrichment sources and, when the agent team is switched on, capped calls to the Anthropic API; nothing is ever sent.',
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
      'attribution · simulated, optional',
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

function reviewFlow() {
  const d = new Diagram({ slug: 'review-flow', width: 960, height: 600 });
  const row = { main: 120, branch: 280, end: 440 };
  const col = [40, 220, 400, 580, 760];

  const across = (from, to, label, options = {}) => {
    d.path(
      [
        [col[from] + 140, row.main + 28],
        [col[to], row.main + 28],
      ],
      options,
    );
    if (label) {
      d.label(label, (col[from] + 140 + col[to]) / 2, row.main + 14, {
        role: options.role === 'accent' ? 'accent' : 'soft',
      });
    }
  };
  across(0, 1);
  across(1, 2);
  across(2, 3);
  across(3, 4, 'PASS', { role: 'accent' });

  const down = (x, from, to, label, labelX = x + 44) => {
    d.path([
      [x, from],
      [x, to],
    ]);
    d.label(label, labelX, (from + to) / 2);
  };
  down(470, row.main + 56, row.branch, 'NO CONSENT', 424);
  down(620, row.main + 56, row.branch, 'RULE FAILS', 576);
  down(830, row.main + 56, row.branch, 'DECIDE', 870);
  down(830, row.branch + 56, row.end, 'APPROVED', 874);
  d.path(
    [
      [760, row.branch + 36],
      [690, row.branch + 36],
      [690, row.main + 56],
    ],
    { dashed: true },
  );
  d.label('NEW REVISION', 724, 228);

  const node = (x, y, kind, tag, name, sub) =>
    d.node({ x, y, w: 140, kind, tag, name, sub });
  node(col[0], row.main, 'backend', 'SCORE', 'Qualify', 'rubric-v1 · priority');
  node(col[1], row.main, 'backend', 'ENRICH', 'Enrich', 'vPIC · ZIP · email');
  node(
    col[2],
    row.main,
    'backend',
    'COMPOSE',
    'Compose draft',
    'template · slots',
  );
  node(col[3], row.main, 'backend', 'VERIFY', 'Verify', '8 rules');
  node(col[4], row.main, 'focal', 'QUEUE', 'Pending review', 'run complete');
  node(344, row.branch, 'optional', 'SKIP', 'No draft', 'no consent · held');
  node(
    548,
    row.branch,
    'optional',
    'HOLD',
    'Draft blocked',
    'not in the queue',
  );
  node(760, row.branch, 'input', 'OPERATOR', 'Human review', 'unauthenticated');
  node(760, row.end, 'store', 'RESULT', 'Manual use only', 'never sent');

  d.callout(
    [
      'An unavailable source still completes the run, flagged as partial evidence.',
      'Approval is bound to the revision digest; no product path sends email.',
    ],
    40,
    552,
  );

  return page({
    diagram: d,
    eyebrow: 'Flow · Phase 2',
    title: 'Enrichment to human review',
    desc: 'After scoring, the workflow enriches the lead, composes a template draft only with recorded consent, and verifies it against eight rules; a passing draft completes the run in pending review, a failing one is held, and a human approves, rejects or edits it as a new revision, after which an approved draft is for manual use only and is never sent.',
    intro:
      'Every branch is stored: skipped drafts, blocked drafts and each revision and decision remain inspectable in the run dossier.',
  });
}

function phaseTwoRecords() {
  const d = new Diagram({
    slug: 'data-model-outreach',
    width: 960,
    height: 700,
    maxNodes: 7,
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

  const evidence = entity({
    x: 40,
    y: 40,
    name: 'Enrichment evidence',
    paths: ['enrichmentEvidence/{evidenceId}'],
    fields: [
      '# evidenceId · → runId',
      'source · subject · outcome',
      'live | recorded | mock',
      'rawBody ≤ 64 KiB · sha256',
    ],
  });
  const run = entity({
    x: 360,
    y: 40,
    name: 'Run',
    kind: 'focal',
    paths: ['runs/{runId}'],
    fields: [
      '# runId',
      '→ enrichmentEvidenceIds',
      '→ emailCheckId',
      '→ draftId · draftSkipReason',
      '→ verificationResultId',
      'evidenceCompleteness · holds',
    ],
  });
  const email = entity({
    x: 680,
    y: 40,
    name: 'Email check',
    paths: ['emailChecks/{emailCheckId}'],
    fields: [
      '# emailCheckId · → runId',
      'reserved test domain',
      'local check only',
    ],
  });
  const verification = entity({
    x: 40,
    y: 280,
    name: 'Verification result',
    paths: ['verificationResults/{id}'],
    fields: [
      '# verificationResultId',
      'scope · → revisionId',
      '8 rule outcomes',
      'draftPassed · integrityPassed',
    ],
  });
  const revision = entity({
    x: 360,
    y: 280,
    name: 'Draft revision',
    paths: ['outreachDrafts/{draftId}', '/revisions/{revisionId}'],
    fields: [
      '# revisionId · revisionNumber',
      'origin · subject · body',
      'slots · followUpAction',
      'contentSha256 · → verification',
    ],
  });
  const review = entity({
    x: 680,
    y: 280,
    name: 'Draft review',
    paths: ['outreachDrafts/{draftId}', '/reviews/{reviewId}'],
    fields: [
      '# reviewId · → revisionId',
      'contentSha256',
      'approved | rejected',
      'local-operator · unauthenticated',
    ],
  });

  const brief = entity({
    x: 360,
    y: 464,
    name: 'Agent brief',
    paths: ['agentBriefs/{briefId}'],
    fields: [
      '# briefId · → runId',
      'drafted | fallback · reason',
      'claims: url · quote',
      'paragraph · → claimIds',
      'calls · totalCostMicros',
    ],
  });

  const line = (points) => d.path(points, { marker: false });
  line([
    [run.x, 100],
    [evidence.right, 100],
  ]);
  d.tag('1', run.x - 10, 94, { anchor: 'end' });
  d.tag('0..2', evidence.right + 10, 94);
  line([
    [run.right, 100],
    [email.x, 100],
  ]);
  d.tag('1', run.right + 10, 94);
  d.tag('0..1', email.x - 10, 94, { anchor: 'end' });
  line([
    [480, run.bottom],
    [480, revision.y],
  ]);
  d.tag('1', 488, run.bottom + 16);
  d.tag('N', 488, revision.y - 8);
  line([
    [400, run.bottom],
    [400, 244],
    [160, 244],
    [160, verification.y],
  ]);
  d.tag('1', 408, run.bottom + 16);
  d.tag('0..1', 168, verification.y - 8);
  line([
    [revision.x, 340],
    [verification.right, 340],
  ]);
  d.tag('1', revision.x - 10, 334, { anchor: 'end' });
  d.tag('1', verification.right + 10, 334);
  line([
    [revision.right, 340],
    [review.x, 340],
  ]);
  d.tag('1', revision.right + 10, 334);
  d.tag('0..1', review.x - 10, 334, { anchor: 'end' });
  line([
    [480, revision.bottom],
    [480, brief.y],
  ]);
  d.tag('N', 488, revision.bottom + 16);
  d.tag('0..1', 488, brief.y - 8);

  d.callout(
    [
      'Revisions and reviews are append-only; earlier evidence and revisions stay stored, unlinked.',
      'Fields are structure only; stored fixture values are fictional and never drawn here.',
      'An agent brief exists only for local --agents runs; a draft revision links it by briefId, and a drafted paragraph also cites it from its slot.',
    ],
    40,
    636,
  );

  return page({
    diagram: d,
    eyebrow: 'Data model · Phase 5',
    title: 'Enrichment, draft and review records',
    desc: 'A run links up to two enrichment evidence records, one email check, one run-level verification result and one draft whose immutable revisions each carry a content digest, their own verification result and at most one append-only human review; a local agent run links one stored brief holding its claims, sources and per-call costs even when the draft falls back to the template.',
    intro:
      'Collection paths match the runtime repositories. The run links only the current evidence and draft; superseded records remain for audit.',
  });
}

/** README brand asset (not a technical diagram): the three product principles. */
function agentArchitecture() {
  const d = new Diagram({
    slug: 'agent-architecture',
    width: 960,
    height: 448,
  });
  const top = { y: 40, h: 64 };
  const agent = { y: 208, w: 184, h: 64 };
  const col = [40, 264, 488, 712];
  const centre = (index) => col[index] + agent.w / 2;
  const bus = 156;

  d.path([
    [208, 72],
    [352, 72],
  ]);
  d.label('AFTER COMMIT', 280, 58);
  d.path(
    [
      [608, 64],
      [752, 64],
    ],
    { role: 'accent' },
  );
  d.label('PASSING DRAFT', 680, 50, { role: 'accent' });
  d.path(
    [
      [752, 88],
      [608, 88],
    ],
    { dashed: true },
  );
  d.label('RESUME', 680, 102);

  d.path(
    [
      [480, top.y + top.h],
      [480, bus],
    ],
    { marker: false },
  );
  d.label('IN ORDER 1–4', 532, 130);
  d.path(
    [
      [centre(0), bus],
      [centre(3), bus],
    ],
    { marker: false },
  );
  col.forEach((_, index) =>
    d.path([
      [centre(index), bus],
      [centre(index), agent.y],
    ]),
  );
  d.path(
    [
      [centre(1), agent.y + agent.h],
      [centre(1), 352],
    ],
    { role: 'link' },
  );
  d.label('READ-ONLY GET', centre(1) + 44, 312);
  d.path(
    [
      [centre(2), agent.y + agent.h],
      [centre(2), 352],
    ],
    { role: 'link' },
  );
  d.label('OPT-IN CALLS', centre(2) + 48, 312);

  d.node({
    x: 40,
    y: top.y,
    w: 168,
    h: top.h,
    kind: 'backend',
    tag: 'API',
    name: 'Intake API',
    sub: 'persist · claim lease',
  });
  d.node({
    x: 352,
    y: top.y,
    w: 256,
    h: top.h,
    kind: 'focal',
    tag: 'ORCHESTRATOR',
    name: 'LangGraph orchestrator',
    sub: 'StateGraph · Firestore checkpoints',
  });
  d.node({
    x: 752,
    y: top.y,
    w: 168,
    h: top.h,
    kind: 'input',
    tag: 'PERSON',
    name: 'Human review',
    sub: 'approve · reject · edit',
  });
  [
    ['1 · AGENT', 'Qualification agent', 'interpret · rubric-v1 score'],
    ['2 · AGENT', 'Enrichment agent', 'vehicle · ZIP · email tools'],
    ['3 · AGENT', 'Outreach agent', 'template + agent team'],
    ['4 · GUARD', 'Verifier', '8 rules · block or pass'],
  ].forEach(([tag, name, sub], index) =>
    d.node({ x: col[index], ...agent, kind: 'backend', tag, name, sub }),
  );
  d.node({
    x: 264,
    y: 352,
    w: 184,
    h: 56,
    kind: 'external',
    tag: 'EXTERNAL',
    name: 'Public sources',
    sub: 'NHTSA vPIC · Zippopotam.us',
  });
  d.node({
    x: 488,
    y: 352,
    w: 184,
    h: 56,
    kind: 'external',
    tag: 'EXTERNAL',
    name: 'Anthropic API',
    sub: 'research · writer · critic',
  });

  return page({
    diagram: d,
    eyebrow: 'Agent architecture · Phase 5',
    title: 'Orchestrator and specialist agents',
    desc: 'After the intake API commits a lead, a LangGraph orchestrator dispatches in order to a qualification agent, an enrichment agent that calls NHTSA vPIC and Zippopotam.us read-only, an outreach agent that writes a consent-gated template draft and, when switched on, adds a cited paragraph from a capped Anthropic research and drafting team, and a verifier guard; it checkpoints each step in Firestore, sends a passing draft to human review, and resumes a stopped run from its checkpoint.',
    intro: '',
  });
}

/** Phase 5 agent team inside compose_draft: research, verify, draft, review. */
function agentTeam() {
  const d = new Diagram({ slug: 'agent-team', width: 960, height: 480 });
  const row = { a: 96, b: 272, h: 64 };
  const col = [24, 212, 400, 588, 776];
  const w = 160;

  const step = (from, to, y, label) => {
    d.path([
      [col[from] + w, y],
      [col[to], y],
    ]);
    if (label !== undefined) d.label(label, col[to] - 14, 64);
  };
  step(0, 1, 128, 'QUESTIONS');
  step(1, 2, 128, 'CITED ANSWERS');
  step(2, 3, 128, 'KEPT CLAIMS');
  step(3, 4, 128, 'BRIEF');
  d.path([
    [856, row.a + row.h],
    [856, row.b],
  ]);
  d.label('PARAGRAPH', 900, 216);
  d.path([
    [col[4], 304],
    [col[3] + w, 304],
  ]);
  d.path([
    [col[3], 304],
    [col[2] + w, 304],
  ]);
  d.path(
    [
      [col[2], 304],
      [col[1] + w, 304],
    ],
    { role: 'accent' },
  );
  d.label('APPROVED', 386, 352, { role: 'accent' });
  d.path(
    [
      [668, row.b + row.h],
      [668, 384],
      [948, 384],
      [948, 128],
      [936, 128],
    ],
    { dashed: true },
  );
  d.label('≤ 2 REWRITES', 808, 400);

  d.node({
    x: col[0],
    y: row.a,
    w,
    h: row.h,
    kind: 'backend',
    tag: 'LEAD · SONNET 5.5',
    name: 'Plan research',
    sub: '1–3 questions per topic',
  });
  d.node({
    x: col[1],
    y: 88,
    w,
    h: 80,
    kind: 'backend',
    tag: '3 WORKERS · HAIKU 5.5',
    name: 'Web search',
    sub: ['vehicle · area · coverage', 'in parallel', 'cited answers only'],
  });
  d.node({
    x: col[2],
    y: row.a,
    w,
    h: row.h,
    kind: 'focal',
    tag: 'CODE',
    name: 'Claim verifier',
    sub: 'quote carries numbers',
  });
  d.node({
    x: col[3],
    y: row.a,
    w,
    h: row.h,
    kind: 'backend',
    tag: 'LEAD · SONNET 5.5',
    name: 'Merge brief',
    sub: 'kept claims only',
  });
  d.node({
    x: col[4],
    y: row.a,
    w,
    h: row.h,
    kind: 'backend',
    tag: 'WRITER · SONNET 5.5',
    name: 'Draft paragraph',
    sub: 'cites claim IDs',
  });
  d.node({
    x: col[4],
    y: row.b,
    w,
    h: row.h,
    kind: 'backend',
    tag: 'CODE',
    name: 'Rule checker',
    sub: 'numbers · words · links',
  });
  d.node({
    x: col[3],
    y: row.b,
    w,
    h: row.h,
    kind: 'backend',
    tag: 'CRITIC · SONNET 5.5',
    name: 'Review paragraph',
    sub: 'approve or list issues',
  });
  d.node({
    x: col[2],
    y: row.b,
    w,
    h: row.h,
    kind: 'backend',
    tag: 'GUARD',
    name: 'Template + 8 rules',
    sub: 'agent_brief slot',
  });
  d.node({
    x: col[1],
    y: row.b,
    w,
    h: row.h,
    kind: 'input',
    tag: 'PERSON',
    name: 'Human review',
    sub: 'nothing is sent',
  });

  d.callout(
    [
      'Models see the vehicle, area and coded answers only: never the name, email, ZIP or request text.',
      'Spend is reserved before each call ($0.30 per lead, $8 per process); any failure keeps the template draft.',
    ],
    24,
    432,
  );

  return page({
    diagram: d,
    eyebrow: 'Agent team · Phase 5',
    title: 'Research and drafting agent team',
    desc: 'Inside the compose step, a Sonnet 5.5 lead plans questions, three Haiku 5.5 workers search the web in parallel, code keeps only claims whose quoted source carries their numbers and words, the lead merges kept claims into a brief, a Sonnet 5.5 writer drafts one cited paragraph that a code rule checker and a Sonnet 5.5 critic review with at most two rewrites, and the approved paragraph joins the template draft that the eight verification rules check before human review.',
    intro:
      'Off by default. Every call is capped and recorded; a failed check, model error or spend stop keeps the plain template draft.',
  });
}

/** Phase 3 deployment view: where the private hosted proof of concept runs. */
function privateCloud() {
  const d = new Diagram({ slug: 'private-cloud', width: 960, height: 600 });
  d.zone({
    x: 16,
    y: 112,
    w: 928,
    h: 472,
    label: 'GOOGLE CLOUD PROJECT · OWNER ONLY · NORTHAMERICA-NORTHEAST2',
    dashed: true,
    labelX: 236,
  });
  d.zone({
    x: 284,
    y: 148,
    w: 256,
    h: 140,
    label: 'CLOUD RUN · MAX 1 · MIN 0',
  });

  d.path(
    [
      [126, 80],
      [126, 184],
    ],
    { role: 'link' },
  );
  d.label('HTTPS SIGN-IN', 178, 132);
  d.path(
    [
      [216, 224],
      [304, 224],
    ],
    { role: 'accent' },
  );
  d.label('SIGNED JWT', 260, 210, { role: 'accent' });
  d.path([
    [520, 224],
    [620, 224],
  ]);
  d.label('ADC RUNTIME SA', 570, 210);
  d.path([
    [216, 476],
    [304, 476],
  ]);
  d.label('PUSH', 260, 462);
  d.path([
    [412, 436],
    [412, 264],
  ]);
  d.label('DEPLOY DIGEST', 464, 356);
  d.path(
    [
      [500, 264],
      [500, 316],
      [720, 316],
      [720, 436],
    ],
    { dashed: true },
  );
  d.label('REQUEST LOGS', 616, 302);

  d.node({
    x: 36,
    y: 24,
    w: 180,
    kind: 'input',
    tag: 'PERSON',
    name: 'Owner browser',
    sub: 'Google account sign-in',
  });
  d.node({
    x: 36,
    y: 184,
    w: 180,
    h: 80,
    kind: 'backend',
    tag: 'MANAGED',
    name: 'Identity-Aware Proxy',
    sub: ['direct IAP on the service', 'sole invoker: IAP agent'],
  });
  d.node({
    x: 304,
    y: 184,
    w: 216,
    h: 80,
    kind: 'focal',
    tag: 'CONTAINER',
    name: 'leadflow-ai-demo',
    sub: ['web build + /v1 API · :8080', 'JWT + subject allowlist'],
  });
  d.node({
    x: 620,
    y: 184,
    w: 204,
    h: 80,
    kind: 'store',
    tag: 'MANAGED',
    name: 'Firestore (default)',
    sub: ['Standard · Native', 'deny-all rules · 7-day TTL'],
  });
  d.node({
    x: 36,
    y: 436,
    w: 180,
    h: 80,
    kind: 'backend',
    tag: 'BUILD',
    name: 'Cloud Build',
    sub: ['source-less · exact SHA', 'Cloud Logging only'],
  });
  d.node({
    x: 304,
    y: 436,
    w: 216,
    h: 80,
    kind: 'store',
    tag: 'MANAGED',
    name: 'Artifact Registry',
    sub: ['leadflow-ai-demo/app', 'pinned by sha256 digest'],
  });
  d.node({
    x: 620,
    y: 436,
    w: 204,
    h: 80,
    kind: 'external',
    tag: 'PLATFORM',
    name: 'Logging · Monitoring',
    sub: ['status · latency · revision', 'no contact values'],
  });

  d.callout(['no public invoker,', 'no key file'], 620, 140);
  d.callout(['CA$10 cap · alert budget;', 'torn down by day 7'], 620, 548);

  return page({
    diagram: d,
    eyebrow: 'Deployment · Phase 3',
    title: 'LeadFlow AI private cloud',
    desc: 'The owner signs in through direct Identity-Aware Proxy, which forwards a signed assertion to the single Cloud Run container; the container checks the assertion and subject allowlist, serves the web build and API, and reads and writes the Toronto Firestore Standard database through its runtime identity. Cloud Build builds one exact commit without source upload and pushes it to Artifact Registry, whose digest is deployed; request logs and metrics go to the platform.',
    intro:
      'One private service for one owner. The IAP service agent is the only invoker, the runtime uses Application Default Credentials, and enrichment is recorded-only.',
  });
}

/** Phase 3 sequence: hosted work happens inside the held execution request. */
function hostedExecution() {
  const d = new Diagram({
    slug: 'hosted-execution',
    width: 960,
    height: 700,
    maxArrows: 12,
  });
  const lane = { web: 120, api: 360, store: 600, graph: 840 };
  const top = 96;
  const bottom = 672;
  for (const x of Object.values(lane)) {
    d.under(
      `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${rgba(tokens.ink, 0.2)}" stroke-width="1" stroke-dasharray="3,3"/>`,
    );
  }
  const frame = { x: 76, y: 424, w: 328, h: 112 };
  d.under(
    [
      `<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="4" fill="${rgba(tokens.ink, 0.02)}" stroke="${rgba(tokens.ink, 0.22)}" stroke-width="1"/>`,
      `<rect x="${frame.x}" y="${frame.y}" width="40" height="16" rx="2" fill="${tokens.paper}" stroke="${rgba(tokens.ink, 0.22)}" stroke-width="1"/>`,
      `<text x="${frame.x + 20}" y="${frame.y + 12}" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.12em">PAR</text>`,
      `<text x="${frame.x + 52}" y="${frame.y + 12}" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" letter-spacing="0.04em">[while the request is held]</text>`,
    ].join('\n  '),
  );
  const bar = (x, y1, y2) =>
    d.under(
      `<rect x="${x - 4}" y="${y1}" width="8" height="${y2 - y1}" fill="${rgba(tokens.ink, 0.06)}" stroke="${tokens.muted}" stroke-width="0.8"/>`,
    );
  bar(lane.api, 132, 220);
  bar(lane.api, 252, 644);
  bar(lane.graph, 332, 600);

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
  message('api', 'web', 216, '202 · NO WORK', { dashed: true });
  message('web', 'api', 256, 'POST EXECUTE', { role: 'link' });
  message('api', 'store', 296, 'CLAIM 75 S', {});
  message('api', 'graph', 336, 'INVOKE ≤ 45 S', { labelX: 480 });
  message('graph', 'store', 400, 'CHECKPOINT');
  message('web', 'api', 464, 'POLL EVERY 3 S', { role: 'link' });
  message('api', 'web', 512, 'STORED RUN', { dashed: true });
  message('graph', 'store', 576, 'RUN RESULT');
  message('graph', 'api', 600, 'STOPPED', { dashed: true, labelX: 720 });
  message('api', 'web', 640, '200 · OR 504', { dashed: true });

  d.callout(
    ['a deadline leaves a leased run;', 'resume reclaims it'],
    440,
    680,
  );

  const actor = (key, tag, name, sub, kind = 'backend') =>
    d.node({ x: lane[key] - 80, y: 40, w: 160, kind, tag, name, sub });
  actor('web', 'WEB', 'Owner browser', 'behind IAP');
  actor('api', 'API', 'Cloud Run API', 'IAP-verified /v1');
  actor('store', 'STORE', 'Firestore', 'Toronto · TTL', 'store');
  actor('graph', 'GRAPH', 'Qualification graph', 'recorded lookups');

  return page({
    diagram: d,
    eyebrow: 'Sequence · Phase 3',
    title: 'Request-bound hosted execution',
    desc: 'The browser posts intake and the API commits it to Firestore and answers 202 without starting work; the browser then posts a separate authenticated execution request, which claims a 75-second lease and invokes the graph under a 45-second deadline while the browser polls stored run state every three seconds; the graph writes checkpoints and results, and the held request answers 200 when it finishes or 504 at the deadline, leaving a leased run that resume later reclaims.',
    intro:
      'Cloud Run bills and runs CPU only while a request is open, so hosted work happens inside the execution request; polling only ever reads stored state.',
  });
}

/** Phase 3 data lifecycle: expiry, purge and the teardown schedule. */
function hostedLifecycle() {
  const d = new Diagram({ slug: 'hosted-lifecycle', width: 960, height: 620 });
  d.zone({
    x: 16,
    y: 64,
    w: 928,
    h: 248,
    label: 'SYNTHETIC HOSTED DATA · SEVEN-DAY RETENTION',
  });
  d.zone({
    x: 16,
    y: 336,
    w: 928,
    h: 268,
    label: 'TEARDOWN · AFTER THE OWNER APPROVES EVIDENCE',
  });

  d.path(
    [
      [236, 128],
      [340, 128],
    ],
    { role: 'accent' },
  );
  d.label('EXPIRESAT +7D', 288, 114, { role: 'accent' });
  d.path([
    [540, 128],
    [644, 128],
  ]);
  d.label('≤ 24 H LATER', 592, 114);
  d.path(
    [
      [136, 156],
      [136, 248],
      [340, 248],
    ],
    { dashed: true },
  );
  d.label('OWNER CONFIRMS', 248, 234);
  d.path([
    [236, 424],
    [340, 424],
  ]);
  d.label('BY DAY 7', 288, 410);
  d.path([
    [540, 424],
    [644, 424],
  ]);
  d.label('DAY 30', 592, 410);
  d.path([
    [440, 464],
    [440, 516],
  ]);
  d.label('REMAINS', 488, 490);

  d.node({
    x: 36,
    y: 100,
    w: 200,
    kind: 'focal',
    tag: 'WRITE',
    name: 'Hosted document',
    sub: 'Timestamp expiresAt',
  });
  d.node({
    x: 340,
    y: 100,
    w: 200,
    kind: 'store',
    tag: 'TTL',
    name: 'Firestore TTL policy',
    sub: 'one per collection group',
  });
  d.node({
    x: 644,
    y: 100,
    w: 240,
    kind: 'external',
    tag: 'DELETED',
    name: 'Expired document gone',
    sub: 'eventual; billed as deletes',
  });
  d.node({
    x: 340,
    y: 220,
    w: 200,
    kind: 'optional',
    tag: 'PURGE',
    name: 'Guarded purge',
    sub: 'exact project · database',
  });
  d.node({
    x: 36,
    y: 396,
    w: 200,
    kind: 'input',
    tag: 'OWNER',
    name: 'Evidence approved',
    sub: 'walkthrough reviewed',
  });
  d.node({
    x: 340,
    y: 384,
    w: 200,
    h: 80,
    kind: 'backend',
    tag: 'DAY 7',
    name: 'Service teardown',
    sub: ['service · data · IAM', 'non-final images'],
  });
  d.node({
    x: 644,
    y: 384,
    w: 240,
    h: 80,
    kind: 'backend',
    tag: 'DAY 30',
    name: 'Image teardown',
    sub: ['final image + repository', 'unless the owner extends'],
  });
  d.node({
    x: 340,
    y: 516,
    w: 200,
    h: 68,
    kind: 'store',
    tag: 'KEPT',
    name: 'Empty Toronto database',
    sub: 'sanitized repo evidence',
  });

  d.callout(['rebuild, not rollback,', 'after day 30'], 644, 532);

  return page({
    diagram: d,
    eyebrow: 'Data lifecycle · Phase 3',
    title: 'Hosted retention and teardown',
    desc: 'Every hosted document carries a Timestamp expiresAt seven days ahead; a Firestore TTL policy per collection group removes expired documents eventually, usually within a further 24 hours, and an owner-confirmed purge limited to the exact project and database can remove synthetic data at once. After the owner approves the evidence, the service, data, access and non-final images are removed by day 7, the final image and repository by day 30, and the empty Toronto database and sanitized repository evidence remain; after day 30 the release is rebuilt rather than rolled back.',
    intro:
      'Retention is a property of every write, not a cleanup job. Purge is deliberate, guarded and unrecoverable; teardown runs against reverified exact resource names.',
  });
}

function explodedSystem() {
  const d = new Diagram({
    slug: 'exploded-system',
    width: 960,
    height: 612,
    maxNodes: 0,
    maxArrows: 0,
  });
  const origin = { x: 332, y: 408 };
  const rect = { x0: 0, y0: 0, x1: 176, y1: 120 };
  const gap = 92;
  const iso = (x, y, z) => [origin.x + x - y, origin.y + (x + y) / 2 - z];
  const point = ([x, y]) => `${x},${y}`;
  const polygon = (points) => points.map(point).join(' ');
  const layers = [
    {
      key: 'evidence',
      name: 'Evidence foundation',
      sub: 'stored lead · source records',
      z: 0,
      t: 20,
      focal: false,
    },
    {
      key: 'rules',
      name: 'Deterministic controls',
      sub: 'rubric · consent · verifier',
      z: 112,
      t: 16,
      focal: true,
    },
    {
      key: 'workflow',
      name: 'Bounded workflow',
      sub: 'qualify · enrich · draft',
      z: 220,
      t: 16,
      focal: false,
    },
    {
      key: 'workspace',
      name: 'Operator workspace',
      sub: 'intake · runs · review',
      z: 328,
      t: 12,
      focal: false,
    },
  ];

  const [traceLeftX, traceLeftY] = iso(rect.x0, rect.y1, 0);
  const [traceRightX, traceRightY] = iso(rect.x1, rect.y0, 0);
  const [, traceTopLeftY] = iso(rect.x0, rect.y1, layers.at(-1).z);
  const [, traceTopRightY] = iso(rect.x1, rect.y0, layers.at(-1).z);
  const markup = [
    `<g data-exploded data-origin="${origin.x} ${origin.y}" data-gap="${gap}">`,
    `<line data-role="trace" x1="${traceLeftX}" y1="${traceLeftY + 20}" x2="${traceLeftX}" y2="${traceTopLeftY}" stroke="${rgba(tokens.ink, 0.3)}" stroke-width="0.8" stroke-dasharray="4,3"/>`,
    `<line data-role="trace" x1="${traceRightX}" y1="${traceRightY + 20}" x2="${traceRightX}" y2="${traceTopRightY}" stroke="${rgba(tokens.ink, 0.3)}" stroke-width="0.8" stroke-dasharray="4,3"/>`,
  ];
  for (const [level, layer] of layers.entries()) {
    const a = iso(rect.x0, rect.y0, layer.z);
    const b = iso(rect.x1, rect.y0, layer.z);
    const c = iso(rect.x1, rect.y1, layer.z);
    const e = iso(rect.x0, rect.y1, layer.z);
    const cb = [c[0], c[1] + layer.t];
    const eb = [e[0], e[1] + layer.t];
    const topFill = layer.focal ? rgba(tokens.accent, 0.1) : tokens.white;
    const leftFill = layer.focal
      ? rgba(tokens.accent, 0.2)
      : rgba(tokens.ink, 0.07);
    const rightFill = layer.focal
      ? rgba(tokens.accent, 0.32)
      : rgba(tokens.ink, 0.15);
    const stroke = layer.focal ? tokens.accent : tokens.ink;
    const leaderY = b[1] + layer.t / 2;
    const detailA = iso(36, 36, layer.z - 0.5);
    const detailB = iso(140, 36, layer.z - 0.5);
    const detailC = iso(140, 84, layer.z - 0.5);
    const detailD = iso(36, 84, layer.z - 0.5);
    markup.push(
      `<g data-part="${layer.key}" data-name="${layer.name}" data-rect="${rect.x0} ${rect.y0} ${rect.x1} ${rect.y1} 0" data-z="${layer.z}" data-t="${layer.t}" data-level="${level}"${layer.focal ? ' data-focal' : ''}>`,
      `<path data-role="silhouette" d="M ${point(e)} L ${point(a)} L ${point(b)} L ${point(c)} L ${point(cb)} L ${point(eb)} Z" fill="${tokens.white}"/>`,
      `<polygon points="${polygon([a, b, c, e])}" fill="${topFill}"/>`,
      `<polygon points="${polygon([e, c, cb, eb])}" fill="${leftFill}"/>`,
      `<polygon points="${polygon([b, c, cb])}" fill="${rightFill}"/>`,
      `<path d="M ${point(e)} L ${point(a)} L ${point(b)} L ${point(c)} L ${point(cb)} L ${point(eb)} Z" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`,
      `<polygon points="${polygon([detailA, detailB, detailC, detailD])}" fill="none" stroke="${layer.focal ? rgba(tokens.accent, 0.7) : rgba(tokens.ink, 0.48)}" stroke-width="0.8"/>`,
      `<g data-role="label"><line data-role="leader" x1="${b[0] + 6}" y1="${leaderY}" x2="568" y2="${leaderY}" stroke="${layer.focal ? rgba(tokens.accent, 0.65) : rgba(tokens.ink, 0.4)}" stroke-width="0.8"/><circle cx="${b[0]}" cy="${leaderY}" r="2" fill="${layer.focal ? tokens.accent : tokens.ink}"/><text data-role="name" x="580" y="${leaderY - 1}" fill="${tokens.ink}" font-size="16" font-weight="600" font-family="${fonts.sans}">${layer.name}</text><text x="580" y="${leaderY + 15}" fill="${layer.focal ? tokens.accent : tokens.muted}" font-size="10" font-family="${fonts.mono}" letter-spacing="0.04em">${layer.sub}</text></g>`,
      `</g>`,
    );
  }
  markup.push('</g>');
  d.under(markup.join('\n  '));

  return page({
    diagram: d,
    eyebrow: 'Exploded system · product layers',
    title: 'What makes one LeadFlow run',
    desc: 'Exploded axonometric view of four LeadFlow AI layers: stored evidence at the base, deterministic scoring consent and verification controls, a bounded qualification enrichment drafting workflow, and the operator workspace for intake runs and review.',
    intro:
      'Four layers form one product. Deterministic controls remain between stored evidence and every agent-produced draft.',
  });
}

function securityTrifecta() {
  const d = new Diagram({
    slug: 'security-trifecta',
    width: 1000,
    height: 496,
    maxNodes: 0,
    maxArrows: 0,
  });
  const markup = [
    `<text x="40" y="48" fill="${tokens.ink}" font-size="28" font-family="${fonts.title}">No run gets all three capabilities</text>`,
    `<text x="40" y="72" fill="${tokens.muted}" font-size="12" font-family="${fonts.sans}">Current modes accept bounded fictional input without combining it with real personal data and an outbound channel.</text>`,
    `<text x="40" y="116" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" letter-spacing="0.14em">SECURITY TRIFECTA / VENN VIEW</text>`,
    `<circle cx="180" cy="224" r="104" fill="${rgba(tokens.link, 0.08)}" stroke="${tokens.link}" stroke-width="1.2"/>`,
    `<circle cx="116" cy="324" r="104" fill="${rgba(tokens.muted, 0.05)}" stroke="${rgba(tokens.muted, 0.62)}" stroke-width="1.2"/>`,
    `<circle cx="244" cy="324" r="104" fill="${rgba(tokens.white, 0.76)}" stroke="${tokens.ink}" stroke-width="1.2"/>`,
    `<text x="180" y="166" fill="${tokens.ink}" font-size="12" font-weight="600" font-family="${fonts.sans}" text-anchor="middle">Untrusted input</text>`,
    `<text x="180" y="183" fill="${tokens.muted}" font-size="9" font-family="${fonts.mono}" text-anchor="middle">bounded fictional leads</text>`,
    `<text x="82" y="352" fill="${tokens.ink}" font-size="12" font-weight="600" font-family="${fonts.sans}" text-anchor="middle">Sensitive data</text>`,
    `<text x="82" y="369" fill="${tokens.muted}" font-size="9" font-family="${fonts.mono}" text-anchor="middle">real data gated</text>`,
    `<text x="278" y="352" fill="${tokens.ink}" font-size="12" font-weight="600" font-family="${fonts.sans}" text-anchor="middle">Way out</text>`,
    `<text x="278" y="369" fill="${tokens.muted}" font-size="9" font-family="${fonts.mono}" text-anchor="middle">approved HTTPS GET</text>`,
    `<circle cx="180" cy="292" r="42" fill="${tokens.accent}" stroke="${tokens.ink}" stroke-width="1"/>`,
    `<text x="180" y="288" fill="${tokens.white}" font-size="12" font-weight="700" font-family="${fonts.sans}" text-anchor="middle">3 / 3</text>`,
    `<text x="180" y="306" fill="${tokens.white}" font-size="9" font-weight="600" font-family="${fonts.sans}" text-anchor="middle" letter-spacing="0.1em">BLOCKED</text>`,
    `<rect x="116" y="440" width="128" height="40" rx="6" fill="${tokens.white}" stroke="${tokens.ink}" stroke-width="1"/>`,
    `<text x="180" y="457" fill="${tokens.ink}" font-size="12" font-weight="600" font-family="${fonts.sans}" text-anchor="middle">No 3 / 3 mode</text>`,
    `<text x="180" y="472" fill="${tokens.muted}" font-size="9" font-family="${fonts.mono}" text-anchor="middle">tools + config + gates</text>`,
    `<rect x="380" y="116" width="580" height="336" rx="8" fill="${tokens.white}" stroke="${rgba(tokens.ink, 0.16)}"/>`,
    `<rect x="380" y="116" width="580" height="64" fill="${rgba(tokens.ink, 0.03)}"/>`,
    `<line x1="380" y1="180" x2="960" y2="180" stroke="${rgba(tokens.ink, 0.16)}" stroke-width="0.8"/>`,
    `<line x1="540" y1="116" x2="540" y2="452" stroke="${rgba(tokens.ink, 0.16)}" stroke-width="0.8"/>`,
    `<line x1="660" y1="116" x2="660" y2="452" stroke="${rgba(tokens.ink, 0.16)}" stroke-width="0.8"/>`,
    `<line x1="780" y1="116" x2="780" y2="452" stroke="${rgba(tokens.ink, 0.16)}" stroke-width="0.8"/>`,
    `<line x1="880" y1="116" x2="880" y2="452" stroke="${rgba(tokens.ink, 0.16)}" stroke-width="0.8"/>`,
    `<text x="400" y="153" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" letter-spacing="0.14em">MODE</text>`,
    `<text x="600" y="146" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.1em">UNTRUSTED</text>`,
    `<text x="600" y="158" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.1em">INPUT</text>`,
    `<text x="720" y="146" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.1em">SENSITIVE</text>`,
    `<text x="720" y="158" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.1em">DATA</text>`,
    `<text x="830" y="146" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.1em">WAY OUT</text>`,
    `<text x="920" y="146" fill="${tokens.muted}" font-size="8" font-family="${fonts.mono}" text-anchor="middle" letter-spacing="0.1em">COUNT</text>`,
  ];
  const rows = [
    ['Recorded local', 'saved evidence', 'BOUNDED', 'ABSENT', 'NONE', '1 / 3'],
    [
      'Live local',
      'public enrichment',
      'BOUNDED',
      'ABSENT',
      'HTTPS GET',
      '2 / 3',
    ],
    [
      'Agent local',
      'public web only',
      'BOUNDED',
      'ABSENT',
      'SEARCH / READ',
      '2 / 3',
    ],
  ];
  for (const [index, row] of rows.entries()) {
    const [name, sub, input, sensitive, wayOut, count] = row;
    const top = 180 + index * 68;
    const baseline = 210 + index * 68;
    markup.push(
      `<line x1="380" y1="${top + 68}" x2="960" y2="${top + 68}" stroke="${rgba(tokens.ink, 0.16)}" stroke-width="0.8"/>`,
      `<text x="400" y="${baseline}" fill="${tokens.ink}" font-size="12" font-weight="600" font-family="${fonts.sans}">${name}</text>`,
      `<text x="400" y="${baseline + 16}" fill="${tokens.muted}" font-size="9" font-family="${fonts.mono}">${sub}</text>`,
      `<text x="600" y="${baseline + 6}" fill="${tokens.ink}" font-size="10" font-weight="600" font-family="${fonts.sans}" text-anchor="middle">${input}</text>`,
      `<text x="720" y="${baseline + 6}" fill="${tokens.muted}" font-size="10" font-family="${fonts.sans}" text-anchor="middle">${sensitive}</text>`,
      `<text x="830" y="${baseline + 6}" fill="${wayOut === 'NONE' ? tokens.muted : tokens.ink}" font-size="10" font-weight="${wayOut === 'NONE' ? 400 : 600}" font-family="${fonts.sans}" text-anchor="middle">${wayOut}</text>`,
      `<text x="920" y="${baseline + 6}" fill="${tokens.ink}" font-size="12" font-weight="600" font-family="${fonts.sans}" text-anchor="middle">${count}</text>`,
    );
  }
  markup.push(
    `<rect x="388" y="392" width="564" height="52" rx="4" fill="${rgba(tokens.accent, 0.08)}" stroke="${tokens.accent}" stroke-width="1.2"/>`,
    `<text x="404" y="416" fill="${tokens.ink}" font-size="12" font-weight="600" font-family="${fonts.sans}">Rejected configuration</text>`,
    `<text x="404" y="433" fill="${tokens.muted}" font-size="9" font-family="${fonts.mono}">Lead input + real personal data + model or sender cannot enter a run.</text>`,
    `<text x="914" y="423" fill="${tokens.accent}" font-size="8" font-weight="700" font-family="${fonts.sans}" text-anchor="middle">3 / 3 BLOCKED</text>`,
  );
  d.under(markup.join('\n  '));

  return page({
    diagram: d,
    eyebrow: 'Security trifecta · runtime modes',
    title: 'No run gets all three capabilities',
    desc: 'Three overlapping capability sets show bounded untrusted input, sensitive data and a way out. Their shared center is blocked. The matrix shows recorded local, live local and optional agent-local modes without real personal data or automatic sending.',
    intro:
      'LeadFlow keeps real personal data behind its gate and exposes only two fixed read-only enrichment requests in live local mode. No current mode combines all three capabilities.',
  });
}

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
      eyebrow: '02 · EVIDENCE',
      title: 'Verified sources',
      lines: [
        'Public vehicle and ZIP data, each',
        'answer labelled live or recorded.',
      ],
    },
    {
      x: 684,
      w: 236,
      eyebrow: '03 · CONTROL',
      title: 'Human approval',
      lines: ['Drafts need consent and a', 'person; nothing is sent.'],
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
    desc: 'Three principles: intake is persisted before processing, enrichment comes from public vehicle and ZIP sources with every answer labelled live or recorded, and outreach drafts need recorded consent and human approval and are never sent.',
    intro: 'Brand asset for the README opening.',
  });
}

function simplePipeline() {
  const d = new Diagram({ slug: 'pipeline', width: 960, height: 464 });
  const xs = [20, 176, 332, 488, 644, 800];
  const y = 200;
  for (let index = 0; index < xs.length - 1; index += 1) {
    d.path(
      [
        [xs[index] + 140, 240],
        [xs[index + 1], 240],
      ],
      index === 1 ? { role: 'accent' } : undefined,
    );
  }
  d.path(
    [
      [558, 280],
      [558, 360],
    ],
    { dashed: true },
  );
  d.path(
    [
      [668, 400],
      [714, 400],
      [714, 280],
    ],
    { dashed: true },
  );

  const nodes = [
    [
      'input',
      'PERSON',
      'Fictional inquiry',
      ['need · timing', 'vehicle · consent'],
    ],
    [
      'focal',
      'SAVED',
      'Stored lead',
      ['lead · run · event', 'before any work'],
    ],
    [
      'backend',
      'SCORE',
      'Readiness score',
      ['100-point rubric', 'marketing readiness'],
    ],
    ['backend', 'LOOK UP', 'Public facts', ['vehicle + ZIP', 'live or saved']],
    ['backend', 'CHECK', 'Draft email', ['consent required', 'eight checks']],
    ['input', 'PERSON', 'Human review', ['approve · edit', 'reject · no send']],
  ];
  for (const [index, [kind, tag, name, sub]] of nodes.entries()) {
    d.node({ x: xs[index], y, w: 140, h: 80, kind, tag, name, sub });
  }
  d.node({
    x: 488,
    y: 360,
    w: 180,
    h: 80,
    kind: 'optional',
    tag: 'OPTIONAL',
    name: 'Cited research',
    sub: ['one short paragraph', 'failure keeps template'],
  });
  return page({
    diagram: d,
    eyebrow: 'Plain-language pipeline',
    title: 'From inquiry to a reviewed draft',
    desc: 'A fictional inquiry is stored before processing, scored for marketing readiness, enriched from public sources, optionally given one cited research paragraph, checked and held for human review without sending anything.',
    intro:
      'One inquiry moves through six steps. Optional research can add context, but it cannot bypass the checks or human review.',
  });
}

function simpleArchitecture() {
  const d = new Diagram({ slug: 'architecture', width: 960, height: 560 });
  d.zone({
    x: 16,
    y: 96,
    w: 656,
    h: 452,
    label: 'LOCAL WORKSTATION · FICTIONAL DATA',
    dashed: true,
    labelX: 212,
  });
  d.zone({
    x: 720,
    y: 96,
    w: 224,
    h: 452,
    label: 'APPROVED SERVICES',
    dashed: true,
    labelX: 760,
  });
  d.path(
    [
      [200, 200],
      [240, 200],
    ],
    { role: 'link' },
  );
  d.path(
    [
      [400, 200],
      [480, 200],
    ],
    { role: 'accent' },
  );
  d.path([
    [560, 240],
    [560, 340],
  ]);
  d.path([
    [400, 380],
    [480, 380],
  ]);
  d.path(
    [
      [640, 380],
      [744, 380],
    ],
    { role: 'link' },
  );
  d.path(
    [
      [640, 404],
      [692, 404],
      [692, 496],
      [744, 496],
    ],
    { role: 'link', dashed: true },
  );

  d.node({
    x: 40,
    y: 160,
    w: 160,
    h: 80,
    kind: 'input',
    tag: 'BROWSER',
    name: 'Operator workspace',
    sub: ['intake · runs · metrics', 'review queue'],
  });
  d.node({
    x: 240,
    y: 160,
    w: 160,
    h: 80,
    kind: 'backend',
    tag: 'API',
    name: 'Fastify server',
    sub: ['Host + Origin checks', 'strict schemas'],
  });
  d.node({
    x: 480,
    y: 160,
    w: 160,
    h: 80,
    kind: 'focal',
    tag: 'STORE',
    name: 'Stored records',
    sub: ['lead · run · evidence', 'checkpoint · review'],
  });
  d.node({
    x: 240,
    y: 340,
    w: 160,
    h: 80,
    kind: 'backend',
    tag: 'CODE',
    name: 'Domain rules',
    sub: ['rubric · consent', 'claims · spend caps'],
  });
  d.node({
    x: 480,
    y: 340,
    w: 160,
    h: 80,
    kind: 'backend',
    tag: 'WORKFLOW',
    name: 'LangGraph runtime',
    sub: ['qualify · enrich · draft', 'verify · resume'],
  });
  d.node({
    x: 744,
    y: 332,
    w: 176,
    h: 96,
    kind: 'external',
    tag: 'PUBLIC DATA',
    name: 'Vehicle + ZIP',
    sub: ['NHTSA vPIC', 'Zippopotam.us', 'read-only'],
  });
  d.node({
    x: 744,
    y: 456,
    w: 176,
    h: 80,
    kind: 'optional',
    tag: 'PAID · LOCAL',
    name: 'Claude API',
    sub: ['research + drafting', 'off by default'],
  });
  return page({
    diagram: d,
    eyebrow: 'Technical system boundary',
    title: 'Where LeadFlow runs and what it can call',
    desc: 'The operator workspace calls a loopback Fastify server, which stores the lead before the LangGraph workflow uses deterministic rules, read-only public vehicle and ZIP services, and an optional local-only Claude service.',
    intro:
      'The browser, server, stored records, rules and workflow stay inside the local boundary. Only the workflow can reach approved services.',
  });
}

function simpleAgentWorkflow() {
  const d = new Diagram({
    slug: 'agent-workflow',
    width: 960,
    height: 540,
    maxNodes: 8,
    maxArrows: 11,
  });

  d.path([
    [16, 300],
    [36, 300],
  ]);
  d.path([
    [160, 276],
    [192, 276],
    [192, 140],
    [216, 140],
  ]);
  d.path([
    [164, 300],
    [216, 300],
  ]);
  d.path([
    [160, 324],
    [192, 324],
    [192, 460],
    [216, 460],
  ]);
  d.path([
    [344, 140],
    [376, 140],
    [376, 276],
    [408, 276],
  ]);
  d.path([
    [344, 300],
    [404, 300],
  ]);
  d.path([
    [344, 460],
    [376, 460],
    [376, 324],
    [408, 324],
  ]);
  d.path(
    [
      [540, 300],
      [564, 300],
      [564, 196],
      [588, 196],
    ],
    { role: 'accent' },
  );
  d.path([
    [640, 262],
    [640, 346],
  ]);
  d.path(
    [
      [672, 346],
      [672, 262],
    ],
    { dashed: true },
  );
  d.path([
    [720, 408],
    [780, 408],
  ]);

  d.bubble({
    cx: 100,
    cy: 300,
    r: 64,
    kind: 'focal',
    tag: 'ORCHESTRATOR',
    name: 'Research lead',
    sub: 'plan · delegate',
  });
  d.bubble({
    cx: 280,
    cy: 140,
    r: 64,
    kind: 'backend',
    tag: 'SPECIALIST',
    name: 'Vehicle',
    sub: 'facts',
  });
  d.bubble({
    cx: 280,
    cy: 300,
    r: 64,
    kind: 'backend',
    tag: 'SPECIALIST',
    name: 'Environmental',
    sub: 'facts',
  });
  d.bubble({
    cx: 280,
    cy: 460,
    r: 64,
    kind: 'backend',
    tag: 'SPECIALIST',
    name: 'Coverage',
    sub: 'education',
  });
  d.bubble({
    cx: 472,
    cy: 300,
    r: 68,
    kind: 'backend',
    tag: 'CODE',
    name: 'Evidence check',
    sub: 'sources · claims',
  });
  d.bubble({
    cx: 656,
    cy: 196,
    r: 68,
    kind: 'backend',
    tag: 'AGENT',
    name: 'Drafting agent',
    sub: 'one short paragraph',
  });
  d.bubble({
    cx: 656,
    cy: 408,
    r: 64,
    kind: 'backend',
    tag: 'CHECK',
    name: 'Draft review',
    sub: 'check · rewrite ≤2',
  });
  d.bubble({
    cx: 856,
    cy: 408,
    r: 76,
    kind: 'input',
    tag: 'PERSON',
    name: 'Human review',
    sub: 'approve · edit · reject',
  });
  return page({
    diagram: d,
    eyebrow: 'Optional agent pipeline',
    title: 'From research to a reviewed draft',
    desc: 'A research lead coordinates vehicle facts, environmental facts and coverage education; code checks the evidence before a drafting agent writes one paragraph, draft review permits two rewrites, and a person makes the final decision.',
    intro:
      'Checked research feeds drafting, review and a final human decision.',
  });
}

export const legacyDiagramSources = {
  architecture,
  persistBeforeProcessing,
  runLifecycle,
  dataModel,
  reviewFlow,
  phaseTwoRecords,
  agentArchitecture,
  agentTeam,
  privateCloud,
  hostedExecution,
  hostedLifecycle,
  explodedSystem,
  principles,
};

export const diagrams = {
  pipeline: simplePipeline,
  architecture: simpleArchitecture,
  'agent-workflow': simpleAgentWorkflow,
  'security-trifecta': securityTrifecta,
};

export function renderDiagrams() {
  return Object.fromEntries(
    Object.entries(diagrams).map(([slug, render]) => [
      `docs/diagrams/${slug}.html`,
      render(),
    ]),
  );
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
