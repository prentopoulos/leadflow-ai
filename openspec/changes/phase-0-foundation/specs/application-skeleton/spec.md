## ADDED Requirements

### Requirement: Bootable API skeleton
The API application SHALL build and start without credentials or external services and SHALL expose
a schema-validated `GET /health` process-health endpoint.

#### Scenario: API health succeeds locally
- **WHEN** the built API starts on an ephemeral port bound to `127.0.0.1` and receives `GET /health`
- **THEN** it returns a successful response matching the shared health schema

#### Scenario: Health remains narrowly scoped
- **WHEN** the health response is inspected
- **THEN** it makes no claim that Firestore, models, enrichment sources, authentication, or cloud deployment are ready

### Requirement: Bootable accessible web skeleton
The web application SHALL build and start without credentials or external services and SHALL render
an identifiable LeadFlow AI application shell that is readable at desktop and 390px widths.

#### Scenario: Web shell is smoke tested
- **WHEN** the built web preview starts on an ephemeral port bound to `127.0.0.1`
- **THEN** its root document identifies LeadFlow AI and labels the experience as a local synthetic foundation

#### Scenario: Baseline interaction accessibility
- **WHEN** a keyboard user or reduced-motion user opens the Phase 0 shell
- **THEN** semantic structure, visible focus, keyboard access, and reduced-motion behavior remain available

### Requirement: Shared runtime schemas
The domain package SHALL own Zod schemas used across application and evaluation boundaries and SHALL
export JSON Schema Draft 2020-12 only where an external contract requires it.

#### Scenario: Shared health contract
- **WHEN** the API response and its test are validated
- **THEN** both use the same domain-owned schema rather than duplicated handwritten shapes

### Requirement: Local listener boundary
Development and smoke commands SHALL bind to `127.0.0.1` unless a later authorized exposure changes
the requirement.

#### Scenario: Smoke processes start
- **WHEN** API and web smoke tests launch their servers
- **THEN** both listeners use loopback addresses and are terminated after the test

### Requirement: Honest Phase 0 presentation
The application shell SHALL NOT present fixture values as live metrics or claim product capabilities
that Phase 0 has not implemented.

#### Scenario: Shell content is reviewed
- **WHEN** the rendered text is inspected
- **THEN** it contains no quote, insurer decision, live lead metric, Military.com parity claim, or sent outreach claim
