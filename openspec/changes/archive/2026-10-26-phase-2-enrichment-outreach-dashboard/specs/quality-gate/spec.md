## ADDED Requirements

### Requirement: Phase 2 gate stays offline
`pnpm check` SHALL exercise enrichment only through recorded or mock fixtures, SHALL fail if any test,
smoke, or evaluation attempts a network request outside loopback, and SHALL keep the live probe and
dependency audit as separately named commands.

#### Scenario: Gate runs without network
- **WHEN** `pnpm check` runs on a machine without internet access after bootstrap
- **THEN** every step passes or fails on local evidence alone

### Requirement: No-send governance check
The gate SHALL fail when source or dependencies introduce a send route, SMTP client, email-delivery
SDK, outbound message queue, or an enrichment host outside the two authorized endpoints.

#### Scenario: Email package is added
- **WHEN** an email-delivery package appears in a manifest or lockfile
- **THEN** governance fails with the offending package named

### Requirement: Phase 2 loopback smoke
The built API smoke SHALL cover intake through enrichment (recorded), draft composition, verification,
review approval and rejection, stale review conflicts, metrics, leads listing, Host/Origin rejection,
and asynchronous resume against the isolated emulator.

#### Scenario: Smoke completes
- **WHEN** the emulator runtime probe runs
- **THEN** each listed path produces its specified stored state and response, and the emulator shuts down cleanly
