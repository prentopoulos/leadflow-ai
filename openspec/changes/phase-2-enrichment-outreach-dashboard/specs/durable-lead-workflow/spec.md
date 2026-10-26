## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Background execution and asynchronous resume
The API SHALL run workflows in an in-process background executor after their durable commit, and the
resume route SHALL return 202 after its transactional `run.resume_requested` commit without awaiting
workflow completion.

#### Scenario: Resume is requested
- **WHEN** an eligible run is resumed with the correct expected revision
- **THEN** the API returns 202 with the committed revision and the workflow continues in the background

#### Scenario: Process stops during enrichment
- **WHEN** the API process stops while a lookup is in flight and the run is later reclaimed
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
