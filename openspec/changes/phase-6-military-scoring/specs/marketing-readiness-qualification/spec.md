## REMOVED Requirements

### Requirement: Deterministic structured interpreter boundary
**Reason**: `rubric-v2` scores only structured Military.com answers; no free-text input is
interpreted.
**Migration**: The interpreter contract, stub and its evaluation cases are deleted; the system
bundle drops the interpreter version.

### Requirement: Versioned need-timeline criterion
**Reason**: Military.com does not ask for a need timeline; the question is removed from the intake.
**Migration**: Replaced by the `rubric-v2` criteria below.

### Requirement: Versioned request-clarity criterion
**Reason**: Request intent, coverage focus and request details are removed from the intake.
**Migration**: Replaced by the `rubric-v2` criteria below.

## MODIFIED Requirements

### Requirement: Versioned completeness criterion
`rubric-v2` SHALL score lead quality from the Military.com answers only, in five criteria that sum
to 100: contactability 25, coverage situation 25, vehicles 15, driving record 25 and profile 10,
with the component points in design.md "Rubric v2 points" as approved by the owner. Email consent
SHALL contribute zero.

#### Scenario: Complete lead is evaluated
- **WHEN** every Military.com answer is present with its best-scoring value
- **THEN** each criterion reaches its maximum, the total is 100 and every positive component cites its answer

#### Scenario: Consent changes
- **WHEN** otherwise identical leads differ only in email-contact consent
- **THEN** their criteria, total and priority are identical

#### Scenario: An answer is skipped
- **WHEN** a Military.com answer is blank
- **THEN** its component scores zero and the answer is listed as missing information

### Requirement: Independently enforced arithmetic and evidence
Pure domain code SHALL validate criterion bounds of 25/25/15/25/10, require evidence for positive
points, sum a total from 0–100, and reject non-finite, inconsistent, unsupported, or extra values.

#### Scenario: Inconsistent arithmetic
- **WHEN** candidate points exceed a maximum, lack evidence, are non-finite, or do not sum to the total
- **THEN** deterministic validation rejects the candidate before a priority is assigned

#### Scenario: Valid boundary totals are scored
- **WHEN** total inputs evaluate to 0 or 100
- **THEN** both results validate with exact criterion sums

### Requirement: Explainable non-insurance result
Every qualification result SHALL identify itself as lead quality for marketing follow-up, include
criterion points, structured reasons, missing information, priority or hold and the rubric version,
and SHALL exclude eligibility, underwriting, pricing, quote or personal-financial-advice claims.
Driving-record answers MAY add points; the result SHALL NOT state or imply that a lead is insurable,
uninsurable or priced.

#### Scenario: Operator views a completed result
- **WHEN** run detail renders qualification
- **THEN** the operator can trace each positive point and missing item to the Military.com answer behind it

#### Scenario: Result wording is reviewed
- **WHEN** API, UI, fixture and documentation text are inspected
- **THEN** none describes the score as a Military.com, insurer, eligibility or price decision

### Requirement: Qualification evidence is independently evaluated
The evaluation package SHALL compute expected criterion points, totals, priorities, missing answers
and hold outcomes for `rubric-v2` independently of the workflow implementation on fixed normal,
edge, adversarial and failure fixtures.

#### Scenario: Runtime score is compared with fixture truth
- **WHEN** a qualification case completes
- **THEN** the evaluator compares every criterion, total, evidence invariant and priority against the predeclared expected result
