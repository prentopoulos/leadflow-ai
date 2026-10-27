# Current handoff

Read PROJECT.md and current user instructions. Inspect actual Git/OpenSpec state before resuming.

## Phase 3 closing checkpoint (2026-10-27)

Phase 3 is complete and archived as `openspec/changes/archive/2026-10-27-phase-3-deployment-access-evidence`
(+26 requirements, 2 modified, none removed); PROJECT.md records Phase 3 `Done`. Peter chose to close
it the night of the hosted proof so Phase 4 could start, before Google billing posted. The private
service keeps running through Phase 4 under the same CA$10 Cloud Run cap and project alert budget.

Carried into Phase 4 as its first task: on 2026-10-27, read the posted cost for project LeadFlow AI
(Billing → Reports, and the two budgets) and record `deployed-cost-status` in
`docs/evidence/phase-3/index.json` with the observed amount, or pending with a reason if still not
posted. A one-time reminder routine fires at 09:00 Toronto that day. Also carried: the walkthrough
recording (end of Phase 4) and the teardown, whose seven-day clock starts at the Phase 4
demonstration approval.

Phase 4 direction: see "Phase 4 direction" below. No phase is in progress until `/next-phase` proposes
Phase 4 in a fresh session.

## Phase 3 hosted proof checkpoint (2026-10-27)

