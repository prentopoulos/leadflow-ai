## Purpose

Define the versioned synthetic evaluation corpus, deterministic invariants, honest outcomes, and
reproducibility identity established in Phase 0.
## Requirements
### Requirement: Versioned synthetic evaluation cases
The evaluation package SHALL store versioned, explicitly synthetic Phase 0 and Phase 1 cases with
stable identifiers, cohort labels, expected assertions, applicability, evidence classification, and
the system-bundle components required to reproduce each runnable result.

#### Scenario: Fixture metadata is validated
- **WHEN** the evaluator loads the Phase 1 dataset
- **THEN** every case has a unique stable ID, schema-valid normal/edge/adversarial/failure cohort, synthetic evidence label, and declared requirement

#### Scenario: Existing Phase 0 coverage is retained
- **WHEN** the combined corpus is inspected
- **THEN** every Phase 0 invariant remains represented or has an explicit versioned replacement with equal or stronger coverage

### Requirement: Deterministic rubric invariants
Runnable cases SHALL independently enforce `rubric-v1` subcriterion mappings, criterion bounds of
40/30/30, evidence requirements, exact total equality within 0–100, priority thresholds, consent
non-influence, and integrity holds for unsupported, non-finite, out-of-range, extra, or inconsistent
values.

#### Scenario: Valid rubric result passes
- **WHEN** all subcriteria, evidence, total, and priority match the predeclared fixture truth
- **THEN** the deterministic assertions pass and describe marketing readiness only

#### Scenario: Invalid rubric result fails
- **WHEN** any mapping, bound, evidence, total, priority, or consent-independence invariant is violated
- **THEN** the deterministic assertion fails with the exact violated rule

#### Scenario: Threshold boundaries are evaluated
- **WHEN** totals of 49, 50, 79, and 80 are scored
- **THEN** the expected priorities are `nurture`, `standard`, `standard`, and `high`

### Requirement: Consent and authority cases
The dataset SHALL continue to encode that false or absent consent produces no outreach draft/action,
that consent true cannot send or alter qualification, and that untrusted text cannot change rubric,
provenance, authority, retry, reset, or evidence labels.

#### Scenario: Consent is absent
- **WHEN** a consent-denial fixture is evaluated
- **THEN** its expected contract permits no outreach object or external communication

#### Scenario: Consent differs between equal leads
- **WHEN** otherwise identical leads differ only in consent
- **THEN** their score and priority expectations remain identical

#### Scenario: Consent is present
- **WHEN** a consent-present fixture is evaluated
- **THEN** its expected contract permits only a draft whose state awaits human approval

### Requirement: Adversarial and unavailable evidence cases
The dataset SHALL include malformed schemas, invalid source labels, duplicate/idempotency conflicts,
crash-before/after boundaries, lease races, typed transient retry/exhaustion, non-retryable error,
missing/incompatible checkpoint, stale revision, partial/failed run, reset denial, telemetry leakage,
emulator isolation, long content, and stale run-detail cases.

#### Scenario: Persistence boundary is evaluated
- **WHEN** a fixture injects failure before commit, after commit before graph claim, or during a graph step
- **THEN** expected records prove no agent-before-persist violation and retain the observed partial/failure state

#### Scenario: Duplicate work is attempted
- **WHEN** intake, event, pending-write, simulation, claim, or resume behavior is replayed
- **THEN** expected assertions reject or idempotently reconcile duplicates without losing the original record

#### Scenario: Required state is unavailable
- **WHEN** checkpoint, emulator response, or stored revision is missing, stale, malformed, or incompatible
- **THEN** the expected outcome is unavailable/failed/held rather than a fabricated success

#### Scenario: Injection content is evaluated
- **WHEN** fixture content instructs the system to change rubric weights, consent, authority, or evidence labels
- **THEN** the expected hard constraints remain unchanged

#### Scenario: External evidence is unavailable
- **WHEN** a fixture represents timeout, error, or an empty source response
- **THEN** the expected status is unavailable or failed rather than a negative or successful fact

#### Scenario: Run progress is incomplete
- **WHEN** a fixture represents partial progress, duplicate events, an invalid transition, or agent failure
- **THEN** the expected record preserves the condition and does not normalize it into success

### Requirement: Honest evaluation outcomes
The harness SHALL record `pass`, `fail`, `not_run`, or `stale` per case, SHALL retain failures and
declared cases, and SHALL NOT report deferred provider, live-source, cloud, real-data, or production
behavior as passed.

#### Scenario: Implemented assertion succeeds
- **WHEN** a runnable deterministic/local-emulator case satisfies every assertion
- **THEN** the harness records `pass` with evaluator, fixture, bundle, and evidence-scope revisions

#### Scenario: Provider case lacks authorization and implementation
- **WHEN** a case depends on a hosted model or paid provider
- **THEN** the harness records `not_run` with the unresolved gate and reason

#### Scenario: Bundle-bearing input changes
- **WHEN** code, lockfile, schema, rubric, interpreter, graph, checkpointer, simulator, configuration, or evaluator changes after evidence was recorded
- **THEN** affected prior evidence is `stale` until rerun

#### Scenario: Future capability lacks an implementation
- **WHEN** a case depends on a later-phase or unauthorized runtime boundary
- **THEN** the harness records `not_run` with a reason rather than manufacturing a result

### Requirement: Evaluation bundle identity
Each report SHALL identify code/dirty-patch state, Node/pnpm/Java and local tool versions, lockfile,
source, schema, rubric, interpreter, graph, checkpointer, simulator, fixtures, evaluator,
configuration, and environment while leaving absent model/provider/prompt/live-tool fields null with
a reason.

#### Scenario: Local report is generated
- **WHEN** the combined local harness completes
- **THEN** the report is labeled synthetic-local, carries the complete bundle identity without secrets, and separates pure, emulator, UI, and not-run evidence

### Requirement: Simulator correctness and limits
The evaluator SHALL independently verify fixed-seed reproducibility, idempotent storage, score/
priority independence, synthetic provenance, no outbound action, and null handling for empty metric
denominators.

#### Scenario: Simulator is compared across qualification results
- **WHEN** fixtures hold seed inputs constant and vary qualification
- **THEN** the simulator outcome remains unchanged and no predictive relationship is reported

### Requirement: UI contract fixtures
The evaluation/test corpus SHALL provide deterministic states for loading, empty, validation error,
persistence error, in-progress, retrying, partial, retryable failure, terminal failure, complete,
stale, and long-content rendering.

#### Scenario: Declared UI states are compared
- **WHEN** the web tests enumerate the Phase 1 state fixture manifest
- **THEN** every declared state is rendered and asserted rather than omitted through handpicked screenshots

