## ADDED Requirements

### Requirement: Phase 3 offline release checks
The credential-free `pnpm check` gate SHALL add deterministic checks for container inputs and
contents, local/cloud configuration exclusivity, IAP assertion/allowlist logic, hosted execution
contracts, Firestore TTL/purge guards, log privacy, immutable deployment templates, private-value
placeholders, evidence schemas, README/diagram freshness and teardown definitions without invoking
cloud or internet services.

#### Scenario: Offline gate runs before cloud authorization
- **WHEN** `pnpm check` runs on the Phase 3 candidate
- **THEN** every local Phase 3 contract is verified using synthetic keys/claims and fixtures while all actual cloud boundaries remain `not_run`

#### Scenario: Private value enters a tracked artifact
- **WHEN** a project ID/number, owner email, stable subject, allowlist, audience, service URL, token, cookie, raw IAM list or billing identifier appears in a prohibited tracked path or generated image
- **THEN** hygiene/governance fails and names the affected file without printing the sensitive value

### Requirement: Separately authorized cloud probes
Actual IAP, Cloud Run, Firestore, build, billing, log and rollback checks SHALL run only through
separately named commands after enumerated owner authorization and SHALL never be part of the offline
gate.

#### Scenario: Cloud authorization is absent
- **WHEN** the Phase 3 branch is built or reviewed locally without a cloud-action approval
- **THEN** no API is enabled, resource created, build submitted or service invoked, and cloud evidence remains `not_run`

#### Scenario: Authorized probe fails
- **WHEN** a deployed access, persistence, privacy, cost or rollback assertion fails
- **THEN** the failure is preserved in the evidence index and phase readiness remains on hold

### Requirement: Pre-push public artifact scans
Every push of new Phase 3 material SHALL rerun the proven secret scan, private-data scan and
generated-asset inspection over the candidate public material.

#### Scenario: Phase branch is pushed
- **WHEN** the spec-only or later implementation branch is published
- **THEN** the scan results identify the examined revision and candidate files and no MP4 is included without separate approval
