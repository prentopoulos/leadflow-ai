# Current handoff

Read PROJECT.md and current user instructions. Inspect actual Git/OpenSpec state before resuming.

## Current checkpoint

Phase 0 is merged into `main` at merge commit `642f70d`. Phase 1 implementation is in progress on
branch `phase-1-intake-qualification` in OpenSpec change `phase-1-intake-qualification`; planning
commit `ba2a1d8` is the accepted spec baseline. Implementation checkpoint `93c20ec` contains the
verified dependency/toolchain slice. Tasks 1.1–7.2 are implemented and locally verified; 3 of 35
compressed tasks remain. PROJECT.md records Phase 1 as `In progress`.

The accepted Phase 1 boundaries remain:

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

## External evidence and gates

The dated Military.com research record is `docs/research/military-com-intake-2026-10-24.md`.
Official LangGraph, Firebase, Structurizr, Adoptium, npm, and release metadata supported the
dependency record. Approved artifacts are installed only in local workspace/ignored caches.

No GitHub remote, hosted CI, GCP resource, real personal data, provider credential, paid/model call,
live enrichment call, external communication, or public publication was created. All PROJECT.md
gates remain unresolved.

## Next action

Begin task 8.1 by creating the canonical Structurizr context, container,
persist-before-processing/recovery, and ERD views plus the compact README Mermaid summary, following
the diagram-design and showcase skills and matching the implemented runtime, storage, trust, and
deferred-system boundaries. With no remote, there is no draft PR or hosted CI.
