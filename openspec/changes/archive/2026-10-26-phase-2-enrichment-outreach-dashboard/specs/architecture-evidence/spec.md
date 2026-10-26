## ADDED Requirements

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
