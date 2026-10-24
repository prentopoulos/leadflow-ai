# Local development

LeadFlow uses project-local Node.js 24.22.1, pnpm 12.15.0, Eclipse Temurin Java 21.0.12.1+1,
Firestore Emulator 1.22.0, and Structurizr CLI 2025.11.09 so unrelated system installations remain
available. The `.tools/` directory is ignored and must never be committed. Exact Phase 1 artifacts
and SHA-256 values live in `toolchain.phase1.json`; the selection rationale is in
`docs/dependencies/phase-1.md`.

## Bootstrap the verified toolchain

The official Node.js archive and pnpm are already installed under `.tools/` on the current
workstation. The Phase 1 bootstrap downloads only the exact Java, Firestore Emulator, and
Structurizr artifacts when they are missing, verifies their committed SHA-256 values, and installs
them under `.tools/`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-phase1-tools.ps1
```

The bootstrap requests no application credential. Then activate the complete toolchain in each new
PowerShell session:

```powershell
. .\scripts\activate-toolchain.ps1
node --version
pnpm --version
java --version
```

Expected versions are Node `v24.22.1`, pnpm `12.15.0`, and Java `21.0.12.1`. Activation sets
`JAVA_HOME`, `FIREBASE_EMULATORS_PATH`, and `LEADFLOW_STRUCTURIZR_CLI` to ignored project-local
paths for the current shell only.

## Install and verify

After activation, install exactly the committed dependency graph:

```powershell
pnpm install --frozen-lockfile
pnpm tools:verify
pnpm check
```

These commands require no application credentials. `pnpm tools:verify` is explicitly offline and
fails with the exact missing cached artifact if bootstrap has not run. After one connected install,
`pnpm install --frozen-lockfile --offline` verifies dependency-cache reuse. The ordinary
`pnpm check` remains credential-free and offline after dependency/tool bootstrap.

The connected registry audit remains separate:

```powershell
pnpm audit:dependencies
```

It reports high-severity-or-greater dependency findings and never applies fixes.

## Local Firestore Emulator

Phase 1 uses the exact synthetic project `demo-leadflow-ai-local`. Firestore binds to
`127.0.0.1:8080`; the Emulator UI is disabled. Browser code never connects directly to Firebase.

```powershell
# Empty, ephemeral state; Ctrl+C stops it and writes no export.
pnpm emulator:start

# Start, run the isolated flush/connectivity probe, and always stop.
pnpm emulator:exec

# Explicitly import/export gitignored .local/firestore state.
pnpm emulator:start:retain

# Export a currently running emulator into .local/firestore.
pnpm emulator:export
```

The retain command imports only when a prior export manifest exists. `.local/` is ignored and must
never be committed. These commands are local-synthetic evidence only: they do not validate cloud
Firestore indexes, IAM, security rules, contention, backup/restore, or deployed concurrency.

## Offline reuse check

After one connected dependency install and tool bootstrap:

```powershell
. .\scripts\activate-toolchain.ps1
pnpm install --frozen-lockfile --offline
pnpm tools:verify
pnpm emulator:exec
```

Structurizr validation joins `pnpm check` when the Phase 1 architecture source is added. Until then,
`pnpm tools:verify` and preflight verify that the pinned CLI is locally available.

## Local application boundary

Development listeners must remain on `127.0.0.1`. Phase 1 uses no hosted model, live enrichment,
authentication, cloud Firestore, external communication, or other credentialed service.
