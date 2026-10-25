# Current handoff

Read PROJECT.md and current user instructions. Inspect actual Git/OpenSpec state before resuming.

## Current checkpoint

Phase 0 is merged into `main` at merge commit `642f70d`. Phase 1 implementation is in progress on
branch `phase-1-intake-qualification` in OpenSpec change `phase-1-intake-qualification`; planning
commit `ba2a1d8` is the accepted spec baseline. Implementation checkpoint `93c20ec` contains the
verified dependency/toolchain slice. Tasks 1.1–3.2 are implemented and locally verified; 34 of 46
tasks remain. PROJECT.md records Phase 1 as `In progress`.

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

These slices establish dependency/tool availability, emulator lifecycle, domain contracts,
deterministic rubric/lifecycle/simulator behavior, system identity, the schema-validating Admin SDK
repository boundary, and atomic intake/idempotency persistence only. They do not yet establish
transactional later lifecycle events/claims, LangGraph execution/checkpoint compatibility, the
Phase 1 API/UI, diagrams, or production behavior. The evaluator still executes the retained Phase 0
fixture corpus; Phase 1 fixtures and independent evaluation remain tasks 7.1–7.3.

## External evidence and gates

The dated Military.com research record is `docs/research/military-com-intake-2026-10-24.md`.
Official LangGraph, Firebase, Structurizr, Adoptium, npm, and release metadata supported the
dependency record. Approved artifacts are installed only in local workspace/ignored caches.

No GitHub remote, hosted CI, GCP resource, real personal data, provider credential, paid/model call,
live enrichment call, external communication, or public publication was created. All PROJECT.md
gates remain unresolved.

## Next action

Begin task 3.3 with transactionally revised append-only events and execution lease/claim/reclaim
behavior, including monotonic sequence, duplicate, stale revision, concurrent claim, and expired
lease tests. With no remote, there is no draft PR or hosted CI.
