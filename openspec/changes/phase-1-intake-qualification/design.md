## Context

Phase 0 left a verified local foundation on `main`: a private pnpm workspace, React/Vite shell,
Fastify API, shared Zod contracts, deterministic evaluation harness, and credential-free offline
quality gate. Phase 1 turns that foundation into the first durable vertical slice. A demo operator
submits a fictional lead, the API commits it before processing, a bounded LangGraph workflow derives
and scores marketing-readiness evidence, and the same interface shows the stored run and its
synthetic outcome record.

The target remains a single-user local prototype. There is no Firebase Auth, remote listener, GCP
resource, hosted model, live enrichment, external communication, real personal information, or
public repository. The operating-system boundary and loopback listeners are the access boundary.

Current Military.com source evidence is intentionally narrow. The public page at
`https://auto.military.com/`, checked read-only on 2026-10-24, exposes an exact `ZIP Code` label and
describes later questions only as broad personal, vehicle, and coverage categories. Phase 1 may call
ZIP source-backed; every other field is a clearly labeled LeadFlow demo field. The parity gate is not
resolved.

The official LangGraph.js persistence interface supports custom `BaseCheckpointSaver`
implementations, but the documented JavaScript savers do not include Firestore. Phase 1 therefore
owns a small Firestore saver and tests it against the interface. Firebase documents emulator-only
Admin SDK routing through `FIRESTORE_EMULATOR_HOST`, loopback reset, and import/export behavior. The
emulator is useful local evidence, not proof of production Firestore indexes, limits, concurrency,
security rules, backup, or recovery.

Peter accepted the Phase 1 decision set on 2026-10-24. The exact dependency versions remain subject
to a compatibility check and frozen lockfile during implementation; no dependency name below claims
that it is already installed.

## Goals / Non-Goals

**Goals:**

- Implement a source-honest, accessible intake and persist a synthetic lead before any graph node
  runs.
- Establish one durable, sequential LangGraph workflow with inspectable checkpoints, lifecycle
  events, bounded retry, explicit resume, and honest terminal failures.
- Freeze and implement `rubric-v1`, including criterion evidence, priority mapping, integrity holds,
  and independent deterministic verification.
- Exercise downstream lifecycle and metric contracts with reproducible synthetic outcomes that make
  no predictive claim.
- Replace the Phase 0 shell with one complete intake-to-run-detail operator flow whose loading,
  empty, partial, failed, complete, long-content, desktop, and 390px states are reviewable.
- Add architecture-as-code and data-model evidence that agree with the implementation and expose
  trust boundaries, persist-before-processing order, and local-only limitations.
- Keep the ordinary gate offline and credential-free after the pinned local tool/dependency
  bootstrap.

**Non-Goals:**

- A live model, provider choice, prompt tuning, paid evaluation, fallback model, or model-quality
  claim.
- Live NHTSA, ZIP, email-domain, insurer, quote, pricing, underwriting, eligibility, or risk
  behavior.
- Enrichment and outreach agents, a human approval queue, email/SMS sending, or any external
  communication.
- Firebase Auth, multiple users, remote access, Cloud Run, hosted CI, public GitHub, or production
  readiness.
- Full Military.com intake or visual parity, private routing/scoring replication, or submission to
  its downstream form.
- A Phase 2 operations dashboard, real conversion attribution, or evidence that the synthetic
  simulator validates the rubric.

## Decisions

### Versioned boundaries and repository shape

- Add `packages/runtime` for the graph, Firestore repositories/checkpointer, deterministic
  interpreter adapter, simulator, and lifecycle service. `packages/domain` remains the source of
  schemas and pure rules; `apps/api` owns HTTP/configuration; `packages/evals` owns independent
  cases and assertions; `apps/web` owns presentation.
- Use independently versioned contracts: `intake-v1`, `lead-v1`, `run-v1`, `event-v1`,
  `checkpoint-v1`, `qualification-interpretation-v1`, `rubric-v1`, `simulator-v1`, and
  `system-bundle-v1`. Schema versions appear in stored documents and API responses.
