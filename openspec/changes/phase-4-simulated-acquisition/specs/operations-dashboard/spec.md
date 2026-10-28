## MODIFIED Requirements

### Requirement: Named metric definitions
The API SHALL serve `metrics-report-v2` computed from stored records under the domain constant
`metrics-definitions-v2`, and every value SHALL name its numerator, denominator, exclusions and
window, scoped to the current system bundle with other bundles counted separately. Version 2 keeps
every version 1 definition and adds a synthetic acquisition block.

#### Scenario: Enrichment success is calculated
- **WHEN** stored lookups include found, not found, unavailable and not attempted outcomes
- **THEN** success is (found + not found) / attempted, unavailable counts as a failure, not attempted is excluded and counted, and the found-rate is reported separately

#### Scenario: Processing time is calculated
- **WHEN** finished and active runs exist and some drafts have been reviewed
- **THEN** processing time runs from `lead.persisted` to the last automated event with median, p90, mean and n; active runs are excluded and counted; and review latency is reported separately

#### Scenario: Agent failures are calculated
- **WHEN** runs finished as complete (with full or partial evidence), failed_retryable and failed_terminal exist, some after a recovered retry
- **THEN** the failure rate is failed runs over finished runs (complete, failed_retryable and failed_terminal) with a per-step breakdown, and recovered retries are not failures

#### Scenario: Denominator is empty
- **WHEN** a metric has no qualifying records
- **THEN** its value is `null` with reason `insufficient_data`, never zero

#### Scenario: Window is too large
- **WHEN** more than 2,000 runs fall in the window
- **THEN** the report returns a visible `window_exceeded` error instead of a truncated result

#### Scenario: Acquisition block is served
- **WHEN** the report is requested
- **THEN** it includes the acquisition block with `evidenceClass: "synthetic"`, the spend fixture and channel-rules versions, and cost values computed in integer cents

### Requirement: Labelled fictional seed data
`pnpm simulate:traffic` SHALL replace `pnpm seed:local` and submit the fixed fictional
`traffic-plan-v1` leads through the real API and pipeline at a steady pace with `recorded`
enrichment, so that simulated runs are stored with their evidence class and attribution and counted
separately from live runs.

#### Scenario: Seed runs twice
- **WHEN** the simulator runs again on the same data
- **THEN** idempotency keys prevent duplicate leads and the dashboard counts are unchanged

## ADDED Requirements

### Requirement: Simulated acquisition section
The operations workspace SHALL give acquisition its own tab, with the simulated-traffic control
first, then headline blended-CPL and cost-per-qualified-lead tiles with n, spend and planned-lead
progress, a per-channel table that is the text equivalent of a horizontal CPL-by-channel bar chart,
a campaign table behind a disclosure, and the definitions, channel-rules and independence notes
behind a disclosure, meeting the existing WCAG 2.2 AA dashboard requirement at desktop and 390 px.
Pipeline and enrichment metrics SHALL sit on their own tabs. The persistent page-level SIMULATION
strip SHALL be the single simulation label; values below it are not tagged individually (owner,
2026-10-27).

#### Scenario: Operator reads the section
- **WHEN** simulated leads are stored
- **THEN** every acquisition value sits under the persistent SIMULATION strip and is never mixed into the operational metrics

#### Scenario: Keyboard and reduced-motion user
- **WHEN** a keyboard user with reduced motion reaches the chart at 390 px
- **THEN** the chart has a focusable explanatory frame, direct value labels, no colour-only encoding, 3:1 marks and no animation

### Requirement: Dossier attribution block
The run dossier SHALL show an "Acquisition" block, under the SIMULATION strip, with channel, source and medium,
campaign and click ID, or "Unattributed" when the lead has no attribution.

#### Scenario: Unattributed lead is opened
- **WHEN** the operator opens a lead submitted through the intake form
- **THEN** the block reads Unattributed and shows no click ID
