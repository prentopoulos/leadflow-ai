## ADDED Requirements

### Requirement: Private IAP invocation boundary
The hosted Cloud Run service SHALL require direct Identity-Aware Proxy authentication, SHALL grant
invocation only to the IAP service agent and required control-plane identities, and SHALL reject any
configuration containing `allUsers` or `allAuthenticatedUsers`.

#### Scenario: Unauthenticated browser opens the service
- **WHEN** a browser without a valid IAP session requests any application or API route
- **THEN** IAP denies or redirects the request before application state is returned

#### Scenario: IAP is enabled for the first time
- **WHEN** the project has no Google Cloud organization and IAP has never been enabled in it
- **THEN** the runbook enables IAP once from the Cloud Run console, because the OAuth client cannot be created programmatically, and later releases use the scripted path

#### Scenario: Public principal is detected
- **WHEN** candidate IAM evidence includes `allUsers` or `allAuthenticatedUsers`
- **THEN** the deployment gate fails and the service is not approved for demonstration

### Requirement: Signed assertion and subject authorization
The application SHALL validate the IAP assertion signature, issuer, audience, timestamps and stable
subject for every hosted request and SHALL authorize only subjects in a private exact allowlist;
unsigned headers, email addresses and display names SHALL NOT grant authority. Verification SHALL use
an exact-pinned direct dependency recorded in the Phase 3 dependency record (for example
`google-auth-library`'s IAP public-key verification), never an undeclared transitive import.

#### Scenario: Allowed owner request arrives
- **WHEN** the request carries a current correctly signed assertion for the configured audience and an allowlisted stable subject
- **THEN** the request receives the trusted operator principal and may proceed to route-level authorization

#### Scenario: Assertion is invalid
- **WHEN** the assertion is missing, forged, expired, uses the wrong issuer or audience, or names a non-allowlisted subject
- **THEN** the application returns a fixed denial before reading or writing application state and logs no assertion or identity value

### Requirement: Private operator identity
Hosted reviews and gated mutations SHALL bind to the trusted IAP subject through a private operator
identifier while public records, screenshots, reports and repository files SHALL exclude the owner
email, subject, allowlist, audience, service URL and raw IAM membership.

#### Scenario: Draft review is recorded
- **WHEN** the authenticated owner approves or rejects a draft revision
- **THEN** the stored review is bound to the trusted private operator identifier, revision digest and time without trusting a browser-supplied principal

#### Scenario: Evidence is published
- **WHEN** authentication or IAM evidence is added to the public evidence index
- **THEN** it proves the allowed and denied cases without exposing private identity or account values

### Requirement: Backend-only Firestore access
Hosted application data SHALL be accessed only by the backend Admin SDK through the configured
runtime service identity, while client Firestore rules remain deny-all and no browser database
credential or SDK data path is introduced.

#### Scenario: Browser attempts direct Firestore access
- **WHEN** a client attempts to read or write application documents directly
- **THEN** Firestore denies the request and no application record is disclosed or changed

#### Scenario: Runtime accesses Firestore
- **WHEN** the configured Cloud Run runtime identity performs an allowed repository operation
- **THEN** the operation is authorized at the minimum practical project/database scope and every loaded document is schema-validated

### Requirement: Local and hosted access modes remain separate
Startup SHALL select a strict local or hosted configuration; local mode SHALL retain loopback
Host/Origin protection and the labelled local operator, while hosted mode SHALL require IAP and SHALL
disable emulator reset and development-fixture routes.

#### Scenario: Hosted configuration is incomplete
- **WHEN** hosted mode lacks its required project, database, IAP audience, private allowlist, bundle or recorded-enrichment configuration
- **THEN** stateful readiness fails closed without falling back to local or unauthenticated behavior

#### Scenario: Local gate runs
- **WHEN** the credential-free offline gate starts the application on loopback
- **THEN** it requires no IAP assertion or cloud credential and cannot select hosted state accidentally