- Use server-generated UUIDs and UTC timestamps. The browser cannot supply record IDs, lifecycle
  state, evidence class, score, priority, event sequence, bundle ID, or simulation provenance.
- Extend the system bundle with code/dirty-patch identity, lockfile digest, schema/rubric/
  interpreter/graph/checkpointer/simulator/evaluator/configuration versions and environment facts.
  Model, provider, prompt, and live tool-contract fields remain `null` with explicit reasons.

Alternative: put runtime code in `apps/api`. Rejected because the persistence and graph contracts
need direct integration tests and should not be coupled to Fastify route construction.

### Intake field and evidence policy

- The exact source-backed field is `zipCode`, labeled in the UI as verified from the current public
  Military.com landing page with the source/retrieval date available near the label.
- LeadFlow demo fields are `givenName`, `familyName`, `email`, `vehicleYear`, `vehicleMake`,
  `vehicleModel`, `coverageFocus`, `requestIntent`, `needTimeline`, `requestDetails`, and
  `emailContactConsent`. The group label says these are demo fields, not verified Military.com
  questions.
- Development fixtures use fictional names and email addresses under the IANA-reserved
  `example.com`, `example.org`, or `example.net` domains. Local-synthetic mode rejects other email
  domains rather than making it easy to retain accidental real contact details.
- Email consent defaults to false, is never inferred, is not part of the score, and creates no
  outreach object in Phase 1. The field exists to preserve the later hard boundary.
- `requestDetails` is bounded plain text and treated as untrusted data. It cannot alter scoring
  weights, lifecycle authority, evidence labels, or runtime configuration.

Alternative: duplicate plausible insurer fields or automate the downstream Military.com form.
Rejected because the exact questions are not verified and external form submission is not
authorized.

### Persist before processing and idempotent intake

- The browser sends `POST /v1/intake` through Fastify with a required bounded `Idempotency-Key`.
  The server validates the request, normalizes the key to a stored digest, then uses one Firestore
  transaction to create the idempotency record, lead, run, and first append-only
  `lead.persisted` event.
- The HTTP response is emitted only after that transaction commits. A duplicate key with the same
  canonical request digest returns the original IDs; reuse with different content returns a
  conflict. No graph instance exists before the commit succeeds.
- After commit, the API attempts to claim the stored run. A crash between commit and claim leaves an
  inspectable `persisted` run that the operator can resume. It never loses the lead or reports work
  that did not happen.
- Firestore is accessed server-side through the Admin SDK configured for one exact local project ID
  and `127.0.0.1` emulator host. The browser has no Firebase SDK or direct database credentials.

Alternative: write the lead, run, event, and idempotency records separately. Rejected because a
partial write could violate the constitution or make replay ambiguous.

### Firestore ownership and collections

- Use these top-level collections: `leads`, `runs`, `idempotency`, `systemBundles`, and
  `simulationRecords`. Use `runs/{runId}/events`, `runs/{runId}/checkpoints`, and
  `runs/{runId}/checkpointWrites` for append-only history and LangGraph persistence.
- A lead contains normalized intake and source/demo field provenance. A run contains current status,
  revision, execution lease, attempt/retry counts, step summary, result references, safe error, and
  bundle ID. Events contain no contact details, raw request text, prompt, credential, or stack trace.
- Each state-changing transaction increments the run revision and appends a uniquely identified,
  monotonically sequenced event. Existing event documents are never overwritten.
- The custom Firestore checkpointer implements and contract-tests `put`, `putWrites`, `getTuple`,
  and `list`. Checkpoint keys include run/thread ID, namespace, checkpoint ID, schema version, and
  system bundle. Pending writes are idempotent by task/write index.
- Graph state carries record identifiers, normalized qualification inputs, structured evidence,
  score, status, and safe errors. Contact fields and raw free text are read only by the bounded
  interpreter boundary and are not copied into routine events.

Alternative: use the built-in in-memory saver or add SQLite/Postgres beside Firestore. Rejected
because restart recovery is a Phase 1 requirement and two durable authorities would create avoidable
consistency work.

