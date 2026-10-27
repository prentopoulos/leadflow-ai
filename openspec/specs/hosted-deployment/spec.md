# hosted-deployment Specification

## Purpose
TBD - created by archiving change phase-3-deployment-access-evidence. Update Purpose after archive.
## Requirements
### Requirement: One reproducible application container
The repository SHALL build one Linux container that serves the production web assets and Fastify
API on `0.0.0.0:$PORT`, uses the exact workspace lockfile and supported Node runtime, runs as a
non-root user where the selected base permits, and contains no development cache, credential,
emulator export or private deployment value.

#### Scenario: Container is built from the candidate
- **WHEN** the exact clean candidate commit is built
- **THEN** the image starts under the Cloud Run container contract, serves health/web/API from one origin, and identifies the same system bundle as the tested candidate

#### Scenario: Container content is inspected
- **WHEN** the built filesystem and metadata are scanned
- **THEN** no secret, owner identity, local home path, emulator data, untracked file or mutable deployment credential is present

### Requirement: Regional Firestore with bounded retention
The hosted application SHALL use the default Firestore Standard Native database in
`northamerica-northeast2`, SHALL stamp every retained application and subcollection document with a
seven-day `expiresAt` stored as a Firestore timestamp ("Date and time"), not the text timestamps the
domain records use, SHALL define one TTL policy per collection group (top-level collections and each
subcollection group) with the TTL field exempt from single-field indexing, and SHALL provide an
exact-project/database guarded recursive purge; backup and PITR SHALL remain disabled.

#### Scenario: Database plan differs
- **WHEN** the target database edition, mode, ID or location differs from the accepted values
- **THEN** creation stops for owner review because the location is immutable

#### Scenario: Retained document is written
- **WHEN** hosted runtime stores a lead, run, event, checkpoint, evidence, draft, review, result or related subcollection document
- **THEN** it carries a timestamp-typed expiry under the accepted policy without changing domain evidence or event time

#### Scenario: Expiry field has the wrong type
- **WHEN** a hosted document would store `expiresAt` as text, null or any non-timestamp value
- **THEN** the write is rejected by the deterministic TTL check, because Firestore TTL silently ignores non-timestamp values

#### Scenario: Purge guard does not match
- **WHEN** the configured project/database, explicit confirmation or authenticated operator is absent or different
- **THEN** no delete operation is issued

### Requirement: Immutable build and deployment identity
The release path SHALL build one exact public commit through the reviewed Cloud Build definition,
verify the commit SHA, store the image in Artifact Registry, resolve its digest, and deploy that
digest through the reviewed service configuration without mutable-tag promotion or service-account
keys.

#### Scenario: Build source does not match
- **WHEN** the cloned revision, repository or clean-tree expectation differs from the release input
- **THEN** the build fails before producing a promotable image

#### Scenario: Candidate is deployed
- **WHEN** a reviewed image is promoted
- **THEN** the recorded Cloud Run revision references the tested digest and its private parameters are supplied outside public source and logs

#### Scenario: Build needs an unapproved service
- **WHEN** the no-source build cannot proceed without Cloud Storage or another unlisted service
- **THEN** it stops before enabling or creating that service and reports the missing authorization

### Requirement: Bounded runtime and spending configuration
The hosted service SHALL use request-based billing, one vCPU, 512 MiB, minimum zero, maximum one,
concurrency eight and a 60-second request timeout, while workflow execution SHALL reserve time to
persist a recoverable state before the platform deadline. The existing Cloud Run spend cap and the
accepted project-wide alert budget SHALL be verified before a build or demonstration.

#### Scenario: Runtime configuration is reviewed
- **WHEN** the deployed revision is compared with the accepted service template
- **THEN** every resource, scaling, concurrency, timeout, region, identity, access and evidence-mode value matches or deployment remains on hold

#### Scenario: Cost threshold is reached
- **WHEN** aggregate project spend reaches 50%, 80% or 100% of the accepted target or an unexpected service charge appears
- **THEN** the recorded inspect, stop-build/demo or teardown response is applied without describing delayed billing as a guaranteed cap

### Requirement: Verified rollback and teardown
The release process SHALL retain a compatible prior immutable revision until rollback is exercised,
SHALL recheck auth/persistence/fixture behavior after traffic moves, and SHALL implement the accepted
seven-day service/data and 30-day final-image teardown schedule against reverified exact resources.

#### Scenario: Candidate rollback is exercised
- **WHEN** traffic is returned to the prior revision
- **THEN** the system reruns representative auth, persistence and recorded-workflow smoke before calling rollback successful

#### Scenario: Seven-day teardown executes
- **WHEN** the evidence/walkthrough review window ends without an owner extension
- **THEN** synthetic data, the Cloud Run service, service-specific access and non-final images are removed while the empty Toronto database and sanitized evidence remain

#### Scenario: Final image retention ends
- **WHEN** day 30 arrives without an owner extension
- **THEN** the exact final image and empty repository are removed and future reconstruction is documented as a rebuild rather than an instant rollback

### Requirement: Cloud actions remain operator-gated
Planning artifacts, local implementation and a draft PR SHALL NOT enable an API, create a cloud
resource, change IAM/billing, run Cloud Build or deploy. Each such action SHALL require the later
enumerated owner approval and a current project/billing/IAM recheck.

#### Scenario: Planning completes before cloud approval
- **WHEN** the proposal and local implementation are ready but enumerated cloud authorization is absent
- **THEN** all cloud actions remain `not_run` while local work and review may continue

