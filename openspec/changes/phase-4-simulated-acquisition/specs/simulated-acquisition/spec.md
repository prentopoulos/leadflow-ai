## ADDED Requirements

### Requirement: Synthetic attribution on the lead
The system SHALL store an optional, strictly validated `attribution` object on each lead with
lowercase-slug `source`, `medium` and `campaign` and a nullable synthetic click ID, SHALL derive
the channel on read from `channel-rules-v1`, and SHALL never accept a client-supplied channel.

#### Scenario: Simulated lead carries attribution
- **WHEN** an `intake-v3` submission includes a valid attribution object
- **THEN** the stored lead contains the normalized attribution and reads report the channel from `channel-rules-v1`

#### Scenario: Lead has no attribution
- **WHEN** a lead is submitted with `attribution: null`
- **THEN** it is stored and counted under Unattributed

#### Scenario: Attribution is malformed
- **WHEN** attribution has an unknown key, a channel field, an uppercase or overlong value, or characters outside the slug pattern
- **THEN** validation fails before any record is created

### Requirement: Synthetic click IDs only
A click ID SHALL be `sim-` followed by 20 lowercase hexadecimal characters with
`clickIdClass: "synthetic"`, SHALL be shown only in the run dossier, and SHALL never appear in run
summaries, metrics, events or logs.

#### Scenario: Real-looking click ID is submitted
- **WHEN** attribution carries a gclid- or fbclid-shaped value or any value without the `sim-` format
- **THEN** validation fails and nothing is stored

#### Scenario: Operator opens a simulated paid lead
- **WHEN** the run dossier renders a paid-search or paid-social lead
- **THEN** the click ID appears in the "Acquisition (simulated)" block and in no other view or record

### Requirement: Versioned channel rules
`channel-rules-v1` SHALL map source and medium to Direct, Paid Search, Paid Social, Email,
Affiliates, Organic Search or Unassigned in a fixed order, SHALL label leads without attribution
Unattributed, and the interface SHALL state that the rules are adapted from GA4's default channel
group and are not GA4 data.

#### Scenario: Paid search lead is classified
- **WHEN** attribution is `google` / `cpc`
- **THEN** the channel is Paid Search

#### Scenario: No rule matches
- **WHEN** attribution is present but matches no rule
- **THEN** the channel is Unassigned, distinct from Unattributed

### Requirement: Labelled synthetic spend fixture
`synthetic-spend-v1` SHALL be a checked-in versioned fixture of flight spend per simulated campaign
in non-negative integer simulated-USD cents, labelled "simulated, illustrative, not a benchmark",
whose every campaign maps under `channel-rules-v1` to its declared channel.

#### Scenario: Fixture is inconsistent
- **WHEN** a fixture entry has negative or fractional cents, a duplicate campaign, or a channel that disagrees with the rules
- **THEN** the fixture check fails

### Requirement: Cost per lead and per qualified lead
The metrics report SHALL compute blended, per-channel and per-campaign cost per lead and cost per
marketing-qualified lead from stored leads of the current system bundle and the spend fixture,
naming numerator, denominator, exclusions and window, where a qualified lead's latest
qualification priority is `high` or `standard`.

#### Scenario: Blended CPL is calculated
- **WHEN** stored leads include attributed, unattributed and failed-run leads
- **THEN** blended CPL is total fixture spend over all persisted leads in the window, and the unattributed and failed counts are reported

#### Scenario: Qualified leads are counted
- **WHEN** leads are high, standard, nurture, held and not scored
- **THEN** only high and standard leads count as qualified and the label reads "marketing-qualified (high or standard readiness)"

#### Scenario: Channel has no spend
- **WHEN** a channel or campaign has zero fixture spend
- **THEN** its CPL reports `no_spend` and displays "n/a, no spend", never zero

#### Scenario: Denominator is empty
- **WHEN** a channel has no leads or no qualified leads
- **THEN** the value is `null` with `insufficient_data`

#### Scenario: Flight is in progress
- **WHEN** fewer than the planned 60 leads are stored
- **THEN** the report gives planned and stored lead counts and the view shows "k of 60 planned leads stored"

### Requirement: Seeded traffic plan independent of lead content
`traffic-plan-v1` SHALL be a pure deterministic plan of 60 fictional leads using only recorded
enrichment subjects, with attribution assigned by a seeded permutation that does not depend on lead
content, and the view SHALL state that channel differences reflect simulated spend and random
assignment, not channel quality.

#### Scenario: Plan is generated twice
- **WHEN** the plan is generated again for the same version
- **THEN** every lead, attribution and click ID is identical

#### Scenario: Lead content changes
- **WHEN** lead content for an index changes while the plan seed is unchanged
- **THEN** that index keeps the same attribution

### Requirement: Paced local traffic simulator
`pnpm simulate:traffic` SHALL submit the plan through the real local API at a fixed interval
(default 10 s, 0–60 s allowed, at most 60 leads), SHALL refuse unless the running system bundle is
in `recorded` enrichment mode, and SHALL use per-bundle idempotency keys so a rerun adds no leads.

#### Scenario: Simulator runs against live enrichment
- **WHEN** the running API is in live enrichment mode
- **THEN** the simulator submits nothing and exits with a clear error

#### Scenario: Simulator runs twice
- **WHEN** the simulator runs again against the same system bundle
- **THEN** every submission is replayed, no lead is added and the dashboard counts are unchanged

#### Scenario: Drafts are created
- **WHEN** simulated leads with consent complete their runs
- **THEN** their drafts wait in `pending_review` and nothing is sent

### Requirement: Owner-triggered hosted traffic control
In hosted mode only, the signed-in interface SHALL offer a "Run simulated traffic" control that
runs the same plan sequentially through intake and the existing held execution request, labelled
SIMULATED, with Stop, pausing while the tab is hidden, and SHALL add no credential, IAP setting,
server-side loop or unattended run.

#### Scenario: Owner starts and stops traffic
- **WHEN** the owner starts the control and later presses Stop
- **THEN** no further lead is submitted after the in-flight one, and stored progress remains visible

#### Scenario: Tab is hidden
- **WHEN** the tab becomes hidden during a run
- **THEN** submissions pause until the tab is visible again

#### Scenario: Local mode
- **WHEN** the interface runs in local mode
- **THEN** the hosted control is not shown and the CLI is the documented path

### Requirement: Attribution stays out of scoring, drafts and telemetry
Attribution SHALL be read only by metrics and the run dossier and SHALL never enter the rubric,
interpreter, draft composer, verification text, events, lifecycle reports, logs or model inputs.

#### Scenario: Same lead with and without attribution
- **WHEN** two otherwise identical leads differ only in attribution
- **THEN** their scores, priorities, drafts and events are identical apart from identifiers and timestamps

### Requirement: Real advertising data stays out of scope
The system SHALL contain no Google Ads, GA4, Search Console or other advertising or analytics
integration, tag, API call or real click ID; connecting such data SHALL require the
real-personal-information gate, the paid-API gate and a new scoped phase.

#### Scenario: Codebase is inspected
- **WHEN** the gate scans dependencies and source
- **THEN** no advertising or analytics SDK, tag or endpoint is present