### Sequential workflow, claims, retry, and resume

- Compile one fixed LangGraph `StateGraph` with `interpretQualification`, `scoreQualification`,
  `simulateOutcome`, and `finalizeRun` nodes. It is a workflow, not a general-purpose agent loop; it
  has no model or external-tool authority.
- The first claim of a run is a Firestore transaction that checks allowed status and revision and
  writes a short execution lease plus `run.claimed`. Concurrent starts or resumes cannot both win.
  A stale lease may be reclaimed only through the explicit resume path and is recorded.
- Only a typed, injected `SyntheticTransientFault` from the deterministic interpreter is retryable.
  It receives one automatic retry after an event is persisted. Validation, invariant, contract,
  unknown, and storage errors do not retry silently.
- A recoverable failure ends as `failed_retryable`; an exhausted or non-retryable failure ends as
  `failed_terminal`. `POST /v1/runs/:runId/resume` is idempotent, requires the expected run revision,
  rejects complete/running/terminal runs, and resumes from a compatible stored checkpoint. A missing
  or incompatible checkpoint remains visible and fails safely.
- Reconstruction and test replay use recorded state without repeating external effects. Phase 1 has
  no outbound action, but duplicate persistence, score, simulation, and event writes are still
  prevented.

Alternative: keep retrying a failed node or automatically resume on process start. Rejected because
unbounded retries hide failures and unattended recovery has not been authorized or operationally
designed.

### Deterministic qualification and `rubric-v1`

- The `QualificationInterpreter` interface accepts the minimum intake projection and returns
  `qualification-interpretation-v1`. Phase 1 binds it to a deterministic stub. No prompt or provider
  call exists; provider-dependent evaluation cases remain `not_run`.
- Need timeline contributes 40 points: `within_30_days` 40, `days_31_to_90` 30,
  `over_90_days` 20, `researching` 10, and `not_sure` 0.
- Request clarity contributes 30 points: a declared request intent contributes 15, a declared
  coverage focus contributes 10, and bounded non-blank request details contribute 5. Each positive
  component emits a field-level evidence reference, not model prose.
- Completeness contributes 30 points: given/family name pair 5, test email 5, vehicle year/make/model
  4 each, ZIP 4, and coverage focus 4. Consent contributes zero and cannot affect priority.
- Pure domain code validates criterion maxima, evidence presence, arithmetic, and source fields,
  computes the total, then maps 80–100 to `high`, 50–79 to `standard`, and 0–49 to `nurture`.
  Invalid, contradictory, or unsupported structured evidence produces `priority: null` and an
  integrity hold; it never guesses or asks the model to repair arithmetic.
- Results say `marketing readiness`, include criterion breakdown, missing information, structured
  reasons, rubric version, and the explicit non-insurance boundary. The score is not Military.com's
  score and does not measure eligibility, underwriting, pricing, risk, or financial advice.

Alternative: let a model assign points or infer consent/timeline. Rejected because hard rules and
weights must remain deterministic, and the provider gate is unresolved.

### Synthetic outcome simulator

- `simulator-v1` derives a deterministic seed from the run ID and simulator version, then emits a
  strictly `synthetic` record for contract states such as simulated contact, response, and
  appointment. It performs no communication and uses no external data.
- Outcome selection is independent of the qualification score and priority. This preserves a
  reproducible downstream lifecycle without encoding an unsupported claim that the rubric predicts
  conversion.
- The record carries seed derivation version, fixture class, generated time, source run ID, and
  `not_predictive`/`not_live` notices. The UI never merges it with stored real outcomes or labels it
  as an observed conversion.

Alternative: weight simulated outcomes by score. Rejected because that would manufacture favorable
evidence for the rubric.

### HTTP and local reset surface

- Add schema-validated `POST /v1/intake`, `GET /v1/runs/:runId`, and
  `POST /v1/runs/:runId/resume`. Run detail is assembled from stored records and events; the client
  polls boundedly and stops on terminal state or user navigation.
