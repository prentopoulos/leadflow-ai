## ADDED Requirements

### Requirement: Frozen Phase 2 evaluation cases
The evaluator SHALL add a `phase-2.0` corpus, fixed before any Phase 2 measurement and retaining every
earlier case ID, covering enrichment found, not found, timeout, 429, 5xx, malformed, and vehicle
mismatch; consent false and true; draft grounding; prohibited language; request-text injection into
drafts; review digest and staleness invariants; metric arithmetic including empty denominators and
exclusions; and recorded/mock/live labelling.

#### Scenario: Offline evaluation runs
- **WHEN** `pnpm eval` runs inside the gate
- **THEN** every Phase 2 case runs against recorded or mock fixtures and reports pass or fail

#### Scenario: Live behavior is not measured offline
- **WHEN** a case depends on live source behavior or a hosted model
- **THEN** it reports `not_run` and names the probe or gate that would measure it

#### Scenario: Case set changes after measurement
- **WHEN** a frozen case's expectation is edited after Phase 2 results were recorded
- **THEN** the corpus digest changes and earlier evidence is reported `stale`
