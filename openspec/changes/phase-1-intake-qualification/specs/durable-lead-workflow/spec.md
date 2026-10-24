## ADDED Requirements

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
The local Firestore Emulator SHALL be the sole durable application-state authority for versioned
leads, runs, events, checkpoints, pending writes, idempotency, system bundles, and simulation records.

#### Scenario: Browser persists a lead
- **WHEN** the browser submits intake
- **THEN** it writes through Fastify and has no direct Firebase database client or credential

#### Scenario: Stored record is read
- **WHEN** a repository loads a document
- **THEN** it validates the document's schema version and rejects incompatible or malformed state without normalizing it into success

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
Phase 1 SHALL compile one sequential graph containing interpretation, deterministic scoring,
synthetic simulation, and finalization, with no live model, external tool, enrichment, or outreach
authority.

#### Scenario: Normal run executes
- **WHEN** a persisted run is claimed
- **THEN** nodes execute in the declared order and the stored events/checkpoints expose the observed progress

#### Scenario: Untrusted content requests a tool
- **WHEN** intake text names a URL, command, provider, or send action
- **THEN** the workflow exposes no such tool and performs no outbound action

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
The workflow SHALL automatically retry only a typed synthetic transient interpreter fault, at most
once, and SHALL persist the failed attempt and retry decision.

#### Scenario: First transient attempt fails
- **WHEN** the injected interpreter returns its declared transient fault on attempt one
- **THEN** the run records the failure and retry, then performs exactly one second attempt

#### Scenario: Retry is exhausted
- **WHEN** the second attempt also returns the transient fault
- **THEN** the run becomes `failed_retryable` with both attempts visible and no silent third attempt

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