- Add `DELETE /v1/local-data` only when an explicit local-reset feature flag is enabled, the request
  is loopback, the configured project ID equals the hard-coded synthetic local project, and the body
  repeats the project ID plus `DELETE SYNTHETIC LOCAL DATA`. Otherwise the route is absent or denied.
- The reset uses the emulator's documented endpoint, awaits confirmation, records the command result
  outside the erased database, and never targets a production project. Tests prove all denial paths.

Alternative: expose a generic collection delete or silently clear state on every start. Rejected
because the first is too broad and the second prevents restart/resume inspection.

### Local emulator lifecycle and toolchain

- Pin a compatible `firebase-tools`, Firebase Admin SDK, LangGraph.js/core, and any required peer
  packages during implementation after checking current official metadata. Use no provider SDK.
- Add project-local Java 21 activation alongside the existing Node/pnpm activation. The bootstrap may
  download the pinned Java/emulator/Structurizr tools only during the authorized setup lane; the
  ordinary gate uses installed/cached artifacts without network.
- Normal development starts an empty emulator. An explicitly named retain command imports/exports a
  gitignored `.local/firestore` snapshot. Tests use isolated project IDs and the documented emulator
  flush endpoint so old state cannot contaminate a case.
- Emulator limitations—production indexes, exact transaction contention/limits, security rules,
  backup, restore, and deployed concurrency—remain `not_run` and block production claims.

Alternative: commit emulator exports. Rejected because state is mutable, can contain contact-shaped
fixtures, and is not source code.

### Telemetry, data handling, and lifecycle evidence

- Store append-only lifecycle events with schema version, event name, timestamp, trace/request/run
  IDs, bundle ID, step, status, duration when known, attempt, retry count, authorization result,
  safe error code, and evidence class. Unknown usage stays `null` with a reason.
- Routine events exclude names, email, ZIP, vehicle values, request details, checkpoints, raw
  exceptions, and any future prompt/tool payload. Run-detail APIs return contact data only from the
  lead record and keep it separate from event metadata.
- Synthetic lead retention is local: emulator memory ends at shutdown unless the operator chose the
  gitignored retain command; retained local data remains until reset. This is not an acceptable real-
  data policy and must be reworked before the real-personal-information gate can be resolved.
- The lifecycle stays `prototype`. Persistent state and destructive local reset activate B02/B03/
  B05/B08; the design supplies isolation, idempotency, minimization, guarded deletion, versioning,
  and recovery tests within the local scope.

### Operator interface and visual thesis

- Visual thesis: a calm operations dossier that reads as one continuous piece of work—intake on the
  left, stored evidence and progress on the right—using structure and one restrained accent rather
  than ornamental cards.
- Principles: source labels sit beside the fields they qualify; the persistent
  `SIMULATION · Synthetic leads and outcomes` strip never scrolls out of context; progress follows
  stored events; failures stay visible with a concrete resume action; long evidence is progressively
  disclosed; mobile preserves the same reading order.
- Tokens: warm neutral surfaces, near-black ink, one accessible teal accent, semantic error/warning
  colors, UI sans plus numeric mono, 1px borders, 6–8px radius, no decorative shadows/gradients, and
  quiet motion disabled under reduced motion.
- Rejected direction: a dark military-themed command center. It overstates operational maturity,
  risks visual imitation/cosplay, and makes a short local workflow look denser than it is.
- Submit focus moves to the run heading after the persisted response; errors are summarized and
  linked to fields; polling never steals focus. Desktop uses the split workspace; at 390px it stacks
  intake, state, score, evidence, and simulation without horizontal scrolling.

### Architecture evidence

- Keep `docs/architecture/workspace.dsl` as the canonical Structurizr model with system context,
  container, and persist-before-processing dynamic views. Add a schema ERD and a compact README
  Mermaid overview that agree with the same component and collection inventory.
- Following the showcase/diagram method, each publishable view also has self-contained HTML with
  accessible inline SVG and a checked SVG export. Before the first render, resolve the diagram style
  guide gate and map it to the product tokens. Keep each overview within the diagram complexity
  budget; split context, runtime flow, and ERD rather than crowding them.
