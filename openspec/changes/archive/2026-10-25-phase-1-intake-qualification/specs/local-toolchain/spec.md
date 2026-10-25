## MODIFIED Requirements

### Requirement: Exact supported runtime and package manager
The repository SHALL continue to require Node.js 24.22.1 and pnpm 12.15.0 and SHALL additionally pin
and activate a project-local Java 21 runtime for the Firestore Emulator and Structurizr checks, with
clear preflight failures for incompatible versions.

#### Scenario: Accepted toolchain is active
- **WHEN** the preflight runs under the pinned Node, pnpm, and Java versions
- **THEN** it reports all accepted versions without modifying unrelated machine installations

#### Scenario: Incompatible toolchain is active
- **WHEN** Node, pnpm, or Java differs from the pinned version required by the selected tools
- **THEN** preflight fails with the expected versions and bootstrap reference before starting the emulator or checks

### Requirement: Private workspace boundaries
The repository SHALL use one private pnpm workspace containing `apps/web`, `apps/api`,
`packages/domain`, `packages/runtime`, and `packages/evals`, with private provisional names under
`@leadflow-ai/*`.

#### Scenario: Workspace packages are inspected
- **WHEN** workspace metadata is validated
- **THEN** all five packages are discoverable, private, and linked only through declared workspace dependencies

#### Scenario: Dependency direction is inspected
- **WHEN** package imports are checked
- **THEN** domain remains pure, runtime may depend on domain, API may depend on runtime/domain, web may depend on domain-safe contracts, and evals may depend on domain/runtime test entry points without a reverse dependency

### Requirement: Reproducible dependency installation
The repository SHALL commit one pnpm lockfile, exact direct Java/tool version metadata, and a
Windows-friendly frozen bootstrap that requires no application credential and supports an offline
reuse path after the authorized dependency/tool download.

#### Scenario: Clean local bootstrap
- **WHEN** dependencies and pinned tools are installed from their committed manifests/metadata
- **THEN** the process verifies artifacts, preserves the lockfile, and requests no application secret

#### Scenario: Offline reuse is verified
- **WHEN** the installed caches and local tools are reused without network access
- **THEN** the frozen install, emulator-backed gate, and diagram checks complete or fail only for a clearly named missing cached artifact

### Requirement: Safe configuration boundary
The repository SHALL keep runtime secrets out of tracked files, SHALL provide only sanitized
configuration examples, and SHALL validate that Phase 1 stateful configuration targets the exact
synthetic project and loopback Firestore Emulator without protocol or cloud fallback.

#### Scenario: Local environment files are inspected
- **WHEN** tracked-file and ignore rules are checked
- **THEN** `.env` and `.local` state are ignored and examples contain no credential value

#### Scenario: Emulator host is unsafe
- **WHEN** the host contains a protocol, non-loopback name/address, missing port, or the project ID is not the accepted local synthetic ID
- **THEN** startup fails before an Admin SDK database call

### Requirement: Versioned module strategy
All workspace packages SHALL use ESM and strict TypeScript project boundaries compatible with the
accepted toolchain, and checking SHALL not emit build artifacts that later checks accidentally use.

#### Scenario: Cross-package type check
- **WHEN** the workspace type check runs
- **THEN** TypeScript validates each project and its declared references without emitting source or generated runtime artifacts
