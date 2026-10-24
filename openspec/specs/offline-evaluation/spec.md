## Purpose

Define the versioned synthetic evaluation corpus, deterministic invariants, honest outcomes, and
reproducibility identity established in Phase 0.

## Requirements

### Requirement: Versioned synthetic evaluation cases
The evaluation package SHALL store versioned, explicitly synthetic cases with stable identifiers,
cohort labels, expected assertions, applicability, and evidence classification.

#### Scenario: Fixture metadata is validated
- **WHEN** the evaluator loads the Phase 0 dataset
- **THEN** every case has a unique stable ID, schema-valid metadata, and a synthetic evidence label

### Requirement: Deterministic rubric invariants
Runnable Phase 0 cases SHALL enforce criterion bounds of 40, 30, and 30, total equality within
0–100, and rejection of unsupported, non-finite, out-of-range, or inconsistent arithmetic.

#### Scenario: Valid rubric result passes
- **WHEN** criterion values are within their bounds and the total equals their sum
- **THEN** the deterministic rubric assertion passes and describes marketing readiness only

#### Scenario: Invalid rubric result fails
- **WHEN** a criterion is out of range, non-finite, unsupported, or inconsistent with the total
- **THEN** the deterministic assertion fails with the violated invariant

### Requirement: Consent and authority cases
The dataset SHALL encode that false or absent consent produces no outreach draft and that consent
alone can produce only a draft awaiting human approval, never an automatic send.

#### Scenario: Consent is absent
- **WHEN** a consent-denial fixture is evaluated
- **THEN** its expected contract permits no outreach draft or external communication

#### Scenario: Consent is present
- **WHEN** a consent-present fixture is evaluated
- **THEN** its expected contract permits only a draft whose state awaits human approval

### Requirement: Adversarial and unavailable evidence cases
The dataset SHALL include injection, malformed schema, timeout, error, empty enrichment, invalid
event, duplicate event, partial-run, and failed-run cases.

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
The harness SHALL record `pass`, `fail`, or `not_run` per case, SHALL retain failures, and SHALL NOT
report deferred future behavior as passed.

#### Scenario: Implemented assertion succeeds
- **WHEN** a runnable deterministic case satisfies every assertion
- **THEN** the harness records `pass` with the evaluator and fixture revision

#### Scenario: Future capability lacks an implementation
- **WHEN** a case depends on a Phase 1 or later runtime boundary
- **THEN** the harness records `not_run` with a reason rather than manufacturing a result

### Requirement: Evaluation bundle identity
Each evaluation report SHALL identify the code state, Node and pnpm versions, lockfile, schemas,
fixtures, evaluator, configuration, and environment while leaving absent model/provider fields null.

#### Scenario: Local report is generated
- **WHEN** the Phase 0 harness completes
- **THEN** the report is labeled synthetic-local and contains the reproducibility fields without secrets