The private hosted proof is live. Peter approved the enumerated task 6.1 actions on 2026-10-26 and
let Claude drive Cloud Shell and the console in his signed-in Chrome. Done: branch pushed (draft PR
#7); billing/IAM/cap rechecked; six services enabled (Logging, Monitoring and Service Usage were
already on, alongside Google's default new-project services, untouched); project alert budget
`LeadFlow AI project CA$10 alert budget` (50/80/100% actual, 100% forecast); Firestore
`(default)` Standard/Native in Toronto with deny-all rules, 15 ACTIVE TTL policies and 15 index
exemptions; repository `leadflow-ai-demo`; identities `leadflow-ai-runtime` (datastore.user) and
`leadflow-ai-build` (repository writer, log writer); two source-less builds; revision A
`leadflow-ai-demo-95b6c04eda59` (build `7a4e502d-e957-498f-95fa-18331984640f`) serving 100% and
revision B `leadflow-ai-demo-d6ded3f29172` (build `ca7688ad-e0eb-44ed-932c-ec86e0f53c71`) kept at
0% after the rollback exercise. IAP uses a custom OAuth client (External, Testing, owner as the only
test user); the auto-generated secret was not downloaded. No storage bucket exists.

Evidence (`docs/evidence/phase-3/index.json`, bound to revision A): 14 deployed checks pass,
including verified rollback. `allowlist-denial` (no second Google account) and
`resume-retry-conflict` (no hosted interruption; emulator-proven) are `not_run` with reasons;
cost is pending until billing posts; teardown is scheduled.

Retained failures and deviations: the console budget form and typed console input misfired until
driven through page controls; IAP needed a custom OAuth client the design had not planned (runbook
updated); `gcloud iap` asked for the unapproved Cloud Resource Manager API and was declined (the
Owner role already grants IAP access); commit `2f75efa` was pushed with one failing evaluation
case, fixed in `d6ded3f`.

Owner decisions (2026-10-27): hosting is extended through Phase 4 (same cap, budget and stop rules;
the teardown clock starts at Phase 4's demonstration approval), and the walkthrough recording moves
to the end of Phase 4.

Next actions, in order: (1) on 2026-10-27 or later, recheck the posted cost and record
`deployed-cost-status`; (2) mark 6.1 complete, archive the OpenSpec change, sync specs, set Phase 3
Done, rerun the gate and push; (3) merge PR #7 only on the owner's go-ahead; (4) clear the context
and run `/next-phase` for Phase 4.

Phase 4 direction (owner, 2026-10-27), to be grilled and proposed in a fresh session: keep it simple.
One small simulation script feeds fictional leads through the real API at a steady pace with
recorded enrichment, each carrying a synthetic source, campaign and click ID; drafts still wait for
human approval. The dashboard adds attribution by channel and campaign and a headline
**cost-per-lead** metric (synthetic channel spend divided by stored leads, overall and per channel,
plus cost per qualified lead), labelled simulated. Real Google Ads or Analytics data stays behind
its gate. The owner prefers to record the walkthrough after Phase 4.

## Phase 3 local candidate checkpoint (2026-10-26)

Branch `phase-3-deployment-access-evidence`, OpenSpec change of the same name. Tasks 1.1-5.1 are
complete; 6.1 (the hosted proof) is the only open task and waits for an enumerated owner approval.
PROJECT.md shows Phase 3 `In progress`. Nothing has been pushed since the spec-only draft PR #7,
and no cloud API, resource, build or deployment exists.

Implemented and locally verified: strict local/cloud configuration; one digest-pinned container
serving the web build and API; direct-IAP assertion verification with a private subject allowlist;
ADC Firestore with seven-day Timestamp retention, deny-all rules and a guarded purge; request-bound
hosted execution (45 s deadline, 75 s lease) and request-bound resume; session states and the seven
accessibility refinements; Cloud Build and Cloud Run templates, TTL commands, owner-subject capture
and Cloud Shell purge entry point; runbook; `system-bundle-v3`; the `phase-3.0` corpus (68
cases); `deployment-evidence-v1` index with every deployed check `not_run`; three new
diagrams; README, AI_OPS and walkthrough script. Codex's consolidated review and its fixes are in
`docs/reviews/phase-3-local-candidate-review.md`, which also records every check, failure and
identity for the selected candidate `b45328604ac78442a6cc9e8b76965418e7667cd7`.

Retained failures: one intermittent App intake-focus test failure under parallel load (passed on
three reruns, not reproduced since); the emulator probe's first run exposed a fail-open loopback
guard for configurations without `mode` (fixed); inspector and `find -delete` defects recorded in
the review file.

Next action (6.1): the owner gives one enumerated approval (APIs, resources, identities, budget,
commands, the push of this branch to the public repository, and the private parameters he will
supply). Before acting, recheck billing, IAM and the spend cap; create `.local/private-values.txt`;
rerun `pnpm container:inspect` and the pre-publication scans on the exact commit being pushed and
built (documentation commits after `b453286` change the source digest, so the built commit is
the one recorded); then follow `docs/operations/runbook.md` and fill the evidence index. The
walkthrough video is recorded only after hosted evidence passes, and goes to the owner privately.

## Phase 3 proposal checkpoint (2026-10-26)

Peter accepted the consolidated Phase 3 decisions. Branch
`phase-3-deployment-access-evidence` contains the OpenSpec change of the same name; it plans a
private single-owner Cloud Run proof using direct IAP, backend-only Toronto Firestore,
request-bound cloud execution, immutable Cloud Build output, recorded enrichment, bounded cost,
verified rollback, evidence, walkthrough, and teardown. No API, cloud resource, build, deployment,
merge, or MP4 publication is authorized by this checkpoint.

The spec-only candidate is published as draft PR #7. The proposal review (2026-10-26) found five
technical corrections, folded in by `docs: fold proposal review findings into phase three`:
- the intake default must be a recorded vehicle and ZIP, because the 2021 Subaru Outback default has
  no recording;
- hosted demo data is entered through the authenticated UI with recorded subjects;
- IAP verification uses an exact-pinned direct `google-auth-library`;
- TTL expiry is a Firestore timestamp with one policy per collection group;
- the first IAP enable happens once in the Cloud Run console (no-organization project).

Peter accepted the reviewed proposal and authorized local implementation. He also approved
downloading the official `node:24.22.1-slim` container base image, to be pinned by digest and
recorded in `docs/dependencies/phase-3.md` before use.

Next action: start a fresh session with `/next-phase` and implement task 1.1 on this branch. Before any
cloud mutation, enumerate the exact APIs, resources, identities, budget controls, and commands for a
new owner approval; recheck live account, billing, IAM, and service state at that time.

## Phase 3 deployment gate resolution (2026-10-26)

Peter resolved the deployment gate and authorized setup through his existing Google account. The
following live Google Cloud state was created and verified in the console; no application service,
API, secret, model provider, or deployment was enabled:

- Google Cloud project: an owner-selected dedicated project, identified only in the owner's private
  deployment record, attached to the owner's existing active billing account.
- Deployment region decision: Toronto, `northamerica-northeast2`.
- Access policy: private; the IAM page showed only the owner principal. No public or anonymous
  principal was present. Direct IAP is the accepted application-access boundary, with no
  `allUsers` or `allAuthenticatedUsers` binding.
- Secret path decision: no Phase 3 runtime secret currently has a consumer. Use ADC and managed IAP
  credentials; do not enable Secret Manager or add a secret unless a later design and approval name
  an actual need.
- Data boundary: fictional identities and test contact details only. Real personal data remains
  gated.
- External-action boundary: no paid model call and no automatic outreach sending.
- Cost control: an enforced monthly spend cap named `LeadFlow AI CA$10 monthly cap` is configured
  for this project's Cloud Run service, with 50%, 80%, and 100% notifications. The console showed
  `Configured` and approximately `CA$0.00 / CA$10.00` after creation. Google warns that enforcement
  is delayed, so a small overage can still be billed; treat CA$10 as a control target, not a
  bank-style absolute ceiling. Stop before adding another billable service unless its separate cost
  control is explicitly resolved.

The pre-Phase-3 setup itself incurred no displayed charge. The next session must recheck current
billing/IAM state before deployment and must keep Cloud Run authenticated; do not add `allUsers` or
`allAuthenticatedUsers`. The first budget form load failed and was retried successfully; preserve
that setup failure in the evidence record rather than claiming a single clean attempt.

## Phase 2 closing checkpoint (2026-10-26)

Phase 2 is complete and merged into `main` with a merge commit. All nine tasks passed, and the
OpenSpec change is archived with its requirements synchronized into `openspec/specs/`. PROJECT.md
records Phase 2 as `Done`. The project is licensed MIT and published as the public repository
`github.com/prentopoulos/leadflow-ai` (PROJECT.md section 6 publication gate, resolved 2026-10-26).
No phase is in progress; the next step is proposing Phase 3 in a fresh session with `/next-phase`.

Closing evidence (task 9.1):
- Full offline gate (`pnpm check`): the first run failed at governance because a Phase 2 eval
  fixture named a fictional outbound host; the fixture now uses the other source's template, and
  the rerun passed every step (38 files/259 tests then; 265 after the review fixes).
- `pnpm emulator:runtime` passed against the isolated emulator.
- Live local run: one fictional operator lead made exactly two read-only GETs (vPIC and
  Zippopotam.us), both found and labelled live; all eight rules passed; the draft waited in review.
- Code review (`/code-review high` over `main...HEAD`): 10 findings, all confirmed and fixed in
  `fix: resolve phase two code review findings` (draft history during verification, review/revise
  retry race, revision limit, request-text and event-privacy calibration, executor dropping a
  committed resume, mixed retry evidence, dot-only vehicle make, polling races).
- Design eval (impeccable critique, two isolated reviewers; taste reviewer skipped for app
  screens): 20/40 with four P1s. Peter chose P1s plus the five callouts and a decision-first
  dossier; fixed in `fix: resolve phase two design review findings`. After the fixes the detector
  reports 0 findings, and no page has text under 12 px or horizontal overflow at 390 px.
- Deferred to Phase 3 by Peter's scope choice (design P2s): focused success notice and next-pending
  flow, `aria-pressed` filters, a run-card accessible name, quieter poll announcements, chart focus
  inside the hidden frame, summary disclosure markers, keyboard shortcuts.
- Pre-publication scans per `.agents/skills/showcase/references/pre-publication.md`: no secret in
  1,002 history blobs (scanner proven on planted keys), no real personal data, no binaries; home
  paths neutralised in current docs; commit email and three older blobs with the home path kept by
  Peter's choice.

## Phase 2 record

Branch `phase-2-enrichment-outreach-dashboard`, OpenSpec change
`phase-2-enrichment-outreach-dashboard`. Decisions are in PROJECT.md "Phase 2 decisions".

- Done in task commits: 6.1 operator views and seed data (below), 1.1 contracts and UI dependencies, 2.1 live enrichment adapters plus the
  authorized probe (18 of 18 answered; fixtures in `packages/runtime/fixtures/`), 3.1 composer,
  verification rules, reviews and the no-send governance check, 4.1's seven-node workflow and
  asynchronous execution boundary, and 5.1's Phase 2 API boundary.
- Task 4.1 includes the seven-node `phase-2-graph-v1`, Phase 2 linked
  records and failure semantics, the deduplicating in-process executor, durable 202 resume,
  graceful executor drain, Phase 2 run detail, explicit enrichment mode/origin configuration, and
  crash-during-enrichment reclaim with fresh linked evidence while earlier evidence remains stored
  as superseded history.
- Task 4.1 checks passed: strict TypeScript; ESLint on affected files; runtime 28 files/192 tests;
  API 10 files/78 tests; affected formatting and `git diff --check`; and the direct isolated
  Firestore verifier against the already-running project emulator (built API, workflow recovery,
  asynchronous resume and verified flush). The wrapper first retained a port-8080 collision, and
  the first direct probe exposed stale Phase 1 revision assertions before the corrected probe passed.
- Task 5.1 adds exact local Host and state-changing Origin checks; bounded and privacy-safe run
  listing; stored-run metrics with explicit denominators and evidence-class splits; revision and
  content-bound review routes; cross-record draft-history integrity checks; and the expanded
  built-API probe for access controls, approval queue, metrics, approval, stale conflicts,
  operator revision and rejection. The probe remains local and flushes only synthetic emulator data.
- Task 5.1 checks passed: strict TypeScript; ESLint on affected files; runtime 30 files/199 tests;
  API 14 files/88 tests; affected formatting and `git diff --check`; production build; strict
  OpenSpec validation; and the direct isolated Firestore verifier against the already-running
  project emulator, including workflow recovery and verified flush.
- Task 6.1 adds hash-routed Intake / Operations views (lazy-loaded Recharts), the leads/runs list
  with approval-queue and attention filters, the extended dossier (enrichment evidence with class
  and capture time, email check, verification rules, draft review, edit-as-revision, copy/export
  after approval), the metrics dashboard with text-table equivalents, 3 s visible-tab polling, and
  `pnpm seed:local` (40 fixed fictional leads, recorded enrichment only, keys per system bundle).
- Task 6.1 checks passed: all 38 test files/258 tests, ESLint, strict TypeScript, governance with
  the no-send check, production build, and a running-app review (emulator, recorded-mode API, seed,
  Vite on 5174): 40/40 runs complete, 30 pending drafts, 10 consent skips, 0 failures; UI approval
  through the real Origin check; 390 px views with no horizontal overflow, no target under 24 px
  and no focus hidden by the sticky strip.
- Findings fixed while running it: the request-text rule falsely blocked 6 of 30 clean drafts by
  matching common template wording (" would like "), so runs shared with fixed template phrases are
  now ignored; filter changes waited for the next 3 s poll; reseeding after a code change replayed
  the previous bundle's leads; the Phase 1 simulation panel overflowed the dossier at 390 px; score
  summaries were under 24 px; the sticky strip needed scroll padding.
- Task 7.1 froze 13 `phase-2.0` cases (51 in all: 35 pass, 0 fail, 16 `not_run`, 0 stale) and
  updated AI_OPS.md.
- Task 8.1 extends the Structurizr model (vPIC and Zippopotam.us external systems, enrichment and
  review dynamic view), redraws the architecture diagram, adds `review-flow` and
  `data-model-outreach`, and rewrites the README with the showcase method, source credits and the
  no-send boundary. It also replaced three Phase 2 one-sided accent borders flagged by the design
  hook. Checks passed: diagram render, `check-docs` (links, freshness, model/schema drift,
  Structurizr) and the web tests (5 files/26 tests).
- Open for 9.1's design-eval: the five Phase 1 one-sided callout borders in
  `apps/web/src/styles.css` that the design hook flags (`.error-summary`/`.submission-error`/
  `.validation-status`, `.stale-state`, `.safe-error`, `.missing-information`, `.integrity-hold`).
  They shipped on `main` in Phase 1 and are neither changed nor suppressed yet.
- Next step: task 9.1 — full `pnpm check`, `pnpm emulator:runtime`, a live local run, one
  consolidated branch review including design-eval, fixes, PROJECT/AI_OPS/HANDOFF updates, and
  archiving the change. Merge to `main` only on the owner's go-ahead.
- Capture leaf-check output with `cmd /c "node node_modules\...> file 2>&1"` (docs/development.md).

## Phase 1 record

### Phase 1 closing checkpoint

Phase 0 and Phase 1 are complete and merged into `main`. Every Phase 1 task (35 of 35) passed. The
OpenSpec change is archived as `2026-10-25-phase-1-intake-qualification`, and its requirements now
live in `openspec/specs/`. PROJECT.md records Phase 1 as `Done`. No phase is in progress; the next
step is proposing Phase 2 in a fresh session (see Next action). The sections below are the Phase 1
implementation record.

The Phase 1 boundaries that Phase 2 inherits:

- ZIP code is the only exact Military.com field verified from the public landing page; every other
  Phase 1 intake field is visibly a LeadFlow demo field and the parity gate remains open.
- All inputs and outcomes remain fictional/synthetic and local. Firestore Emulator is the sole
  durable application store, reached only through loopback Fastify.
- Intake atomically persists idempotency, lead, run, and first event before graph execution.
- LangGraph.js uses a project-owned Firestore `BaseCheckpointSaver`; official JavaScript docs do not
  provide a Firestore saver.
- `rubric-v1` is deterministic: need timeline 40, request clarity 30, completeness 30; priority is
  high at 80–100, standard at 50–79, nurture at 0–49, and invalid evidence holds priority.
- The interpreter is a deterministic structured stub. Provider/model/prompt calls remain gated and
  `not_run`.
- A fixed-seed score-independent simulator exercises lifecycle/metric contracts only and makes no
  predictive or live-conversion claim.
- The product direction is a restrained operations dossier with a persistent
  `SIMULATION · Synthetic leads and outcomes` label, complete failure/recovery states, and desktop/
  390px accessibility.

## Implemented dependency/toolchain slice

- `docs/dependencies/phase-1.md` records exact versions, licences, compatibility evidence,
  alternatives, and emulator/production limits checked before installation.
- The private strict-ESM `@leadflow-ai/runtime` workspace depends one-way on domain contracts and
  exact-pins LangGraph 1.5.2, LangChain core 1.3.0, and Firebase Admin 14.5.0. Fastify may consume
  runtime; no model-provider SDK was added.
- Root development tooling exact-pins Firebase CLI 15.34.1. The frozen lockfile covers all six
  workspaces and explicitly denies the unneeded transitive install scripts for `@firebase/util`,
  `protobufjs`, and `re2`.
- `toolchain.phase1.json` pins Temurin 21.0.12.1+1, Firestore Emulator 1.22.0, and Structurizr CLI
  2025.11.09 with exact URLs and SHA-256 values. The ignored `.tools` cache contains verified copies;
  activation sets project-local Java, Firebase cache, and Structurizr paths without changing Node
  24.22.1 or pnpm 12.15.0.
- Firebase uses the exact demo project `demo-leadflow-ai-local`, binds Firestore to
  `127.0.0.1:8080`, disables the Emulator UI, denies client rules, and exposes separate ephemeral,
  isolated-exec, explicit-retain, and explicit-export commands. Retained state exists only under
  ignored `.local/firestore`.
- The emulator wrapper sets CI/update-notifier controls and a project-local config directory so the
  ordinary command neither fetches the CLI message-of-the-day nor writes user-global Firebase
  configuration.

## Slice verification

The following passed on 2026-10-24:

- `pnpm install --frozen-lockfile --offline` against the populated workstation cache;
- `pnpm tools:verify`: all three cached artifacts and checksums passed without network;
- Structurizr `version`: CLI 2025.11.09, structurizr-java 5.0.2, Java 21.0.12.1;
- `pnpm emulator:exec`: the cached Firestore Emulator detected the demo project, passed the exact
  loopback host/project and verified-flush probe, and shut down cleanly;
- `. .\scripts\activate-toolchain.ps1; pnpm check`: exact Node/pnpm/Java/emulator/Structurizr
  preflight, Prettier, ESLint, strict TypeScript across six workspaces, 5 Vitest files/17 tests,
  production builds, synthetic-local evaluation (21 passed, 0 failed, 3 `not_run`), API/web
  loopback smoke, constitution/hygiene checks, and strict OpenSpec validation (5 passed, 0 failed);
- `git diff --check`.

Retained failures: the first Java transfer stalled at zero bytes and was stopped; atomic partial
downloads, retries, and checksums then passed. A restricted-shell offline pnpm run could not see the
host cache; the identical no-network command passed against the actual workstation cache. A
sandboxed emulator launch timed out on its local hub port; the identical command passed when local
loopback ports were allowed. A direct Firebase CLI version probe attempted its global update/config
path; the repository wrapper disables that path and passed.
The first pnpm-invoked tool verifier inherited a shell module path without `Get-FileHash`; checksum
calculation now uses the .NET SHA-256 API and the same `pnpm tools:verify` command passed.

## Implemented domain-contract slice

- Strict, independently versioned Zod contracts cover fictional/test-contact intake, provenance,
  leads, runs, privacy-safe lifecycle events, checkpoints, pending writes, idempotency,
  qualification interpretations/results, simulation records, system bundles, API responses, and
  safe errors. Unknown properties are rejected and the qualification projection must be a complete,
  disjoint partition of complete and missing fields.
- Pure `rubric-v1` implements the accepted 40/30/30 marketing-readiness arithmetic, criterion
  evidence, exact priority thresholds, missing-information reporting, and fail-closed integrity
  holds. Consent is neither a score input nor outbound authority.
- Lifecycle helpers define the fixed transition graph, terminal/resume eligibility, revision and
  event-sequence checks, and lease expiry semantics.
- Pure `simulator-v1` derives a stable seed from run identity and simulator version only. Its
  monotonic synthetic outcomes are score-independent and explicitly `not_live`/`not_predictive`;
  the response-rate contract reports an unknown value for an empty denominator and retains named
  exclusions.
- The system bundle now records code/source/dirty-patch, lockfile, and fixture identities, every
  Phase 1 contract version, Node/pnpm/Java/Firebase/Firestore Emulator/Structurizr and platform
  identity, the exact local project, and explicit null-with-reason provider/model/prompt/live-tool
  boundaries.

Domain-slice leaf checks passed on 2026-10-24: Prettier, ESLint with zero warnings, strict
TypeScript, 9 Vitest files/47 tests, production builds, and the retained Phase 0 evaluator
(21 passed, 0 failed, 3 `not_run`). During implementation, ESLint first rejected one unused local
schema constant; it was removed and the fail-fast leaf sequence then passed. The complete offline
`pnpm check` gate also passed on the corrected candidate, including toolchain preflight, API/web
loopback smokes, governance, and strict OpenSpec validation (5 passed, 0 failed).

## Implemented emulator persistence boundary

- Runtime startup validates the exact `demo-leadflow-ai-local` project and
  `127.0.0.1:8080` emulator host before creating a uniquely named Admin SDK app. Protocols,
  alternative loopback spellings/ports, missing values, and any other project fail before a
  database call, so the boundary cannot fall through to cloud Firestore.
- Create-only repositories cover `leads`, `runs`, nested run `events`, `idempotency`,
  `systemBundles`, `qualificationResults`, and `simulationRecords`. Every candidate write is parsed
  before reaching Firestore; every loaded document is strictly parsed and is rejected if parsing
  would normalize the stored value.
- The repository contract exposes prepared validated creates for the atomic transaction work that
  follows and rejects unsafe path segments. Unit tests exercise every owned collection path,
  valid round trips, invalid writes, malformed/normalization-dependent reads, missing records, and
  unsafe identifiers.
- `pnpm emulator:runtime` compiles the domain/runtime packages and runs a real create/read probe
  against the pinned isolated emulator. It verifies create-only duplicate rejection, strict malformed
  read rejection, and clean Admin SDK/emulator shutdown.

Task 3.1 checks passed on 2026-10-24: Prettier, ESLint, strict TypeScript, 11 Vitest files/57 tests,
production build, and the real `pnpm emulator:runtime` probe. The first probe used Firebase Admin's
REST-preferred transport and failed before writing because it requested application-default
credentials; the boundary now uses the standard emulator transport, and the identical probe passed
without credentials.

## Implemented atomic intake persistence

- The bounded visible-ASCII idempotency key and strict `intake-v1` payload normalize and validate
  before any transaction begins. The request digest is SHA-256 over a recursively canonicalized,
  normalized intake; the stored key is a digest rather than the raw key.
- One Firestore transaction reads the idempotency binding and, for a new request, creates exactly the
  idempotency record, normalized fictional lead with fixed source/demo provenance, `persisted` run,
  and privacy-safe sequence-1 `lead.persisted` event. Server IDs and the timestamp are stable across
  Firestore transaction retries, and no workflow boundary is invoked by this service.
- Replaying the same normalized intake/key returns the original lead/run IDs and committed timestamp
  without duplicate documents. Reusing the key for different canonical intake raises the typed
  `idempotency_conflict` and changes no record.
- Unit transaction tests cover four-record commit, normalization-equivalent replay, content conflict,
  injected rollback, invalid input/key rejection before transaction, canonical digest stability, and
  event privacy. The real emulator probe covers new intake, replay, conflict, durable lead/run state,
  and clean shutdown.

Task 3.2 checks passed on 2026-10-24: Prettier, ESLint, strict TypeScript, 12 Vitest files/63 tests,
and `pnpm emulator:runtime`. The first new unit run retained one failure caused by an incorrect
hard-coded test digest; replacing it with an independently calculated SHA-256 expectation made the
same suite pass.

## Implemented transactional lifecycle and leases

- Lifecycle commits load and strictly validate the current run inside the transaction, require the
  caller's expected revision, derive the next revision and event sequence from stored state, validate
  the complete next run/event records, then update the run and create the append-only event in one
  commit. Missing runs, stale revisions, invalid state transitions, duplicate event IDs, and malformed
  stored state fail without a partial update.
- First claim accepts only a revision-matched `persisted` run with no lease, creates a bounded lease,
  transitions to `running`, and records `run.claimed`. Concurrent claims serialize through Firestore
  so exactly one owner commits.
- Expired-lease reclaim accepts only a revision-matched `running` run with an existing expired lease,
  retains workflow attempt state, replaces ownership, and records `run.lease_reclaimed`; an active
  lease is rejected. The reclaim service is internal and will be exposed only through the explicit
  guarded resume path in task 4.4.

Task 3.3 checks passed on 2026-10-24: Prettier, ESLint, strict TypeScript, 13 Vitest files/69 tests,
and the real emulator probe for concurrent claim plus expired reclaim. The first typecheck retained a
test-only mutex callback inference error; explicitly typing the release callback fixed it, and the
same fail-fast sequence passed.

## Implemented Firestore LangGraph checkpointer

- `FirestoreCheckpointSaver` directly implements the pinned
  `@langchain/langgraph-checkpoint` 1.2.1 `BaseCheckpointSaver` contract. That already-selected
  transitive package is now an exact direct runtime dependency because the adapter imports its
  public serializer, write-index, and ordering contracts; the dependency record and frozen lockfile
  identify it explicitly.
- `put`, `getTuple`, and `list` preserve run/thread, namespace, checkpoint, parent, schema, system
  bundle, channel-version, and typed serializer identity. Checkpoint IDs are immutable/idempotent,
  listing follows LangGraph's descending ID plus `before`/filter/limit semantics, and malformed or
  bundle-incompatible stored records fail visibly.
- `putWrites` keys logical writes by bundle/namespace/checkpoint/task/write index. Ordinary replay is
  first-write idempotent, special error/scheduled/interrupt/resume slots use LangGraph's negative
  indices and replacement semantics, and returned pending writes use the pinned task-path/task-ID/
  numeric-index comparator.
- `deleteThread` satisfies the abstract interface while deleting only the requested run's checkpoint
  and pending-write subcollections; it leaves the run, events, and unrelated subcollections intact.

Task 3.4 checks passed on 2026-10-25: frozen offline dependency relink, Prettier, ESLint, strict
TypeScript, 14 Vitest files/75 tests, and the real emulator checkpoint round-trip/order/delete probe.
The restricted shell again lacked the workstation's offline metadata for the promoted direct
dependency; the same offline command passed against the actual host cache. Initial static checks
also retained an unused helper/import and a typed metadata-index issue; both were removed/fixed
before the passing sequence.

## Implemented isolated fixtures and guarded reset

- The runtime reset boundary requires an enabled feature, exact `127.0.0.1` requester, exact
  `demo-leadflow-ai-local` project, exact `127.0.0.1:8080` emulator host, and the literal
  `DELETE SYNTHETIC LEADFLOW LOCAL DATA` confirmation before constructing its one fixed emulator
  flush request. Every denial occurs before `fetch`; emulator refusal reports failure without a
  deletion claim.
- Emulator mode construction is now separately testable: ordinary start, isolated exec, runtime
  verification, and explicit export modes receive no implicit retain/import flags. Only explicit
  retain mode adds export-on-exit and imports prior ignored state when its metadata exists.
- The real runtime probe performs a guarded verified flush before fixture creation, runs repository,
  intake, lifecycle, and checkpointer fixtures, performs a final guarded flush, and confirms the
  seeded run and bundle no longer exist. Normal `emulators:exec` still exits without an export.

Task 3.5 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 16 Vitest files/90 tests,
and the real emulator pre/post-flush probe. The first typecheck retained an incorrect local import of
the project-ID constant; importing it from the domain owner fixed the failure before the passing
sequence.

## Implemented deterministic interpreter boundary

- `qualification-projection-v1` carries only the normalized fields needed for qualification and
  excludes consent, provenance, storage, prompt, provider, model, and tool state. Projection from a
  strict stored lead happens before the interpreter boundary.
- `QualificationInterpreter` is bound in Phase 1 to `deterministic-interpreter-v1`. It validates the
  minimum projection, derives a complete disjoint field-evidence partition in stable domain order,
  treats bounded nonblank request text only as presence evidence, and returns the strict
  `qualification-interpretation-v1` contract. Its only dependency is an injectable clock.
- Tests cover full and missing evidence, blank details, consent/provenance exclusion, inert
  control-like text, absence of provider/model/prompt/tool output, and rejection of fields outside
  the projection.

Task 4.1 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, and 17 Vitest files/95
tests. The first typecheck correctly rejected an intentionally extra test field at compile time; the
runtime rejection fixture now uses an explicit boundary cast. A following format check caught that
test edit, and the formatter plus identical fail-fast checks then passed.

## Implemented fixed qualification workflow

- `qualification-graph-v1` compiles one fixed LangGraph sequence:
  `interpretQualification` → `scoreQualification` → `simulateOutcome` → `finalizeRun`. The graph
  has no provider, model, prompt, enrichment, or outbound-tool boundary.
- Strict `qualification-graph-state-v1` state carries only run/lead/request/trace/system-bundle
  identity, the minimum qualification projection, deterministic interpretation/result, synthetic
  simulation, run revision, and finalization state. A stable project-owned public interface prevents
  generated declarations from leaking LangGraph internals.
- Each node records a transactional start plus completion event. Scoring and simulation persist
  their strict result records; finalization transitions the run to `complete`, clears the lease, and
  retains all four completed steps. The graph uses the project-owned durable checkpointer rather
  than in-process state.
- Firestore stores channel-version identities as ordered `{ channel, version }` values rather than
  dynamic map keys. This preserves LangGraph-reserved names such as `__start__` without using
  Firestore-reserved field names.

Task 4.2 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 18 Vitest files/96 tests,
runtime package declaration build, and the real emulator workflow from persisted intake through
claim/reclaim, four nodes, ten graph revisions, twelve event-sequence slots, durable results,
checkpoints, and verified flush. The first unit check queried a non-empty top-level checkpoint
namespace that LangGraph intentionally normalizes to the root namespace; the assertion now follows
the pinned runtime behavior. The first emulator build exposed an inferred internal LangGraph type in
the exported declaration, so the workflow now has a project-owned public interface. A sandboxed
emulator launch again could not bind its hub port; the allowed loopback run then exposed Firestore's
rejection of reserved `__start__` map fields, leading to the lossless ordered channel-version
encoding. The corrected emulator sequence passed.

## Implemented bounded transient retry

- `SyntheticTransientFault` is the sole automatically retryable fault type. The interpretation node
  catches it, transactionally records `step.failed`, transitions through `retrying`, records
  `step.retry_scheduled`, starts attempt two, and never invokes the interpreter a third time.
- A successful second attempt continues the fixed graph with `attempt: 2` and `retryCount: 1` in
  every later event. A second transient failure records both `step.failed` and `run.failed`, clears
  the lease, and ends `failed_retryable` so task 4.4 can expose explicit operator resume.
- Any untyped/unknown interpreter error receives a fixed privacy-safe `unknown_failure` envelope,
  records the failed step and run termination, clears the lease, and ends `failed_terminal` without
  a retry or raw exception text. The same terminal wrapper protects downstream node failures after
  a step has durably started.
- Graph state now includes only the safe error envelope needed for conditional failure routing; a
  failed node routes directly to `END` and cannot start a downstream score/simulation/finalize node.

Task 4.3 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 18 Vitest files/99 tests,
runtime declaration build, and the real emulator retry probe with durable attempts, retry decision,
completion, checkpoints, and verified flush. The first emulator assertion detached Firestore's
`data()` method from its snapshot receiver; calling it on the document fixed the probe, and the
identical emulator sequence passed. The normative durable-workflow spec and operator-flow spec make
exhausted typed transient faults `failed_retryable`; one sentence in the accepted design says
exhaustion is terminal, so the implementation follows the normative scenario and this planning-text
discrepancy remains explicit for the next artifact update.

## Implemented explicit compatible-state resume

- `LifecyclePersistenceService.resume` transactionally rechecks the expected revision, eligible
  `persisted`/`failed_retryable` status, and absence of an active lease before transitioning to
  `running`, claiming a bounded lease, and appending one authorized `run.resume_requested` event.
- `QualificationResumeService` performs read-only rejection checks before mutation. A persisted run
  reconstructs initial graph state from its strict stored lead; a retryable run requires the latest
  durable checkpoint and validates schema, run/lead/bundle identity, revision, unfinished state, and
  exact safe-error agreement before the resume transaction.
- Resume understands the pinned LangGraph `__pregel_tasks` internal channel but strictly parses all
  remaining channel values as `qualification-graph-state-v1`. Missing, malformed, or incompatible
  checkpoints do not change the run or start a graph node.
- Successful resume uses the same fixed workflow and checkpoint thread. Complete, running,
  terminal, stale-revision, missing-run, incompatible-checkpoint, missing-checkpoint, and
  active-lease requests are rejected without mutation.

Task 4.4 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 19 Vitest files/104 tests,
runtime declaration build, and the real emulator twice-failed → compatible-checkpoint → authorized
resume → complete path with verified flush. The first compatible unit fixture exposed LangGraph's
internal `__pregel_tasks` channel beside application state; the resume boundary now excludes that
one pinned internal key before strict state parsing. A lint pass then caught the initially discarded
binding, which was replaced with an explicit copy/delete before the passing sequence.

## Implemented crash-safe recovery exercise

- Intake crash-before-commit and lifecycle event-write failures remain fully transactional: injected
  failures leave neither partial intake records nor a run revision without its matching event.
  Persisted-before-claim work is reconstructable from the strict stored lead.
- Qualification and simulation records now use stable per-run logical identities. Create-only
  persistence reconciles an exact record after an ambiguous commit response, reuses its original
  timestamp on replay, and rejects same-ID content conflicts rather than overwriting them.
- Checkpoint and pending-write persistence similarly reads back the exact immutable record after an
  ambiguous create/set response. Checkpoint conflicts still fail visibly, while LangGraph special
  pending-write slots retain their documented replacement behavior.
- Unit recovery fixtures reconstruct state through a newly instantiated checkpoint saver and prove
  that ambiguous qualification/simulation/checkpoint/pending writes produce one logical effect. The
  real emulator retry/resume probe now constructs a fresh Firestore checkpoint adapter before resume,
  exercising durable restart reconstruction rather than relying on the original adapter instance.

Task 4.5 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 19 Vitest files/110 tests,
and the real isolated Firestore emulator workflow/retry/restart-resume/verified-flush probe.

## Implemented API startup readiness boundary

- API configuration independently validates the loopback listener and `phase-1-local-v1` stateful
  configuration. Stateful readiness requires the exact `demo-leadflow-ai-local` project, exact
  `127.0.0.1:8080` emulator target, and strict reset flag; the safe example now uses the same
  `GCLOUD_PROJECT` name consumed by the runtime boundary.
- Missing or unsafe stateful configuration returns one non-sensitive `invalid_local_configuration`
  state and never constructs Firebase Admin. Valid configuration is copied into the runtime
  boundary rather than passing ambient environment values through.
- The Admin Firestore client applies an explicit validated host/non-SSL override after initialization,
  so even a mismatched ambient SDK setting cannot redirect the client toward cloud Firestore.
  Closing Fastify closes the owned Admin app.
- `GET /health` remains the original process-only schema whether stateful startup is ready or
  unavailable; it makes no emulator connectivity, workflow, model, cloud, deployment, or production
  claim.

Task 5.1 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 19 Vitest files/116 tests,
and the real isolated Firestore emulator boundary/workflow/recovery/verified-flush probe. The first
typecheck rejected `host` in Firebase Admin's deliberately narrow initialization settings; the
supported Firestore client `settings()` override now applies the validated host before any database
operation, and the identical checks plus emulator probe passed.

## Implemented intake HTTP boundary

- `POST /v1/intake` validates the required visible-ASCII `Idempotency-Key` and strict `intake-v1`
  payload before calling persistence. The shared schema normalizes names/test email and rejects real
  contact domains, non-fictional identity class, unknown properties, and invalid field values.
- The API creates bounded UUID request/trace identities and passes that same correlation pair through
  the atomic intake event and optional post-commit processor. The response is emitted only after the
  four-record transaction returns its schema-valid committed identity.
- A new submission returns 202 and may begin processing only after commit. Exact replay returns the
  original identity with 200 and does not start duplicate processing; conflicting key reuse returns
  a fixed 409 response and changes no stored state.
- Invalid input returns a fixed 400, missing stateful readiness and storage failure return a fixed
  503, and no response includes raw backend exceptions or submitted contact/request text. A
  processor failure after commit cannot rewrite the durable success into a false persistence error;
  the stored `persisted`/later run state remains the authority.
- Route construction remains dependency-injected until the combined built emulator-backed API smoke
  is assembled in task 5.6; current server startup therefore fails the stateful route closed unless
  the complete intake runtime is supplied. No cloud or external destination is introduced.

Task 5.2 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 20 Vitest files/123 tests,
the real emulator atomic-intake/correlation/workflow/recovery/verified-flush probe, and the complete
offline gate. The first typecheck caught unknown Fastify error narrowing and exact-optional test
construction; explicit narrowing and omission of the absent option resolved both before the passing
sequence.

## Implemented stored run-detail HTTP boundary

- `RunDetailService` loads the strict run, separate lead, ordered append-only events, and referenced
  qualification/simulation records from Firestore. It rejects missing or cross-run references and
  requires completed runs to retain both durable results.
- A snapshot must contain exactly `nextEventSequence - 1` contiguous events, each matching the run
  and bundle and never exceeding the run revision. Event history is capped at 200 records; oversized
  histories fail visibly rather than being silently truncated.
- The service rereads the run after assembly and rejects any revision or content change, so a poll
  racing workflow progress receives retryable snapshot-unavailable rather than a mixed or fabricated
  state. A successful response carries its own `retrievedAt` timestamp for later stale-state labeling.
- `GET /v1/runs/:runId` validates the UUID before storage, returns the shared bounded response, and
  maps missing, unstable, integrity, unavailable-runtime, and unknown storage states to fixed safe
  404/503 contracts. Contact and request details remain only in the lead object; strict event parsing
  rejects any attempted payload leakage.

Task 5.3 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 22 Vitest files/134 tests,
the complete offline gate, and a real emulator snapshot of the completed run with eleven ordered
events, linked qualification/simulation records, stable revision, and checked event privacy. The
first lint pass caught a mutable-holder declaration in the race fixture; a const holder preserved the
same revision-race test and the corrected sequence passed.

## Implemented explicit resume HTTP boundary

- `POST /v1/runs/:runId/resume` strictly validates the run UUID and a body containing only a
  nonnegative integer `expectedRevision`. The API supplies its own request/trace UUIDs, bounded owner
  identity, fixed five-minute lease request, and recorded `allowed` authorization to the existing
  resume service.
- Eligibility, active-lease, revision, stored-lead, checkpoint compatibility, lifecycle transaction,
  and graph continuation remain owned by the already-tested durable runtime service. The HTTP route
  does not bypass, repair, or waive any rejection.
- A revision-conflict retry returns `replayed: true` only when a fresh strict run-detail snapshot has
  a `run.resume_requested` event at exactly `expectedRevision + 1`. Thus the same logical resume can
  recover its current stored status after a lost response, while an unrelated stale revision stays a
  409 conflict and never starts duplicate execution.
- Missing run, active lease, ineligible state, missing/incompatible checkpoint, stale race, and
  unknown storage failure map to fixed schema-valid 404/409/503 responses without raw error text.

Task 5.4 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 23 Vitest files/144 tests,
the retained real emulator persisted/retry/resume/run-detail probe, and the complete offline gate.

## Implemented optional guarded reset HTTP boundary

- The API registers `DELETE /v1/local-data` only when stateful startup is valid and the strict
  `LEADFLOW_LOCAL_RESET_ENABLED=true` configuration is present. With missing, invalid, or disabled
  configuration the route is absent and no reset dependency can run.
- The strict request schema accepts only the exact synthetic project ID and
  `DELETE SYNTHETIC LEADFLOW LOCAL DATA`; unknown properties are rejected. The caller cannot supply a
  host, URL, collection, database, or other delete target.
- The server adds the actual request IP plus validated loopback emulator host and enabled flag before
  invoking the existing reset function, which independently rechecks every guard and has only one
  fixed emulator flush endpoint. Denial and emulator refusal return safe 403/503 responses and never
  claim deletion.
- The successful response is a strict `local-reset-response-v1` record naming synthetic-local
  evidence, the exact project/host, and confirmed deletion. Runtime emulator verification continues
  to seed records, invoke the same guarded reset, and prove the records are gone.

Task 5.5 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 24 Vitest files/150 tests,
the retained real emulator guarded-reset/verified-flush probe, and the complete offline gate.

## Implemented built emulator-backed API composition and smoke

- `createPhaseOneApiDependencies` composes the validated Admin database into atomic intake,
  lifecycle, durable checkpointer, deterministic interpreter/workflow, stable run detail, and explicit
  resume dependencies. It first requires the named strict system bundle to exist and match the exact
  local synthetic project.
- Server startup optionally reads `LEADFLOW_SYSTEM_BUNDLE_ID`. Only a valid UUID resolving to that
  persisted compatible bundle enables the stateful intake/run/resume routes; missing, invalid,
  malformed, or unavailable bundle state leaves process health available and stateful routes fail
  closed. The example configuration documents the required persisted-record relationship without a
  fabricated bundle ID.
- `pnpm emulator:runtime` now compiles the built API as well as domain/runtime, starts it on an
  ephemeral `127.0.0.1` port, and uses real HTTP with five-second abort timeouts. It checks narrow
  health, invalid test-contact rejection, committed intake, bounded polling to stored completion,
  replay identity, conflicting-key rejection, stored retryable failure, explicit resume and durable
  resume replay, and disabled-reset 404.
- The probe closes the Fastify listener and its separately owned Admin app, confirms the listener is
  no longer active, then performs the guarded emulator flush and verifies runtime, API, retry,
  resume, and system-bundle records are gone. The wrapper always stops the isolated emulator.

Task 5.6 checks passed on 2026-10-25: Prettier, ESLint, strict TypeScript, 24 Vitest files/150 tests,
the complete offline gate, and the built loopback API/emulator end-to-end probe. The first integrated
probe correctly rejected a system-bundle document that an earlier malformed-read fixture had
intentionally corrupted; restoring the validated fixture after that negative assertion made the
identical full probe pass without weakening the strict read or bundle gate.

These slices establish dependency/tool availability, emulator lifecycle, domain contracts,
deterministic rubric/lifecycle/simulator behavior, system identity, the schema-validating Admin SDK
repository boundary, atomic intake/idempotency persistence, transactional lifecycle/leases, and the
pinned Firestore checkpoint contract plus fixed qualification workflow and locally exercised
crash/restart recovery. They do not establish deployed or production behavior. The evaluator still
executes the retained Phase 0 fixture corpus; focused Phase 1 fixtures and independent evaluation
remain task 7.1.

## Implemented responsive operator shell and semantic intake

- The Phase 0 presentation is replaced by the accepted calm operations-dossier workspace: warm
  neutral surfaces, near-black ink, one teal accent, thin borders, quiet motion, and a continuous
  desktop split that stacks in the same semantic order on mobile. The exact
  `SIMULATION · Synthetic leads and outcomes` context remains sticky while scrolling.
- The intake uses the shared `intake-v1` domain schema for local validation. ZIP is separated as the
  only exact field verified from the dated Military.com source; every other input is grouped as a
  LeadFlow demo field with fictional-name and reserved-example-domain guidance.
- Consent is unchecked by default and states that it changes no score and creates or sends no Phase
  1 outreach. Request details state their bounded, non-authoritative role. Validation errors produce
  a focusable summary whose links move focus to the affected native control.
- The adjacent run dossier is intentionally empty and states that no run appears before confirmed
  persistence. It previews the evidence order without inventing lifecycle progress. The local
  validation success state likewise says that nothing has been stored or processed.
- The web package now declares the already-approved domain workspace dependency; the frozen offline
  install linked it without adding an external package.

Task 6.1 checks passed on 2026-10-25: scoped Prettier, ESLint, strict TypeScript, five web tests, and
the production web build. Rendered local review covered the desktop top and validation-error state,
plus the 390×844 top and bottom of the long stacked workspace; document width matched viewport width,
the sticky synthetic strip remained visible, and browser warning/error logs were empty. Submission,
stored run focus, polling, results, and resume remain tasks 6.2–6.3.

## Implemented persisted intake submission

- The browser posts the strict normalized `intake-v1` value to the relative `/v1/intake` boundary
  with a client-generated UUID idempotency key. Vite development and local preview proxy only `/v1`
  to the fixed loopback API default at `127.0.0.1:3001`; the browser still has no Firestore client.
- One logical intake retains the same key through an unchanged retry. Editing the validated content
  creates a new request identity on the next attempt, and a confirmed submission disables duplicate
  storage until the operator starts another intake.
- The client accepts only strict shared success/error response schemas. Network, malformed-response,
  and unexpected client failures become fixed local messages without raw error or submitted-content
  leakage. Failed submission keeps the form values, moves focus to the persistence error, and leaves
  the dossier at `No stored run`.
- A committed or replay-confirmed response replaces the empty state with only the returned run/lead
  identity, revision, timestamp, and synthetic-local evidence label. Focus moves to the run heading
  only after that response; no polling or elapsed-time progress is inferred yet.

Task 6.2 checks passed on 2026-10-25: scoped Prettier, ESLint, strict TypeScript, nine web/client
tests, and the production web build. Rendered local preview review exercised an unavailable API:
the fixed persistence error received focus, the fictional test email remained in the browser, the
run stayed absent, and browser logs contained no warning/error. Successful persisted/replay focus,
identity rendering, disabled duplicate submission, and unchanged-retry key reuse are deterministic
component/client tests; polling and full rendered state coverage remain tasks 6.3–6.4.

## Implemented stored run dossier and recovery controls

- A strict browser run client now polls `GET /v1/runs/:runId` with bounded attempts and a five-second
  request timeout. The view renders only schema-validated stored revisions and retains the last
  confirmed revision with an explicit stale-state notice when a newer read is unavailable.
- The run dossier shows stored status, attempt/retry counts, current step, system bundle, append-only
  lifecycle events, safe failures, and explicit resume only for `persisted` or `failed_retryable`
  runs. Resume posts the visible expected revision and restarts polling after acceptance; a revision
  conflict refreshes stored state rather than guessing progress.
- Completed qualification presents deterministic score, priority, criterion points, field-level
  evidence, missing information, and rubric/interpreter versions as marketing readiness only.
  Integrity holds render no priority.
- Simulation remains a separate panel labeled synthetic and not predictive. It directly identifies
  its evidence class, source run, simulator/seed versions, seed, and simulated lifecycle values.
  Polling does not move focus or announce unchanged event history.

Task 6.3 checks passed on 2026-10-25: scoped Prettier, ESLint, strict TypeScript, 13 focused
web/client tests, and the production web build. Task 6.4 retains the consolidated deterministic UI
state matrix and rendered desktop/390px accessibility inspection.

## Verified essential operator UI states

- One explicit deterministic manifest covers loading, empty, validation error, persistence error,
  in-progress, retrying, partial, retryable failure, terminal failure, complete, stale, and long
  content. Existing intake tests and the consolidated run-dossier suite exercise every named state.
- Polling tests verify that unavailable refresh retains the last confirmed revision and that a
  progressing run can append 40 stored events without moving focus from the operator's control.
  Terminal failure exposes no resume; retryable failure exposes the expected-revision action.
- Development-only query fixtures provide loading, progress, failure, complete, stale, and long
  renderings. They are prominently labeled `NOT STORED`, schema-validate the run payload, and are
  eliminated from the production JavaScript build.
- The rendered complete and long-content flow was inspected in the actual local browser at a
  1280px desktop viewport and 390×844 mobile viewport. Desktop and mobile document scroll width
  matched client width, focus moved to `run-dossier-title` only after fixture persistence, 32-event
  history and simulation provenance remained readable, and the retry action was present in the
  eligible mobile failure state. Browser warning/error logs were empty. The viewport override was
  reset and the temporary loopback development server was stopped after inspection.

Task 6.4 checks passed on 2026-10-25: scoped Prettier, ESLint, strict TypeScript, 21 focused
web/client tests, the production web build, strict OpenSpec validation, and the rendered desktop/
390px inspection above. Reduced-motion and visible-focus rules remain direct stylesheet assertions;
polling focus continuity is a deterministic component test.

## Implemented combined Phase 0 and Phase 1 evaluator

- The fixed corpus is now `phase-1.0` and contains all 24 stable Phase 0 case IDs plus 14 Phase 1
  cases. The formerly deferred `p0-future-agent-runtime` case is retained by ID and upgraded to the
  runnable recovery contract now that retry/checkpoint behavior exists.
- Focused Phase 1 cases independently cover strict fictional/test-contact intake and ZIP-only source
  provenance; persist-before-processing and replay; exact rubric mappings, thresholds, consent
  independence and integrity holds; crash/retry/checkpoint/revision/lease recovery; deterministic
  score-independent simulation; safe telemetry and invalid evidence labels; guarded reset; the
  complete UI state manifest; and bundle freshness.
- Evaluator/report schemas are strict and version every result with dataset, evaluator, synthetic
  evidence, and target scope. Report arithmetic validates that status and scope counts equal the
  total. A deliberately changed bundle digest becomes `stale`; mutated Phase 0 scoring and Phase 1
  recovery canaries fail instead of preserving favorable output.
- The current generated, gitignored report contains 38 cases: 31 `pass`, 0 `fail`, 7 `not_run`, and
  0 `stale`. Target-scope counts are 26 pure-synthetic, 4 local-emulator contracts, 1 rendered-local
  UI contract, and 7 not-run boundaries. The seven unrun cases explicitly cover hosted model/
  provider behavior, live enrichment, cloud Firestore, real personal data, and production readiness.
  The evaluator is deterministic synthetic evidence; current emulator and rendered evidence remain
  separately established by their focused checks and will be rerun together in task 9.1.

Task 7.1 checks passed on 2026-10-25: scoped Prettier, ESLint, strict TypeScript, seven evaluator
self-tests, the evaluator build, one full combined 38-case evaluation, and strict OpenSpec
validation. No provider, paid API, live source, cloud service, real data, or external action ran.

## Implemented privacy-aware lifecycle reporting

- Strict domain `LifecycleReportSchema`/`lifecycle-report-v1` and runtime `createLifecycleReport`
  summarize only strict `event-v1` records from one system bundle. Contact-shaped extra fields,
  mixed bundles, and duplicate run sequences are rejected.
- The report counts each run's latest stored status, events, runs with retry, and safe-error events.
  `stored_run_completion_rate` names complete runs as numerator; complete, `failed_retryable`, and
  `failed_terminal` latest states as denominator; counts active-state exclusions; and reports `null`
  with `insufficient_data` for an empty denominator. Schema refinements enforce rate arithmetic and
  that status, duration, and usage coverage counts equal the run/event totals.
- Duration and usage coverage retain unavailable counts instead of filling values; usage is
  unavailable because no model or paid tool exists. The summary is synthetic local prototype
  evidence, not an SLO, production reliability measure, or conversion metric.
- `AI_OPS.md` now records the combined `phase-1.0` bundle-bound evaluation, lifecycle reporting
  contract, explicit recovery behavior, deferred provider/live-tool boundaries, prototype limits, and
  recheck triggers.

Task 7.2 checks passed on 2026-10-25: scoped Prettier, ESLint with zero warnings, strict TypeScript,
28 Vitest files/174 tests, production builds, and strict OpenSpec validation (5 passed, 0 failed).
Git Bash could not resolve the pnpm shim; the identical commands passed from the PowerShell toolchain
session. The repository is owned by a different Windows account, so Git commands in this session
use a per-command `safe.directory` override; global Git configuration was not changed.

## Implemented architecture evidence and README (tasks 8.1–8.2)

- Owner decision 2026-10-25: rendered views use the diagram-design skill and the README uses the
  showcase method; no Mermaid. `docs/architecture/workspace.dsl` is the unrendered Structurizr model
  (context, containers, API components, persist-before-processing and recovery dynamic views).
- `scripts/generate-diagrams.mjs` with `scripts/diagram-kit.mjs` deterministically renders the
  architecture, sequence, lifecycle, data-model and README principles views from product tokens
  (accent is `--accent-dark` for 4.5:1 contrast) with offline system fonts. It enforces orthogonal
  connectors, label/box separation, text fit, viewBox bounds, 4px grid, and node/arrow/accent
  budgets, and exports SVGs through the skill's `export_svg.py`. `pnpm docs:diagrams` regenerates.
- `pnpm docs:check` (now in `pnpm check`) verifies README links against tracked files, the
  bottom-line figures against the evals corpus and rubric source, diagram/SVG freshness, Structurizr
  element names against the architecture view, data-model collections against runtime paths both
  ways, the ZIP-only/parity research record, and offline Structurizr validation.
- New `pnpm api:local` records the code-bound system bundle in a running emulator and serves the
  API. Before it, the README's interactive path could not work, because the server needs a stored
  bundle that only the probe created.

Checks on 2026-10-25: Prettier, ESLint, typecheck, script tests (18), skill `self_check.py --offline`
(5 files), XML parse, `pnpm docs:check`, and rendered review of every SVG at 1.5x. Live path:
emulator, `pnpm api:local` and the Vite dev server gave intake `202`, replay `200`, and a run that
reached `complete` with score 100 / `high`, 10 events, and `not_live`/`not_predictive` simulation.
Desktop render was inspected, and 390px scroll width equals client width (Playwright). Retained:
a first API start before emulator readiness returned `storage_unavailable` (expected startup
gating), and a stale API process held port 3001 after its shell was stopped. GitHub README/SVG
render review is not possible without a remote and remains open for the publication phase.

## Consolidated branch review (task 9.1)

`/code-review high` on `main...HEAD` (131 files) reported 10 findings. Each was checked against the
code before acting:

- Fixed: a run left `running` after a post-claim crash or failure was unrecoverable, because
  expired-lease reclaim was never wired. Resume now reclaims a `running` run with an expired lease,
  replays from the stored lead, and reports `resumedFrom: lease_reclaim`; the dossier offers resume
  in that state. Tests cover both the reclaim and the refusal while the lease is still active.
- Fixed: Fastify client errors (malformed JSON 400, unsupported media type 415, oversized body)
  were returned as 500 `unknown_failure`; they now keep their 4xx status as `validation_failed`.
- Fixed: the system-bundle source digest crashed on an unstaged tracked-file deletion. Deleted
  files now hash as a marker, and the dirty patch digest still carries the change.
- Fixed: a guarded local reset erased the bundle the API had validated. The API now re-records it.
- Fixed: the intake reset button was enabled during submission, so a late response could
  repopulate a cleared form. It is now disabled while submitting.
- Fixed: lifecycle events always carried `durationMs: null`. Step completion and failure events now
  record durations from the workflow clock, which the lifecycle report consumes.
- Fixed, honesty: emulator-scoped and rendered-scoped eval cases passed by checking declared literals
  that this offline run never measured. They now report `not_run` with the probe that measures them,
  while still failing if their declared contract is inconsistent.
- Narrowed: the resume client timeout rose from 5s to 30s. The resume route still runs the workflow
  inside the request; recheck this when a slower model-backed interpreter is introduced.
- Not applicable in Phase 1: "resume re-runs completed steps". Only interpreter faults are retryable,
  and they occur before any step completes, so checkpoint resumes start at interpretation by
  construction. Reclaim deliberately replays with idempotent, compared result writes.
- Deferred, efficiency: the checkpointer reads whole run subcollections per tuple. This is
  acceptable for emulator-scale synthetic runs; use indexed queries before any cloud or long-run use.

Lead-quality review: `rubric-v1` matches the accepted spec (timeline ≤40, clarity 15/10/5,
completeness 5/5/4×5, consent unscored, mismatched evidence held), and lifecycle metrics name
numerator, denominator and exclusions. No finding.

## External evidence and gates

The dated Military.com research record is `docs/research/military-com-intake-2026-10-24.md`.
Official LangGraph, Firebase, Structurizr, Adoptium, npm, and release metadata supported the
dependency record. Approved artifacts are installed only in local workspace/ignored caches.

The public GitHub remote and the empty Google Cloud project described above now exist. Hosted CI,
deployed Cloud Run service, cloud application data, real personal data, provider credential,
paid/model call, automatic outreach, and production traffic do not exist. Gates not explicitly
resolved in the Phase 3 deployment-gate record above remain unresolved.

## Next action

Review the Phase 3 OpenSpec proposal and draft PR. Once the owner approves the proposal,
implementation can proceed locally on `phase-3-deployment-access-evidence` under the six outcomes in
`openspec/changes/phase-3-deployment-access-evidence/tasks.md`. Cloud actions remain blocked until a
later enumerated approval. Rerun the secret and private-data scans before every push of new material;
hosted CI is not configured.
