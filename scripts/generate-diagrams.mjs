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
    [424, 362],
    [760, 362],
  ]);
  d.label('READ-ONLY GET', 592, 376);
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
    h: 80,
    kind: 'input',
    tag: 'EXTERNAL',
    name: 'Enrichment sources',
    sub: ['NHTSA vPIC', 'Zippopotam.us', 'owner-authorized'],
  });
  d.node({
    x: 760,
    y: 460,
    w: 160,
    h: 80,
    kind: 'optional',
    tag: 'DEFERRED',
    name: 'Deferred services',
    sub: ['model provider', 'outreach sending', 'real personal data'],
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
    desc: 'An operator uses the dossier, which calls a loopback Fastify API that checks Host and Origin; the API commits intake to the Firestore Emulator before the seven-node LangGraph runtime scores, enriches through read-only GETs to NHTSA vPIC and Zippopotam.us, drafts and verifies with domain contracts, while a traffic simulator feeds fictional leads with simulated attribution through the same intake API, and the model provider, outreach sending and real personal data stay deferred; the private hosted topology has its own deployment view.',
    intro:
      'Everything inside the boundary runs on one workstation against synthetic data. The only outbound calls are read-only GETs to the two authorized enrichment sources; nothing is ever sent.',
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
    height: 560,
    maxNodes: 6,
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

  d.callout(
    [
      'Revisions and reviews are append-only; earlier evidence and revisions stay stored, unlinked.',
      'Fields are structure only; stored fixture values are fictional and never drawn here.',
    ],
    40,
    524,
  );

  return page({
    diagram: d,
    eyebrow: 'Data model · Phase 2',
    title: 'Enrichment, draft and review records',
    desc: 'A run links up to two enrichment evidence records, one email check, one run-level verification result and one draft whose immutable revisions each carry a content digest, their own verification result and at most one append-only human review.',
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
    ['3 · AGENT', 'Outreach agent', 'consent-gated draft'],
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

  return page({
    diagram: d,
    eyebrow: 'Agent architecture · Phase 2',
    title: 'Orchestrator and specialist agents',
    desc: 'After the intake API commits a lead, a LangGraph orchestrator dispatches in order to a qualification agent, an enrichment agent that calls NHTSA vPIC and Zippopotam.us read-only, an outreach agent that writes a consent-gated draft, and a verifier guard; it checkpoints each step in Firestore, sends a passing draft to human review, and resumes a stopped run from its checkpoint.',
    intro: '',
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

export const diagrams = {
  architecture,
  'persist-before-processing': persistBeforeProcessing,
  'run-lifecycle': runLifecycle,
  'data-model': dataModel,
  'review-flow': reviewFlow,
  'data-model-outreach': phaseTwoRecords,
  'agent-architecture': agentArchitecture,
  'private-cloud': privateCloud,
  'hosted-execution': hostedExecution,
  'hosted-lifecycle': hostedLifecycle,
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
