## ADDED Requirements

### Requirement: Deterministic structured interpreter boundary
The qualification specialist SHALL use a versioned `QualificationInterpreter` contract and SHALL
bind Phase 1 to a deterministic local stub that returns validated field-level evidence without a
provider, model, prompt, or external call.

#### Scenario: Interpreter evaluates a valid lead
- **WHEN** the workflow supplies the minimum qualification projection
- **THEN** the stub returns `qualification-interpretation-v1` evidence derived only from the supplied normalized fields

#### Scenario: Provider evidence is requested
- **WHEN** the system bundle and evaluation report are generated
- **THEN** provider/model/prompt values remain null and provider-dependent cases remain `not_run` with a reason

### Requirement: Versioned need-timeline criterion
`rubric-v1` SHALL assign need-timeline points only from the declared enum: `within_30_days` 40,
`days_31_to_90` 30, `over_90_days` 20, `researching` 10, and `not_sure` 0.

#### Scenario: Every timeline value is scored
- **WHEN** each allowed enum is evaluated
- **THEN** the result matches the fixed mapping and any positive value cites the `needTimeline` field evidence

#### Scenario: Timeline evidence is absent or invalid
- **WHEN** structured evidence cannot establish an allowed value
- **THEN** no unsupported timeline points are awarded

### Requirement: Versioned request-clarity criterion
`rubric-v1` SHALL assign 15 points for a declared request intent, 10 for a declared coverage focus,
and 5 for bounded non-blank request details, with field-level evidence for every positive component.

#### Scenario: All clarity components are present
- **WHEN** intent, coverage focus, and qualifying details are present
- **THEN** request clarity is 30 with evidence for all three inputs

#### Scenario: Details contain only whitespace
- **WHEN** intent and coverage are absent and request details normalize to blank
- **THEN** request clarity is 0 with no fabricated evidence

### Requirement: Versioned completeness criterion
`rubric-v1` SHALL assign 5 points for the given/family name pair, 5 for a valid test email, 4 each for
vehicle year/make/model, 4 for ZIP, and 4 for coverage focus, for a maximum of 30; consent SHALL
contribute zero.

#### Scenario: Complete lead is evaluated
- **WHEN** every listed completeness field is valid
- **THEN** completeness is 30 and each component has a field-level evidence reference

#### Scenario: Consent changes
- **WHEN** otherwise identical leads differ only in email-contact consent
- **THEN** their completeness, total, and priority are identical

### Requirement: Independently enforced arithmetic and evidence
Pure domain code SHALL validate criterion bounds of 40/30/30, require evidence for positive points,
sum a total from 0–100, and reject non-finite, inconsistent, unsupported, or extra values.

#### Scenario: Interpreter supplies inconsistent arithmetic
- **WHEN** candidate points exceed a maximum, lack evidence, are non-finite, or do not sum to the total
- **THEN** deterministic validation rejects the candidate before a priority is assigned

#### Scenario: Valid boundary totals are scored
- **WHEN** total inputs evaluate to 0 or 100
- **THEN** both results validate with exact criterion sums

### Requirement: Owner-approved priority mapping and integrity hold
The system SHALL map validated totals 80–100 to `high`, 50–79 to `standard`, and 0–49 to `nurture`;
invalid or unsupported evidence SHALL produce `priority: null` and an integrity hold.

#### Scenario: Priority thresholds are crossed
- **WHEN** validated totals of 49, 50, 79, and 80 are evaluated
- **THEN** their priorities are `nurture`, `standard`, `standard`, and `high` respectively

#### Scenario: Integrity validation fails
- **WHEN** qualification evidence violates a hard invariant
- **THEN** no priority is guessed and the run/result exposes the integrity hold or failure

### Requirement: Explainable non-insurance result
Every qualification result SHALL identify itself as marketing readiness, include criterion points,
structured reasons, missing information, priority or hold, rubric/interpreter versions, and SHALL
exclude eligibility, underwriting, pricing, risk, quote, or personal-financial-advice claims.

#### Scenario: Operator views a completed result
- **WHEN** run detail renders qualification
- **THEN** the operator can trace each positive point and missing-information item to stored structured evidence

#### Scenario: Result wording is reviewed
- **WHEN** API, UI, fixture, and documentation text are inspected
- **THEN** none describes the score as a Military.com or insurance decision score

### Requirement: Qualification evidence is independently evaluated
The evaluation package SHALL compute expected criterion points, totals, priorities, missing fields,
and hold outcomes independently of the workflow implementation on fixed normal, edge, adversarial,
and failure fixtures.

#### Scenario: Runtime score is compared with fixture truth
- **WHEN** a Phase 1 qualification case completes
- **THEN** the evaluator compares every subcriterion, total, evidence invariant, and priority against the predeclared expected result
