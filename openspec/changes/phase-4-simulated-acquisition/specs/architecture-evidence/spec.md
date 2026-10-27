## ADDED Requirements

### Requirement: Phase 4 acquisition views and showcase
The Structurizr model SHALL show the traffic simulator (local CLI and hosted browser control) and
the synthetic spend fixture, the ERD SHALL show the lead attribution fields, both rendered with
`pnpm docs:diagrams` without Mermaid, and the README and `docs/walkthrough.md` SHALL describe the
simulated acquisition section with SIMULATED labels while keeping the intake-first walkthrough
opening.

#### Scenario: Diagrams are regenerated
- **WHEN** `pnpm docs:diagrams` runs on the Phase 4 model
- **THEN** the container view and ERD include the simulator, spend fixture and attribution fields and pass the existing diagram checks

#### Scenario: README is read
- **WHEN** a reader opens the README's simulated acquisition subsection
- **THEN** it states that spend and channels are simulated and that no real advertising data is used
