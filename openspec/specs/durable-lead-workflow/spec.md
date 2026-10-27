# durable-lead-workflow Specification

## Purpose
TBD - created by archiving change phase-1-intake-qualification. Update Purpose after archive.
## Requirements
### Requirement: Atomic persistence precedes graph execution
The API SHALL atomically create the idempotency record, lead, run, and first append-only
`lead.persisted` event before claiming or invoking a LangGraph workflow.

#### Scenario: Initial transaction commits
- **WHEN** a valid new intake is accepted
- **THEN** all four initial records exist before the first graph node or checkpoint write begins

#### Scenario: Initial transaction fails
- **WHEN** any initial write cannot commit
- **THEN** none of the four records is committed and no graph node is invoked

#### Scenario: Process stops after commit and before graph claim
- **WHEN** the lead transaction commits but execution does not start
- **THEN** the stored run remains inspectable in `persisted` state and can be explicitly resumed

### Requirement: Idempotent intake submission
The API SHALL require a bounded idempotency key and SHALL bind it to the canonical request digest and
the original lead/run identifiers.

#### Scenario: Identical submission is retried
- **WHEN** the same key and canonical intake are submitted again
- **THEN** the API returns the original identifiers without creating duplicate leads, runs, or initial events

#### Scenario: Key is reused for different content
- **WHEN** an existing idempotency key is submitted with a different canonical request digest
- **THEN** the API returns a conflict and changes no stored record

### Requirement: Firestore-owned versioned state
The configured Firestore boundary SHALL be the sole durable application-state authority for
versioned leads, runs, events, checkpoints, pending writes, idempotency, system bundles, simulation,
evidence, draft, review and verification records. Local mode SHALL use only the Firestore Emulator;
hosted mode SHALL use only the accepted Toronto Firestore database through the backend runtime
identity.

#### Scenario: Browser persists a lead
- **WHEN** the browser submits intake in local or hosted mode
- **THEN** it writes through Fastify and has no direct Firebase database client or credential

#### Scenario: Stored record is read
- **WHEN** a repository loads a document
- **THEN** it validates the document's schema version and rejects incompatible or malformed state without normalizing it into success

#### Scenario: Hosted runtime starts
- **WHEN** cloud configuration selects Firestore without the emulator
- **THEN** the repository uses ADC, the exact configured project/database and the runtime identity, or readiness fails closed

### Requirement: Append-only lifecycle events
Every material run transition SHALL append a uniquely identified, monotonically sequenced event in
the same transaction as the run revision change and SHALL never overwrite an existing event.

#### Scenario: Run state changes
- **WHEN** a run is claimed, a step starts/completes/retries/fails, simulation completes, resume is requested, or the run terminates
- **THEN** the new revision and matching event commit together

#### Scenario: Duplicate event is attempted
- **WHEN** an event identifier or sequence is reused
- **THEN** the write fails or resolves idempotently without replacing the original event

### Requirement: Firestore LangGraph checkpoint contract
The project-owned checkpointer SHALL implement the pinned LangGraph.js checkpoint interface for
checkpoint tuples, pending writes, retrieval, and ordered listing using versioned Firestore records.

#### Scenario: Graph step completes
- **WHEN** LangGraph stores a checkpoint and pending writes
- **THEN** the records can reconstruct the same validated thread state, namespace, parent, metadata, and pending-write set after process restart

#### Scenario: Pending write is replayed
- **WHEN** the same task/write index is stored again
- **THEN** the checkpointer resolves it idempotently without duplicating the logical write

#### Scenario: Checkpoint is incompatible
- **WHEN** a run references a missing, malformed, or incompatible checkpoint/schema/bundle
- **THEN** resume fails visibly and no new workflow step runs

### Requirement: Fixed bounded workflow
The runtime SHALL compile one fixed `phase-2-graph-v1` graph containing interpretation, deterministic
scoring, enrichment, draft composition, verification, synthetic simulation, and finalization, with
outbound authority limited to the two authorized enrichment endpoints and no live model or sending
authority.

#### Scenario: Normal run executes
- **WHEN** a persisted run is claimed
- **THEN** nodes execute in the declared order and the stored events/checkpoints expose the observed progress

#### Scenario: Untrusted content requests a tool
- **WHEN** intake text names a URL, command, provider, or send action
- **THEN** the workflow exposes no such tool and performs no outbound action beyond the fixed enrichment requests

#### Scenario: Enrichment does not change the score
- **WHEN** enrichment finds, does not find, or cannot reach a source
- **THEN** the `rubric-v1` points and priority computed before enrichment are unchanged

### Requirement: Concurrency-safe claim and explicit resume
Run execution and resume SHALL use a transactionally checked status, expected revision, and bounded
lease so that only one worker can own a run at a time.

#### Scenario: Concurrent claims race
- **WHEN** two execution attempts claim the same eligible run
- **THEN** one claim succeeds and the other records no duplicate execution or state write

#### Scenario: Recoverable run is resumed
- **WHEN** the operator submits the correct expected revision for a `persisted` or `failed_retryable` run with no active lease
- **THEN** the API records the resume request and continues from compatible durable state

