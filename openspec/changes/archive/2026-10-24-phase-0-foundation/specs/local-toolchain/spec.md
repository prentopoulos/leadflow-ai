## ADDED Requirements

### Requirement: Exact supported runtime and package manager
The repository SHALL declare Node.js 24.22.1 and pnpm 12.15.0 as its required local toolchain and
SHALL fail its preflight clearly when incompatible versions are active.

#### Scenario: Accepted toolchain is active
- **WHEN** the preflight runs under Node.js 24.22.1 and pnpm 12.15.0
- **THEN** it reports the accepted versions without changing the machine

#### Scenario: Incompatible toolchain is active
- **WHEN** the preflight runs under a different Node.js or pnpm version
- **THEN** it fails with the expected versions and a reference to the bootstrap instructions

### Requirement: Private workspace boundaries
The repository SHALL use one private pnpm workspace containing `apps/web`, `apps/api`,
`packages/domain`, and `packages/evals`, with private provisional names under `@leadflow-ai/*`.

#### Scenario: Workspace packages are inspected
- **WHEN** workspace metadata is validated
- **THEN** all four packages are discoverable, private, and linked through workspace dependencies

### Requirement: Reproducible dependency installation
The repository SHALL commit one pnpm lockfile and SHALL document a frozen-lockfile bootstrap that
does not require application credentials.

#### Scenario: Clean local bootstrap
- **WHEN** dependencies are installed from the committed manifests and lockfile
- **THEN** pnpm uses the frozen lockfile without changing it or requesting application secrets

### Requirement: Safe configuration boundary
The repository SHALL keep runtime secrets out of tracked files and SHALL provide only sanitized
configuration examples and validated non-secret local defaults.

#### Scenario: Local environment files are inspected
- **WHEN** tracked-file and ignore rules are checked
- **THEN** `.env` files are ignored and examples contain no credential value

### Requirement: Versioned module strategy
All workspace packages SHALL use ESM and strict TypeScript project boundaries compatible with the
accepted toolchain.

#### Scenario: Cross-package type check
- **WHEN** the workspace type check runs
- **THEN** TypeScript validates each project and its declared references without emitting source
