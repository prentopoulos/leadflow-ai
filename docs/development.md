# Local development

Phase 0 uses a project-local Node.js 24.22.1 and pnpm 12.15.0 toolchain so the existing system
installation remains available. The `.tools/` directory is ignored and must never be committed.

## Activate the verified toolchain

The current workstation already has the official Node.js archive installed under `.tools/`; its
SHA-256 was verified against Node.js's published `SHASUMS256.txt`. To activate the toolchain in a new
PowerShell session:

```powershell
. .\scripts\activate-toolchain.ps1
node --version
pnpm --version
```

Expected versions are Node `v24.22.1` and pnpm `12.15.0`. Activation changes only the current shell.

## Bootstrap

After activation, install exactly the committed dependency graph:

```powershell
pnpm install --frozen-lockfile
pnpm check
```

Neither command requires application credentials. `pnpm check` is designed to run offline after the
install completes. It validates formatting, linting, types, tests, the synthetic evaluation harness,
builds, loopback-only smoke tests, governance checks, and strict OpenSpec validation.

The connected registry audit is intentionally separate:

```powershell
pnpm audit:dependencies
```

It reports high-severity-or-greater dependency findings and never applies fixes.

## Local application commands

The Phase 0 API and web applications are skeletons only. They use no Firestore, model, enrichment,
authentication, cloud, or other credentialed service. Development listeners must remain on
`127.0.0.1`.
