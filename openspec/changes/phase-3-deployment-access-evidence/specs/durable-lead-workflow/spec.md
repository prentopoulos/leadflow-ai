## MODIFIED Requirements

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

### Requirement: Background execution and asynchronous resume
Local mode SHALL run workflows in the existing in-process background executor after their durable
commit. Hosted mode SHALL NOT continue work after returning the intake response; after the durable
commit it SHALL require an authenticated, idempotent execution request that remains open while the
workflow runs. In both modes, resume SHALL record `run.resume_requested` transactionally and SHALL
use the same revision, lease, checkpoint and idempotency controls.

#### Scenario: Local resume is requested
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

## ADDED Requirements

### Requirement: Hosted execution deadline preserves recovery
Hosted execution SHALL enforce a workflow deadline shorter than the platform request timeout and
SHALL persist either terminal success/failure or a safe recoverable state before responding wherever
the process remains available to do so.

#### Scenario: Workflow approaches its internal deadline
- **WHEN** the workflow cannot finish within the configured execution budget
- **THEN** it stops new steps, preserves the observed state/failure category, releases or expires ownership safely, and returns a non-success outcome that polling can explain
