# operations-dashboard Specification

## Purpose
TBD - created by archiving change phase-2-enrichment-outreach-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Named metric definitions
The API SHALL serve `metrics-report-v1` computed from stored records under the domain constant
`metrics-definitions-v1`, and every value SHALL name its numerator, denominator, exclusions and
window, scoped to the current system bundle with other bundles counted separately.

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

### Requirement: Evidence classes stay separate
The dashboard SHALL split enrichment metrics by `live` and `recorded`/`mock` evidence, show priority
labels as high, standard, nurture, held and not scored, and show simulator outcomes only in a
separate panel labelled SYNTHETIC.

#### Scenario: Seeded and live runs coexist
- **WHEN** seeded recorded runs and operator-submitted live runs are stored
- **THEN** their enrichment metrics appear separately labelled and are never summed into one live figure

### Requirement: Leads, approval queue and run monitoring
The interface SHALL provide a leads/runs view of cursor-paged stored summaries showing short lead ID,
status, priority, age, retries, evidence completeness, draft state and lease state, with an
approval-queue filter for latest revisions in `pending_review` and a visible path to resume eligible
or expired-lease runs; summaries SHALL contain no contact fields.

#### Scenario: Operator opens the approval queue
- **WHEN** the queue filter is selected
- **THEN** only runs whose latest draft revision is `pending_review` are listed and each opens its dossier

#### Scenario: Run is stuck with an expired lease
- **WHEN** a run is `running` with an expired lease
- **THEN** the monitoring view marks it and offers resume through the existing revision-checked route

### Requirement: Polled live updates
Views SHALL refresh through Fastify by revision-aware polling every 3 seconds, pause while the tab is
hidden, and show `retrievedAt` with a stale label when refreshes fail.

#### Scenario: Refresh fails
- **WHEN** polling fails repeatedly
- **THEN** the last confirmed data stays visible, labelled stale with its retrieval time, and nothing is fabricated

### Requirement: WCAG 2.2 AA dashboard
The dashboard and new views SHALL meet WCAG 2.2 AA at desktop and 390 px: every chart has a text or
table equivalent, no information is conveyed by colour alone, chart marks have 3:1 contrast, focus is
never obscured by the sticky SIMULATION strip, targets are at least 24 px, live regions are polite and
non-chatty, and chart animation is disabled under reduced motion.

#### Scenario: Keyboard user reviews the dashboard
- **WHEN** the dashboard is used by keyboard only at 390 px
- **THEN** every control is reachable with visible, unobscured focus and every chart's data is available as text

#### Scenario: Reduced motion is preferred
- **WHEN** the system prefers reduced motion
- **THEN** charts render without animation

### Requirement: Labelled fictional seed data
`pnpm seed:local` SHALL submit 40 fixed fictional leads through the real API and pipeline with
`recorded` enrichment so that seeded runs are stored with their evidence class and counted separately
from live runs.

#### Scenario: Seed runs twice
- **WHEN** the seed runs again on the same data
- **THEN** idempotency keys prevent duplicate leads and the dashboard counts are unchanged
