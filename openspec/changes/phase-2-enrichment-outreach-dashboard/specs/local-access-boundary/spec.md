## ADDED Requirements

### Requirement: Loopback Host and Origin allowlist
The API SHALL reject any request whose `Host` header is not the configured loopback API host, and any
state-changing request whose `Origin` header is present and is not the configured web origin, before
route handling.

#### Scenario: Rebinding host is used
- **WHEN** a request arrives with `Host: attacker.example`
- **THEN** the API returns a fixed 403 and no route handler runs

#### Scenario: Cross-site POST is attempted
- **WHEN** a review POST carries an `Origin` other than the configured web origin
- **THEN** the API returns a fixed 403 and stores nothing

#### Scenario: Local operator uses the app
- **WHEN** the configured web origin calls the API on the configured loopback host
- **THEN** the request proceeds normally

### Requirement: Authentication remains explicitly deferred
The interface and documentation SHALL state that the local app has no authentication and that
Firebase Auth arrives with Phase 3 deployment.

#### Scenario: Operator reviews a draft
- **WHEN** the operator approves or rejects a draft
- **THEN** the interface shows the unauthenticated local operator label next to the decision
