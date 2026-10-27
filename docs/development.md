# Local development

LeadFlow uses project-local Node.js 24.22.1, pnpm 12.15.0, Eclipse Temurin Java 21.0.12.1+1,
Firestore Emulator 1.22.0, and Structurizr CLI 2025.11.09 so unrelated system installations remain
available. The `.tools/` directory is ignored and must never be committed. Exact Phase 1 artifacts
and SHA-256 values live in `toolchain.phase1.json`; the selection rationale is in
`docs/dependencies/phase-1.md`.

## Bootstrap the verified toolchain

The bootstrap downloads the exact official Node.js archive, Java, Firestore Emulator, and
Structurizr artifacts when they are missing, verifies their committed SHA-256 values, and installs
them under `.tools/`. It then installs pnpm at the exact pinned version with that Node.js's own npm,
because pnpm ships its Windows binary as a platform-specific optional dependency; npm checks the
registry integrity, and a published npm version cannot be replaced. Run it once in a fresh clone,
before activation:

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

`pnpm docs:check` (part of `pnpm check`) validates `docs/architecture/workspace.dsl` with the pinned
Structurizr CLI offline, plus README links and figures, diagram freshness and model/schema drift.
Regenerate diagrams with `pnpm docs:diagrams`; it exports SVGs through the diagram-design skill's
helper and needs the Python launcher (`py -3.13`, or set `LEADFLOW_PYTHON`).

## Local application boundary

Development listeners must remain on `127.0.0.1`. Phase 2 adds owner-authorized read-only GETs to
`vpic.nhtsa.dot.gov` and `api.zippopotam.us` only; there is still no hosted model, authentication,
cloud Firestore, external communication, or other credentialed service.

## Phase 2 local operator session

1. `pnpm emulator:start` (ephemeral), then `pnpm build`.
2. `pnpm api:local` runs live enrichment (owner-authorized reads). Pass `-- --enrichment=recorded`
   for recorded fixtures; set `LEADFLOW_WEB_ORIGIN` when the web app is not on 127.0.0.1:5173.
3. `pnpm simulate:traffic` feeds the 60 fixed fictional `traffic-plan-v1` leads, one every 10 s
   (`-- --interval=0` for an instant fill, `-- --count=N` for fewer). It refuses unless the running API
   is in recorded mode. Leads are keyed per system bundle, so after a code change it fills the new
   metrics window. Channels, campaigns, click IDs and spend are simulated.
4. Start Vite (`node node_modules/vite/bin/vite.js --config apps/web/vite.config.ts --port 5174
   --strictPort` if 5173 is taken) and open `#runs` or `#metrics`.

## Known shell workarounds

- Run `pnpm` from PowerShell after `. .\scripts\activate-toolchain.ps1`. Git Bash cannot resolve
  the standalone pnpm shim.
- If Git reports `dubious ownership` because the checkout belongs to another Windows account, pass
  a one-command override such as `git -c safe.directory=<absolute checkout path> status`
  rather than changing global configuration, unless the owner adds the directory permanently.
- Windows PowerShell 5.1 turns any native stderr line into a `NativeCommandError`, so a passing
  `pnpm exec vitest` can still report failure. To capture a leaf check's output, run the tool's Node
  entry directly through `cmd /c` with a redirect, for example
  `cmd /c "node node_modules\vitest\vitest.mjs run packages/domain > out.txt 2>&1"`, and read
  `$LASTEXITCODE`. Run `openspec validate` from Git Bash, where its spinner on stderr is harmless.
- Windows PowerShell 5.1 `Set-Content -Encoding utf8` writes a byte-order mark. Edit files with
  Node or the editor instead; if a BOM slips in, strip the first three bytes before committing.
- Playwright's bundled Chromium is not installed; rendered checks launch the installed Chrome with
  `p.chromium.launch(channel="chrome")` under `py -3.10`.
- Diagram tooling runs under the Python launcher: `py -3.13` for the diagram-design self-check and
  SVG export, and `py -3.10` where Playwright is installed.

## Phase 3 container and release notes

- The checkout may be owned by the Codex sandbox account. Scripts pass
  `git -c safe.directory=<repo>` per call; do not change global Git configuration. `gh` runs Git
  itself and cannot take `-c`, so give it the same override for one process through the
  environment: `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0=<repo> gh
  pr create --repo prentopoulos/leadflow-ai ...` (Git Bash).
- A working tree can hold CRLF bytes for LF-committed files while `git status` is clean. If the
  local bundle's `sourceDigest` differs from the image manifest, compare files against
  `git archive HEAD` and restore any that differ with `git show HEAD:<path> > <path>`.
- GNU tar on Windows reads `C:\...` as a remote host; run it from the target directory with relative
  paths. Exported Linux image filesystems cannot be extracted on Windows (symlinks), so
  `pnpm container:inspect` streams the tar instead.
- Port 5173 may already be held by another local Vite app; run the web app with
  `vite --port 5174 --strictPort` and start the API with `LEADFLOW_WEB_ORIGIN=http://127.0.0.1:5174`.
- Run the full gate, the emulator probe and image builds one at a time on this machine; running them
  together has exhausted memory.
