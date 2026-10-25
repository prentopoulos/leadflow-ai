## MODIFIED Requirements

### Requirement: Bootable API skeleton
The API application SHALL build and start without credentials or external network services, SHALL
expose a schema-validated `GET /health` process-health endpoint, and in Phase 1 SHALL expose the
validated local intake, run-detail, resume, and guarded-reset routes only when their local emulator
configuration is valid.

#### Scenario: API health succeeds locally
- **WHEN** the built API starts on an ephemeral port bound to `127.0.0.1` and receives `GET /health`
- **THEN** it returns a successful response matching the shared health schema

#### Scenario: Health remains narrowly scoped
- **WHEN** the health response is inspected
- **THEN** it distinguishes process health from emulator/workflow readiness and makes no model, enrichment, authentication, cloud, or production claim

#### Scenario: Phase 1 routes lack valid local configuration
- **WHEN** the API is not configured for the exact loopback emulator and synthetic project ID
- **THEN** stateful Phase 1 routes fail closed without contacting a cloud Firestore endpoint

### Requirement: Bootable accessible web skeleton
The web application SHALL build and start without credentials or external services and SHALL render
the Phase 1 intake-to-run-detail flow at desktop and 390px widths.

#### Scenario: Web shell is smoke tested
- **WHEN** the built web preview starts on an ephemeral port bound to `127.0.0.1`
- **THEN** its root identifies LeadFlow AI, the persistent synthetic context, and an operable intake

#### Scenario: Baseline interaction accessibility
- **WHEN** keyboard, reduced-motion, long-content, loading, error, failure, and complete states are exercised
- **THEN** semantic structure, labels, visible focus, logical focus movement, accessible status, and readable responsive behavior remain available

### Requirement: Shared runtime schemas
The domain package SHALL own independently versioned Zod schemas and pure invariants used across API,
runtime, persistence, presentation, and evaluation boundaries and SHALL export JSON Schema Draft
2020-12 only where an external contract or stored schema artifact requires it.

#### Scenario: Shared Phase 1 contracts
- **WHEN** intake, stored documents, graph state, API responses, evaluation cases, and simulator records are validated
- **THEN** their owning packages consume the same domain schemas rather than duplicated handwritten shapes

#### Scenario: Deterministic rules are used
- **WHEN** rubric arithmetic, priority, state transition, or metric definitions are evaluated
- **THEN** pure domain code enforces them outside model, UI, and persistence adapters

#### Scenario: Shared health contract
- **WHEN** the API response and its test are validated
- **THEN** both use the same domain-owned schema rather than duplicated handwritten shapes

### Requirement: Local listener boundary
Development, emulator, diagram-preview, and smoke commands SHALL bind to `127.0.0.1` unless a later
authorized exposure changes the requirement.

#### Scenario: Local processes start
- **WHEN** API, web, emulator, or diagram preview processes are launched by repository commands
- **THEN** their configured listeners use loopback addresses and are terminated after the owning command or test

#### Scenario: Smoke processes start
- **WHEN** API and web smoke tests launch their servers
- **THEN** both listeners use loopback addresses and are terminated after the test

### Requirement: Honest Phase 0 presentation
The Phase 1 application SHALL replace the Phase 0 informational shell with the stored local synthetic
operator flow and SHALL NOT present fixture/simulated values as live metrics or claim unimplemented
product capabilities.

#### Scenario: Shell content is reviewed
- **WHEN** rendered text and state are inspected
- **THEN** they contain no quote, insurance decision, live conversion, full Military.com parity, sent outreach, live provider, deployed, or production claim

#### Scenario: Stored and simulated values coexist
- **WHEN** a run detail includes qualification and simulation data
- **THEN** both name their stored provenance and the simulation remains separately labeled synthetic and not predictive
