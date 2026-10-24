## ADDED Requirements

### Requirement: Single offline quality command
The repository SHALL expose `pnpm check` as a credential-free offline command that composes all
required Phase 0 verification without installing, fixing, or contacting external services.

#### Scenario: Complete quality gate passes
- **WHEN** every constituent Phase 0 check passes using installed dependencies
- **THEN** `pnpm check` exits successfully and identifies the checks it executed

#### Scenario: Constituent check fails
- **WHEN** any required formatting, lint, type, test, evaluation, build, smoke, governance, or hygiene check fails
- **THEN** `pnpm check` exits unsuccessfully and preserves the failing output

### Requirement: Required gate composition
The quality command MUST include runtime/package-manager preflight, Prettier check, ESLint, strict
TypeScript checks, unit and contract tests, evaluator self-tests and runnable cases, production
builds, API and web smoke checks, constitution-copy/version drift, tracked secret/config hygiene,
and `openspec validate --all --strict`.

#### Scenario: Gate manifest is inspected
- **WHEN** the root scripts and check implementation are reviewed
- **THEN** every required constituent has a named executable check in the composed gate

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
The gate SHALL start built API and web artifacts on ephemeral loopback ports, assert their narrow
contracts, and stop the processes on success or failure.

#### Scenario: Smoke lifecycle completes
- **WHEN** the smoke suite runs against valid builds
- **THEN** it validates API health and the web shell and leaves no listening child process behind

### Requirement: Separate connected dependency audit
The repository SHALL expose a separately named, owner-authorized dependency audit that contacts the
package registry, uses a high-severity threshold, and never modifies dependency manifests or the lockfile.

#### Scenario: Connected audit is run
- **WHEN** an operator invokes the connected audit with network access
- **THEN** it reports qualifying findings and leaves repository dependency files unchanged

#### Scenario: Offline gate is run without network
- **WHEN** `pnpm check` runs with installed dependencies and no registry access
- **THEN** it does not invoke the connected audit and remains capable of completing offline

### Requirement: Verification evidence is scoped honestly
Phase 0 evidence SHALL distinguish local checks, synthetic fixtures, connected registry results, and
untested future capabilities and SHALL NOT claim hosted CI, live provider, cloud, or production evidence.

#### Scenario: Verification summary is produced
- **WHEN** Phase 0 results are recorded in the handoff
- **THEN** each result names its scope and untested boundaries explicitly
