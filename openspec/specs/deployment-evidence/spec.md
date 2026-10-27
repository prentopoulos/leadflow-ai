# deployment-evidence Specification

## Purpose
TBD - created by archiving change phase-3-deployment-access-evidence. Update Purpose after archive.
## Requirements
### Requirement: Candidate-bound deployment evidence
The phase SHALL maintain a sanitized evidence index binding each check to the exact source commit,
lockfile, system bundle, build ID, image digest, Cloud Run revision/configuration, runtime identity,
Firestore location/policy and environment, with outcome `pass`, `fail`, `not_run` or `stale`.

#### Scenario: Required deployed check passes
- **WHEN** an authorized check runs against the exact candidate and its expected assertions all hold
- **THEN** the evidence records the timestamp, scope, sanitized inputs, expected/actual outcome and immutable candidate identifiers

#### Scenario: Evidence is missing or delayed
- **WHEN** a required check has not run, billing has not posted, or the candidate/configuration has changed
- **THEN** readiness stays on hold with `not_run`, pending or `stale` rather than zero or success

### Requirement: Hosted security and workflow proof
The authorized deployed probe SHALL cover owner access, unauthenticated denial, assertion/allowlist
negative cases, direct Firestore denial, runtime Firestore access, persist-before-202,
request-bound progress polling, duplicate execution, resume/retry/conflict, privacy-safe logs,
recorded evidence labeling, consent-gated drafting, no sending and rollback.

#### Scenario: Deployed probe completes
- **WHEN** the owner-authorized candidate probe runs with fictional recorded-mode cases
- **THEN** every declared case is retained with its observed result and no live enrichment, model, real data or external communication occurs

### Requirement: Operating and recovery runbook
The repository SHALL document exact pre-deployment, pre-demo, post-demo, monthly-hosted,
rollback, purge, credential/access-revocation and teardown procedures, each naming its operator,
scope, stop condition and evidence.

#### Scenario: Demonstration is prepared
- **WHEN** the operator follows the pre-demo runbook
- **THEN** current access, fixture mode, stored-run behavior and spend are checked before the walkthrough begins

#### Scenario: Material boundary changes
- **WHEN** identity, runtime, retention, dependency or deployment configuration changes
- **THEN** affected evidence is marked stale and the runbook names the cases that must rerun

### Requirement: Sanitized public showcase
The README, diagrams, walkthrough text, stills and evidence summary SHALL explain the private hosted
proof of concept to a newcomer using fictional recorded-mode data and SHALL exclude owner/project/
auth/billing values, production claims, live-cloud-enrichment claims and intake-parity claims.

#### Scenario: Hosted demo data is prepared
- **WHEN** the hosted walkthrough needs leads
- **THEN** the operator enters a few fictional leads through the authenticated interface using only vehicle and ZIP subjects present in the recorded fixtures, including the intake form's defaults, and no cloud seeding script or IAP bypass is added

#### Scenario: Walkthrough preview is produced
- **WHEN** the roughly two-minute captioned MP4 is recorded from the verified candidate
- **THEN** it follows `docs/walkthrough.md`, carries synthetic/recorded labels, and is sent privately to the owner before any publication decision

#### Scenario: Public artifacts are pushed
- **WHEN** the phase branch is published or updated
- **THEN** secret/private-data/generated-asset scans pass and the MP4 is absent unless separately approved