- Diagram validation checks source syntax, exports, accessible SVG structure, local links, and drift
  against the architecture component inventory. Rendered diagrams are documentation, not evidence
  that runtime controls passed.

## Security baseline and lifecycle

| Control | Phase 1 disposition and required evidence |
|---|---|
| B01 Secrets and credentials | Required. No application secret or cloud credential exists. Emulator routing uses validated non-secret local configuration; hygiene/error tests prevent credential-shaped values from entering files, events, or responses. |
| B02 Access and isolation | Required. OS boundary plus verified loopback listeners and exact local project ID. No other user/tenant/Auth claim; recheck before remote access or Phase 2 Auth. |
| B03 Tools and action authority | Required for persistent writes and reset. Server-owned IDs, typed contracts, intake idempotency, run claim/revision checks, guarded reset, and replay/denial cases enforce it. |
| B04 Untrusted content | Required. Request details remain data; they have no tool/config path. Injection fixtures verify weights, consent, provenance, and authority remain unchanged. |
| B05 Data handling | Required. Synthetic test contacts only, destination-specific field inventory, minimized graph/event state, gitignored optional retention, and tested reset. Real-data retention/deletion remains gated. |
| B06 Bounded execution and spending | Required. No paid call; one graph, four fixed nodes, one transient retry, bounded polling/timeouts/result sizes, and explicit resume. |
| B07 Correctness and safe failure | Required. Domain-owned schemas/rubric, independent evaluator, integrity holds, unavailable/failed states, and no predictive/parity claim. |
| B08 Change integrity and recovery | Required. Versioned system bundle, checkpoint compatibility, append-only events, crash/retry/resume cases, local reset, frozen dependencies, and version-control rollback. |

## Evaluation and release evidence

- Freeze Phase 1 cases before implementation. Cohorts cover normal, edge, adversarial, and failure
  behavior for intake provenance, validation, idempotency, persist-before-processing, graph order,
  crash points, lease contention, one retry, retry exhaustion, resume, incompatible/missing
  checkpoints, rubric boundaries, priority thresholds, integrity holds, injection, simulator
  reproducibility/independence, event privacy, reset denial, API/UI states, and emulator isolation.
- Deterministic domain and contract assertions must all pass. The full local gate must pass from the
  exact candidate bundle. Provider/model quality remains `not_run`; an LLM judge is not introduced
  for a deterministic stub.
- Evidence statuses remain `pass`, `fail`, `not_run`, or `stale`. Emulator and mock evidence is
  labeled local-synthetic and cannot satisfy GCP, real-data, live-provider, or production gates.
- Code review is required before the phase can be archived or merged. Architecture and UI receive
  rendered review in addition to source checks.

### Non-negotiables check

| PROJECT rule or gate touched | Phase 1 treatment |
|---|---|
| Secrets | No credentials; validated local emulator configuration, filtered errors/events, and tracked-file hygiene remain enforced. |
| Honest results and failed runs | Stored failures/retries/checkpoints remain visible; simulator and evaluator stay synthetic/local; missing live evidence is `not_run`. |
| Operator resolves gates | No gate is treated as resolved by this design. Local implementation proceeds inside the accepted Phase 1 scope. |
| Marketing readiness only | `rubric-v1` and all UI language use marketing readiness and exclude insurance decisions. |
| Fictional identities/test contacts | Local mode accepts documented test contact domains and fixtures only. |
| Persist before agents | Intake transaction commits the lead/run/event/idempotency records before graph claim or execution. |
| Consent and human approval | Consent is recorded, defaults false, is not scored, and produces no Phase 1 outreach. No send capability exists. |
| Backend keys, minimal model data, structured outputs, verified evidence | Browser uses Fastify; no key/model exists; interpreter output and all boundaries are schema-validated. |
| Deterministic rubric | Exact weights, subcriteria, evidence, thresholds, and integrity-hold behavior are versioned and independently checked. |
| Military.com claims | Only ZIP has an exact verified label; all other fields are visibly LeadFlow demo fields; parity gate remains open. |
| Dashboard metrics | Only stored run data and labeled simulator records are shown; no live or conversion claim. |
| Accessible UI | Semantic form/landmarks, labels, error summary, focus handling, keyboard access, reduced motion, and 390px layout are acceptance tests. |
| Paid/API quota gate | No provider/model/paid call or paid design generation. |
| GCP/public exposure gate | Emulator and listeners are local-only; no cloud resource or remote access. |
| Real personal information gate | No real data; the prototype policy is explicitly insufficient for real data. |
| External communication gate | No form submission to Military.com and no email/SMS or other outbound communication. |
| Public GitHub gate | No remote, publication, licence, or `gh` action. |
| Military.com parity gate | Unresolved; the UI and docs explicitly avoid parity language. |

