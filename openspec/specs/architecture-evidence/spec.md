# architecture-evidence Specification

## Purpose
TBD - created by archiving change phase-1-intake-qualification. Update Purpose after archive.
## Requirements
### Requirement: Canonical C4 architecture model
The repository SHALL contain one Structurizr DSL model defining the local Phase 1 system context,
container, and persist-before-processing dynamic views with stable component identifiers and explicit
trust/data boundaries.

#### Scenario: Architecture source is validated
- **WHEN** the pinned local Structurizr tooling checks the workspace
- **THEN** the DSL parses without network access and contains the operator, web, API, runtime, Firestore Emulator, evaluation, and documentation boundaries

#### Scenario: Deferred systems are shown
- **WHEN** model/provider, live enrichment, Auth, or cloud boundaries appear
- **THEN** they are visibly deferred context rather than simultaneously deployed Phase 1 components

### Requirement: Persist-before-processing dynamic evidence
The architecture views SHALL make the committed lead/run/event/idempotency transaction precede the
graph claim and SHALL show checkpoint/event writes, failure, and explicit resume paths.

#### Scenario: Dynamic view is reviewed
- **WHEN** a reader follows the normal request sequence
- **THEN** no graph execution or qualification step appears before the persistence commit

#### Scenario: Recovery path is reviewed
- **WHEN** a reader follows the crash/retry/resume sequence
- **THEN** durable state, lease/revision checks, bounded retry, and operator resume are identifiable

### Requirement: Versioned schema ERD
The repository SHALL include a data-model view for leads, runs, events, checkpoints, pending writes,
idempotency records, system bundles, qualification results, and simulation records, including
cardinality and ownership without embedding personal fixture values.

#### Scenario: ERD is cross-checked
- **WHEN** the storage schemas and repositories are reviewed
- **THEN** every durable entity and relationship agrees with the implemented collection paths and identifiers

### Requirement: Publishable accessible diagrams
Each publishable architecture view SHALL have a self-contained HTML source with accessible inline
SVG and a checked SVG export, using the selected project diagram profile and the documented
complexity/connector rules.

#### Scenario: Diagram source is checked
- **WHEN** the diagram self-check and geometry checks run
- **THEN** titles/descriptions, view bounds, local overflow behavior, labels, connectors, and static/reduced-motion rendering satisfy the diagram contract

#### Scenario: Diagram is too dense
- **WHEN** a view would exceed its node or connector budget
- **THEN** it is split into overview and detail rather than shrinking or overlapping content

### Requirement: Compact README architecture summary
The README SHALL follow the showcase README method and embed a compact architecture overview drawn
with the `diagram-design` skill and exported as SVG under `docs/diagrams/`, linking to the detailed
architecture sources and using the same component names and boundaries without claiming deployment
or live integrations.

#### Scenario: README links are checked
- **WHEN** documentation validation runs
- **THEN** every architecture/research link resolves to a tracked file and the summary agrees with the canonical model

### Requirement: Intake source evidence is durable
The repository SHALL retain the Military.com source URL, retrieval date, exact observed field label,
broad observed categories, unverified details, and recheck trigger.

#### Scenario: Source evidence is reviewed
- **WHEN** a field or parity claim is compared with the research record
- **THEN** only ZIP is treated as an exact verified field and the parity gate remains unresolved

### Requirement: Phase 2 architecture views
The Structurizr model SHALL add NHTSA vPIC and Zippopotam.us as external systems with their trust
boundary, a dynamic view of enrichment, drafting, verification, and review, and the new collections
in the ERD, rendered with the diagram-design skill and checked by `pnpm docs:check`.

#### Scenario: Diagrams are regenerated
- **WHEN** `pnpm docs:diagrams` runs
- **THEN** the rendered views name the implemented components, collections, and external systems and show Firebase Auth and model providers as deferred

### Requirement: README follows the showcase method
The README SHALL be updated with the showcase method to describe Phase 2 behavior, evidence classes,
source attribution, and the no-send boundary, and SHALL contain no Mermaid diagrams.

#### Scenario: README is checked
- **WHEN** documentation checks run
- **THEN** the README links resolve, it embeds diagram-design SVGs only, and it contains no Mermaid block

