## ADDED Requirements

### Requirement: Phase 3 local and private-cloud views
The canonical Structurizr model and rendered diagram-design views SHALL distinguish the local
emulator topology from the selected private cloud topology and SHALL show Cloud Run, direct IAP,
runtime/build identities, Artifact Registry, Firestore, the request-bound execution sequence,
platform logs/metrics and the owner-approved cost/rollback/teardown boundaries.

#### Scenario: Hosted architecture is reviewed
- **WHEN** a reader follows the private cloud context and deployment views
- **THEN** the IAP trust boundary, absence of public invokers, backend-only data path, build/runtime identity separation and recorded-only enrichment mode are explicit

#### Scenario: Request sequence is reviewed
- **WHEN** a reader follows intake through completion
- **THEN** persistence and 202 precede the separately authenticated execution request, polling reads stored state, and no post-response background step is implied

### Requirement: Phase 3 data lifecycle evidence
The data-model and lifecycle views SHALL show expiry ownership, eventual TTL, explicit purge,
rollback compatibility and the seven-day/30-day teardown outcomes without embedding private
deployment values or fictional contact payloads.

#### Scenario: Teardown view is checked
- **WHEN** diagrams are compared with the runbook and deployment templates
- **THEN** deleted, retained and reconstructible artifacts agree across all sources

### Requirement: Hosted README and walkthrough framing
The README and walkthrough SHALL explain private IAP access, synthetic recorded-mode execution,
deployment evidence and limitations in plain language, use no Mermaid, and avoid production,
live-cloud-enrichment or intake-parity claims.

#### Scenario: Public documentation is validated
- **WHEN** documentation checks and the GitHub render review run
- **THEN** links, figures, diagrams, labels and source credits match the candidate evidence and contain no private deployment identifier
