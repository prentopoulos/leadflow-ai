## MODIFIED Requirements

### Requirement: Single offline quality command
The repository SHALL expose `pnpm check` as a credential-free offline command that composes all
required Phase 1 verification, including isolated local-emulator integration, without installing,
fixing, contacting registries/providers, or using cloud credentials.

#### Scenario: Complete quality gate passes
- **WHEN** every constituent Phase 1 check passes using installed dependencies and pinned local tools
- **THEN** `pnpm check` exits successfully and identifies the exact bundle and checks it executed

#### Scenario: Constituent check fails
- **WHEN** any required source, schema, runtime, emulator, evaluation, build, smoke, governance, diagram, accessibility, or hygiene check fails
- **THEN** `pnpm check` exits unsuccessfully, preserves the failure, and does not continue into a misleading success summary

### Requirement: Required gate composition
The quality command MUST include runtime/tool preflight, Prettier check, ESLint, strict no-emit
TypeScript, unit/contract tests, isolated Firestore/LangGraph integration tests, evaluator self-tests
and all runnable cases, production builds, API/web/emulator smoke checks, constitution drift,
tracked-secret/config/generated-artifact hygiene, architecture source/export/link checks, and
`openspec validate --all --strict`.

#### Scenario: Gate manifest is inspected
- **WHEN** root scripts and the check implementation are reviewed
- **THEN** every required constituent has a named executable check and no check depends on output accidentally emitted by typecheck

#### Scenario: Gate is run twice
- **WHEN** `pnpm check` succeeds and is immediately rerun without a build cleanup command
- **THEN** both runs evaluate the same source/bundle and tracked/generated-artifact cleanliness still passes

### Requirement: Constitution drift detection
The gate SHALL compare the constitution version and verbatim rule text in PROJECT.md, AGENTS.md, and
`openspec/config.yaml` and SHALL fail on drift.

#### Scenario: Constitution copies match
- **WHEN** all three copies contain the same version and rule text
- **THEN** the constitution check passes

#### Scenario: Constitution copy changes independently
- **WHEN** one copy differs in version or rule text
- **THEN** the constitution check fails and identifies the mismatched file

### Requirement: Automated localhost smoke checks
The gate SHALL start the built API, web preview, and isolated Firestore Emulator on available
loopback ports, exercise health plus one persisted synthetic intake-to-complete run, assert cleanup,
and terminate every child process on success, failure, or timeout.

#### Scenario: Smoke lifecycle completes
- **WHEN** the smoke suite runs against valid builds and cached tools
- **THEN** it validates process health, persistence-before-processing, stored completion, web shell, loopback binding, and leaves no listener behind

#### Scenario: Smoke process fails
- **WHEN** any child fails to start, times out, or exits unexpectedly
- **THEN** the smoke command reports the failing process and still terminates the remaining children

### Requirement: Separate connected dependency audit
The repository SHALL retain a separately named, owner-authorized dependency audit that contacts the
package registry, uses a high-severity threshold, never fixes automatically, and leaves manifests,
lockfile, and pinned-tool metadata unchanged.

#### Scenario: Connected audit is run
- **WHEN** an operator invokes the connected audit with network access
- **THEN** it reports qualifying findings and verifies dependency files are unchanged

#### Scenario: Offline gate is run without network
- **WHEN** `pnpm check` runs using installed dependencies and cached tools
- **THEN** it does not invoke the connected audit or any provider and remains capable of completing offline

### Requirement: Verification evidence is scoped honestly
Phase 1 evidence SHALL distinguish pure synthetic, local-emulator, rendered-local, connected-registry,
and untested live/provider/cloud/production boundaries and SHALL bind results to the complete system
bundle.

#### Scenario: Verification summary is produced
- **WHEN** Phase 1 results are recorded in review and handoff
- **THEN** each result names revision, environment, evidence class, sample/case counts, failures, exclusions, and remaining `not_run` boundaries

#### Scenario: Required evidence is missing or stale
- **WHEN** an applicable hard check lacks a current pass for the candidate bundle
- **THEN** phase readiness remains on hold rather than treating absence as success

## ADDED Requirements

### Requirement: Emulator isolation and reset checks
The gate SHALL use an isolated synthetic project/data scope, SHALL verify the flush result before
cases, and SHALL directly test every guarded reset denial plus the allowed local reset path.

#### Scenario: Prior emulator state exists
- **WHEN** an integration suite starts with stale documents
- **THEN** the verified flush removes them before fixtures run and a failed flush stops the suite

#### Scenario: Reset targets an unsafe boundary
- **WHEN** reset configuration is non-loopback, not the exact project, disabled, or unconfirmed
- **THEN** the test proves no delete call was made

### Requirement: Architecture and UI review checks
The gate SHALL validate architecture sources/exports/local links and automated accessibility-sensitive
contracts, while the phase review SHALL additionally inspect the rendered diagrams and actual UI at
desktop and 390px normal/failure/long-content states.

#### Scenario: Automated diagram validation runs
- **WHEN** architecture checks execute
- **THEN** Structurizr syntax, self-contained accessible diagram sources, SVG exports, geometry rules, component names, and documentation links are checked offline

#### Scenario: Rendered review evidence is recorded
- **WHEN** the phase is prepared for code review
- **THEN** the review names the actual viewports/states and diagram exports inspected and records unresolved visual findings