#### Scenario: Ineligible run is resumed
- **WHEN** a complete, running, terminal, stale-revision, or actively leased run is targeted
- **THEN** resume is rejected without changing execution state

### Requirement: One typed transient retry
The workflow SHALL automatically retry only a typed synthetic transient interpreter fault or a
transient enrichment failure (network error, timeout, 429 or 5xx), at most once per interpreter
attempt sequence or per source lookup, and SHALL persist each failed attempt and retry decision.

#### Scenario: First transient attempt fails
- **WHEN** the injected interpreter returns its declared transient fault on attempt one
- **THEN** the run records the failure and retry, then performs exactly one second attempt

#### Scenario: Retry is exhausted
- **WHEN** the second interpreter attempt also returns the transient fault
- **THEN** the run becomes `failed_retryable` with both attempts visible and no silent third attempt

#### Scenario: Enrichment retry is exhausted
- **WHEN** both attempts to one enrichment source fail transiently
- **THEN** that lookup is `unavailable`, both attempts are visible as events, and the run continues

#### Scenario: Non-retryable error occurs
- **WHEN** validation, invariant, storage-contract, or unknown execution failure occurs
- **THEN** the run fails without an automatic retry and preserves a safe error category

### Requirement: Privacy-aware run records
Routine events and run summaries SHALL exclude contact fields, ZIP/vehicle values, raw request text,
prompts, credentials, raw exceptions, and stack traces while retaining correlation, version, status,
duration, attempt, authorization, and safe-error metadata.

#### Scenario: Stored telemetry is inspected
- **WHEN** lifecycle records for normal and failed runs are reviewed
- **THEN** they support progress and failure reconstruction without containing the prohibited payload fields

### Requirement: Guarded local retention and reset
Emulator state SHALL be ephemeral by default, SHALL persist only through an explicit gitignored local
retain command, and SHALL be erasable only through the bounded local reset contract.

#### Scenario: Default emulator stops
- **WHEN** a normal local development or test emulator exits
- **THEN** no export is created automatically

#### Scenario: Reset guard is incomplete
- **WHEN** reset is disabled, non-loopback, uses another project ID, or lacks the exact confirmation phrase
- **THEN** no emulator delete request is sent

#### Scenario: Authorized local reset succeeds
- **WHEN** every local synthetic guard matches and the emulator confirms deletion
- **THEN** all emulator documents are removed and the result is reported without claiming a production deletion

### Requirement: Background execution and asynchronous resume
Local mode SHALL run workflows in the existing in-process background executor after their durable
commit. Hosted mode SHALL NOT continue work after returning the intake response; after the durable
commit it SHALL require an authenticated, idempotent execution request that remains open while the
workflow runs. In both modes, resume SHALL record `run.resume_requested` transactionally and SHALL
use the same revision, lease, checkpoint and idempotency controls.

#### Scenario: Resume is requested
- **WHEN** an eligible local run is resumed with the correct expected revision
- **THEN** the API returns 202 with the committed revision and the workflow continues in the local background executor

#### Scenario: Hosted intake commits
- **WHEN** a new hosted intake transaction succeeds
- **THEN** the API returns 202 with the stored identity and starts no post-response workflow work

#### Scenario: Hosted execution is requested
- **WHEN** the allowed operator submits the stored run and current expected revision to the execution route
- **THEN** the route transactionally claims the run, holds the request while bounded workflow work proceeds, and leaves all progress available to concurrent polling

#### Scenario: Hosted execution is duplicated or interrupted
- **WHEN** another request targets an active/stale/completed revision or the owning request disconnects or reaches its deadline
- **THEN** duplicate effects are rejected or reconciled and the durable run remains inspectable and resumable without being normalized into success

#### Scenario: Process stops during enrichment
- **WHEN** execution stops while a lookup is in flight and the run is later reclaimed
- **THEN** the lookups repeat with new evidence records and the earlier attempt's evidence stays stored and marked superseded

### Requirement: Phase 2 records are versioned and linked
The runtime SHALL store `enrichment-evidence-v1`, `email-check-v1`, `outreach-draft-v1`,
`draft-review-v1`, and `verification-result-v1` records validated on every read and write and linked
from a `run-v2` document, with `event-v2` events for lookups, retries, draft composition or skip,
verification, and reviews whose external-call fields map to OpenTelemetry HTTP attribute names and carry no contact, ZIP,
vehicle, request, or raw-body values.

#### Scenario: Run detail is assembled
- **WHEN** a finished run is read
- **THEN** every linked record exists, validates, and belongs to the run, or the read fails as an integrity error

#### Scenario: Event privacy is checked
- **WHEN** Phase 2 events are inspected
- **THEN** they contain method, server address, status code, error type, and duration but no subject or payload values

### Requirement: Hosted execution deadline preserves recovery
Hosted execution SHALL enforce a workflow deadline shorter than the platform request timeout and
SHALL persist either terminal success/failure or a safe recoverable state before responding wherever
the process remains available to do so.

#### Scenario: Workflow approaches its internal deadline
- **WHEN** the workflow cannot finish within the configured execution budget
- **THEN** it stops new steps, preserves the observed state/failure category, releases or expires ownership safely, and returns a non-success outcome that polling can explain

