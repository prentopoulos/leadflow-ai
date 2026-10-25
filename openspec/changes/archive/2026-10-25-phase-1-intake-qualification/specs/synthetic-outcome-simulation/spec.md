## ADDED Requirements

### Requirement: Reproducible fixed-seed simulation
`simulator-v1` SHALL derive a deterministic seed from the run identifier and simulator version and
SHALL produce the same validated synthetic lifecycle record for the same inputs.

#### Scenario: Simulation is repeated
- **WHEN** the same run ID and simulator version are evaluated more than once
- **THEN** the normalized simulated outcome and seed metadata are identical without duplicate records

#### Scenario: Simulator version changes
- **WHEN** the simulator version changes
- **THEN** the system treats the result as a distinct versioned record and invalidates evidence tied to the older behavior

### Requirement: Simulation is independent of qualification
The Phase 1 simulated contact, response, and appointment states SHALL NOT use score, criterion points,
or priority to select an outcome.

#### Scenario: Qualification changes for one seed
- **WHEN** two simulator invocations use the same declared seed inputs but different scores or priorities
- **THEN** they produce the same simulated lifecycle outcome

### Requirement: Synthetic provenance and non-predictive boundary
Every simulation record and presentation SHALL identify its evidence class as synthetic, name the
simulator/seed versions and source run, and state that it is neither live nor predictive validation.

#### Scenario: Simulation record is stored
- **WHEN** a workflow reaches the simulation node
- **THEN** the stored record includes synthetic provenance and no field implies an observed contact, response, appointment, or conversion

#### Scenario: Operator views the simulation
- **WHEN** run detail renders the outcome summary
- **THEN** the persistent simulation label remains visible and the value is not mixed with live operational metrics

### Requirement: Simulator has no outbound authority
The simulator SHALL be a pure deterministic function plus an idempotent local persistence step and
SHALL expose no email, SMS, insurer, browser, model, enrichment, or arbitrary network tool.

#### Scenario: Simulated contact is true
- **WHEN** the synthetic result includes a contacted state
- **THEN** no message, request, or external side effect occurs

### Requirement: Synthetic funnel metrics name their contract
Any metric derived from simulation records SHALL name its numerator, denominator, exclusions,
window, minimum count, and synthetic evidence class; an empty denominator SHALL be unknown rather
than zero or perfect.

#### Scenario: No eligible simulation records exist
- **WHEN** a synthetic metric is calculated over an empty set
- **THEN** its value is null with an insufficient-data reason

#### Scenario: Failed runs are excluded from a stage rate
- **WHEN** a displayed rate excludes failed or incomplete runs
- **THEN** the metric reports those exclusions and its full denominator definition
