# live-enrichment Specification

## Purpose
TBD - created by archiving change phase-2-enrichment-outreach-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Bounded authorized enrichment sources
The runtime SHALL make outbound enrichment requests only as HTTPS GETs to `vpic.nhtsa.dot.gov`
(`GetModelsForMakeYear`) and `api.zippopotam.us` (`/us/{zip}`), sending only the ZIP code or the
vehicle make and model year, with one request per source per lead, a 5-second timeout and at most one
retry after network error, timeout, 429 or 5xx.

#### Scenario: Lead with ZIP and full vehicle is enriched
- **WHEN** a run reaches the enrich step with a ZIP and a vehicle year, make and model
- **THEN** exactly one vPIC request carrying only make and year and one Zippopotam.us request carrying only the ZIP are made concurrently

#### Scenario: Source fails transiently
- **WHEN** the first attempt to a source times out or returns a network error, 429 or 5xx
- **THEN** one jittered retry is made, both attempts are recorded as events, and no third attempt occurs

#### Scenario: Source returns another client error
- **WHEN** a source returns a 4xx other than 429, or the not-found shape for that source
- **THEN** no retry is made

#### Scenario: Request targets any other host
- **WHEN** any code path attempts an enrichment request to a host or path outside the two authorized endpoints
- **THEN** the adapter refuses before any network activity and the run records a safe error

### Requirement: Honest enrichment outcomes
Each lookup SHALL resolve to exactly one outcome — `found`, `not_found`, `unavailable` or
`not_attempted` — and an unavailable or empty answer SHALL never be presented as negative evidence.

#### Scenario: Vehicle model is listed
- **WHEN** vPIC returns a valid response whose models include the intake model under exact case-insensitive comparison
- **THEN** the outcome is `found` with the claim "make/model listed by NHTSA vPIC for that model year" and no other vehicle claim

#### Scenario: Vehicle model is not listed
- **WHEN** vPIC returns a valid response that does not list the intake model
- **THEN** the outcome is `not_found` and the intake values are shown unchanged and uncorrected

#### Scenario: ZIP has several places
- **WHEN** Zippopotam.us returns more than one place for a ZIP
- **THEN** every returned place is stored and none is chosen as the lead's location

#### Scenario: Response is malformed or the retry is exhausted
- **WHEN** a response fails its schema or both attempts fail
- **THEN** the outcome is `unavailable` with failure kind `timeout`, `network`, `rate_limited`, `server_error` or `malformed`

#### Scenario: Input is missing
- **WHEN** the vehicle year, make or model is null
- **THEN** the vehicle lookup is `not_attempted`, no request is made, and the reason is stored

### Requirement: Complete retained evidence records
Every lookup SHALL produce one `enrichment-evidence-v1` record holding source, endpoint template,
subject, requested and retrieved times, HTTP status, outcome, failure kind, attempts, evidence class,
capture date for recorded fixtures, a raw body bounded to 64 KiB with a truncation flag, the SHA-256 of
the full body, the normalized claim and source attribution, retained until local reset with no
cross-lead cache.

#### Scenario: Evidence is inspected
- **WHEN** an operator or check reads a lead's evidence
- **THEN** every required field is present and the stored digest matches the stored untruncated body

#### Scenario: Two leads share a ZIP
- **WHEN** two leads with the same ZIP are enriched
- **THEN** each has its own request and its own retrieval time

### Requirement: Explicit evidence classes
The runtime SHALL take `ENRICHMENT_MODE` of `live`, `recorded` or `mock` from validated configuration
with no default fallthrough, and SHALL stamp that class on every evidence record, event and metric
split.

#### Scenario: Offline gate runs
- **WHEN** `pnpm check` runs
- **THEN** enrichment uses only recorded or mock fixtures, makes no network request, and labels evidence accordingly

#### Scenario: Recorded fixture is used
- **WHEN** a recorded fixture answers a lookup
- **THEN** the evidence carries class `recorded` and the fixture's live capture date and digest, never `live`

#### Scenario: Mode is missing or invalid
- **WHEN** the API starts without a valid enrichment mode
- **THEN** stateful routes fail closed with a safe readiness error

### Requirement: Separately named live probe
`pnpm enrichment:probe` SHALL perform the authorized live calls for a fixed list of fictional-lead
subjects, write recorded fixtures with capture date and digest, report each outcome, and SHALL NOT be
part of `pnpm check`.

#### Scenario: Probe runs with network
- **WHEN** the probe completes
- **THEN** each subject's outcome, status and digest are reported and its recorded fixture is written

#### Scenario: Probe runs without network
- **WHEN** the sources are unreachable
- **THEN** the probe reports `unavailable` per subject, writes no fixture for that subject, and exits non-zero

### Requirement: Local email check makes no ownership claim
The email check SHALL be local, SHALL report only `syntax_valid` and `reserved_test_domain`, SHALL
state that it makes no mailbox existence, deliverability or ownership claim, and SHALL be excluded
from enrichment metrics.

#### Scenario: Email is checked
- **WHEN** a lead with an `example.com` address is processed
- **THEN** the stored result reports syntax valid and reserved test domain with the fixed limit text and no network activity