There is no exception to the constitution.

## Risks / Trade-offs

- **[A custom Firestore checkpointer can drift from LangGraph's interface]** → Pin LangGraph, keep
  the adapter small, contract-test every required method and pending-write/idempotency case, and
  block upgrades until those tests pass.
- **[Firestore Emulator differs from production]** → Keep evidence local-synthetic, design within
  documented limits, and retain production index/rules/concurrency/backup checks as `not_run`.
- **[A crash after persistence but before execution leaves a run waiting]** → Preserve `persisted`,
  expose it in run detail, and provide revision-checked explicit resume.
- **[A lease can become stale after process failure]** → Store bounded lease metadata and permit
  only the explicit resume path to reclaim it, with an append-only event.
- **[Optional retained emulator data can become stale or contain accidental real details]** → Default
  to empty/ephemeral state, restrict local mode to test contacts, gitignore exports, display the
  synthetic label, and provide a guarded reset.
- **[A deterministic interpreter is called an agent even though it has no model]** → Describe it as
  a Phase 1 specialist boundary/stub, keep provider fields null, and do not claim model behavior.
- **[The simulator can be mistaken for conversion evidence]** → Make it score-independent, label
  every record/UI surface synthetic and not predictive, and exclude its output from rubric evidence.
- **[One page can become dense on mobile]** → Preserve a strict reading order, progressive evidence
  disclosure, and test real long/failure states at 390px rather than shrinking type.
- **[Java/tool downloads add Windows setup complexity]** → Pin local versions, activate them through
  the existing script, document short paths, cache artifacts, and verify a clean offline reuse path.
- **[Diagram outputs can drift from code]** → Keep one component inventory, derive all views from it
  where practical, validate sources/exports/links, and include diagrams in code review.

## Migration Plan

1. Resolve and pin compatible runtime, Firebase, LangGraph, Java 21, Firebase CLI, and Structurizr
   versions; update the frozen lockfile and local activation/bootstrap documentation.
2. Add domain schemas, `rubric-v1`, simulator contract, system bundle identity, and fixed evaluation
   cases before behavior code.
3. Add the Firestore Emulator configuration and repository/checkpointer contracts; prove isolated
   atomic persistence, event append, idempotency, reset denial, and restart recovery.
4. Implement the fixed graph and deterministic interpreter/simulator; exercise crash, retry,
   exhaustion, and resume paths against stored state.
5. Add Fastify routes and the intake-to-run UI; inspect rendered desktop/390px normal, loading,
   empty, partial, failed, complete, and long-content states.
6. Create and validate the canonical architecture model, self-contained diagram sources/exports,
   ERD, README summary, and Military.com evidence record.
7. Run focused checks, the full offline gate, a clean offline bootstrap/emulator run, and the
   required branch-diff code/domain/UI/architecture review. Preserve failures and resolve findings
   in new commits.

Rollback before merge is version-control reversion plus deleting only the explicitly identified
gitignored local emulator export. A Phase 1 schema is local and synthetic; no cloud or external
effect requires rollback. After merge, incompatible stored local state is reset rather than migrated.

## Open Questions

- None for local Phase 1 implementation. Provider/model/budget, live enrichment, Auth, real-data
  policy, hosted deployment, public publication, external communication, full Military.com parity,
  and production thresholds remain deferred to their explicit gates or later phases.
