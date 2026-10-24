# Current handoff

Read PROJECT.md and current user instructions. Inspect actual Git/OpenSpec state before resuming.

## Current checkpoint

Phase 0 is merged into `main` at merge commit `642f70d`. Phase 1 implementation is in progress on
branch `phase-1-intake-qualification` in OpenSpec change `phase-1-intake-qualification`; planning
commit `ba2a1d8` is the accepted spec baseline. Tasks 1.1–1.5 are implemented and locally verified;
41 of 46 tasks remain. PROJECT.md records Phase 1 as `In progress`.

The accepted Phase 1 boundaries remain:

- ZIP code is the only exact Military.com field verified from the public landing page; every other
  Phase 1 intake field is visibly a LeadFlow demo field and the parity gate remains open.
- All inputs and outcomes remain fictional/synthetic and local. Firestore Emulator is the sole
  durable application store, reached only through loopback Fastify.
- Intake atomically persists idempotency, lead, run, and first event before graph execution.
- LangGraph.js uses a project-owned Firestore `BaseCheckpointSaver`; official JavaScript docs do not
  provide a Firestore saver.
- `rubric-v1` is deterministic: need timeline 40, request clarity 30, completeness 30; priority is
  high at 80–100, standard at 50–79, nurture at 0–49, and invalid evidence holds priority.
- The interpreter is a deterministic structured stub. Provider/model/prompt calls remain gated and
  `not_run`.
- A fixed-seed score-independent simulator exercises lifecycle/metric contracts only and makes no
  predictive or live-conversion claim.
- The product direction is a restrained operations dossier with a persistent
  `SIMULATION · Synthetic leads and outcomes` label, complete failure/recovery states, and desktop/
  390px accessibility.

## Implemented dependency/toolchain slice

- `docs/dependencies/phase-1.md` records exact versions, licences, compatibility evidence,
  alternatives, and emulator/production limits checked before installation.
- The private strict-ESM `@leadflow-ai/runtime` workspace depends one-way on domain contracts and
  exact-pins LangGraph 1.5.2, LangChain core 1.3.0, and Firebase Admin 14.5.0. Fastify may consume
  runtime; no model-provider SDK was added.
- Root development tooling exact-pins Firebase CLI 15.34.1. The frozen lockfile covers all six
  workspaces and explicitly denies the unneeded transitive install scripts for `@firebase/util`,
  `protobufjs`, and `re2`.
- `toolchain.phase1.json` pins Temurin 21.0.12.1+1, Firestore Emulator 1.22.0, and Structurizr CLI
  2025.11.09 with exact URLs and SHA-256 values. The ignored `.tools` cache contains verified copies;
  activation sets project-local Java, Firebase cache, and Structurizr paths without changing Node
  24.22.1 or pnpm 12.15.0.
- Firebase uses the exact demo project `demo-leadflow-ai-local`, binds Firestore to
  `127.0.0.1:8080`, disables the Emulator UI, denies client rules, and exposes separate ephemeral,
  isolated-exec, explicit-retain, and explicit-export commands. Retained state exists only under
  ignored `.local/firestore`.
- The emulator wrapper sets CI/update-notifier controls and a project-local config directory so the
  ordinary command neither fetches the CLI message-of-the-day nor writes user-global Firebase
  configuration.

## Slice verification

The following passed on 2026-10-24:

- `pnpm install --frozen-lockfile --offline` against the populated workstation cache;
- `pnpm tools:verify`: all three cached artifacts and checksums passed without network;
- Structurizr `version`: CLI 2025.11.09, structurizr-java 5.0.2, Java 21.0.12.1;
- `pnpm emulator:exec`: the cached Firestore Emulator detected the demo project, passed the exact
  loopback host/project and verified-flush probe, and shut down cleanly;
- `. .\scripts\activate-toolchain.ps1; pnpm check`: exact Node/pnpm/Java/emulator/Structurizr
  preflight, Prettier, ESLint, strict TypeScript across six workspaces, 5 Vitest files/17 tests,
  production builds, synthetic-local evaluation (21 passed, 0 failed, 3 `not_run`), API/web
  loopback smoke, constitution/hygiene checks, and strict OpenSpec validation (5 passed, 0 failed);
- `git diff --check`.

Retained failures: the first Java transfer stalled at zero bytes and was stopped; atomic partial
downloads, retries, and checksums then passed. A restricted-shell offline pnpm run could not see the
host cache; the identical no-network command passed against the actual workstation cache. A
sandboxed emulator launch timed out on its local hub port; the identical command passed when local
loopback ports were allowed. A direct Firebase CLI version probe attempted its global update/config
path; the repository wrapper disables that path and passed.
The first pnpm-invoked tool verifier inherited a shell module path without `Get-FileHash`; checksum
calculation now uses the .NET SHA-256 API and the same `pnpm tools:verify` command passed.

This slice establishes dependency/tool availability and emulator lifecycle only. It does not yet
establish Admin SDK persistence, LangGraph execution/checkpoint compatibility, qualification,
simulator, API, Phase 1 UI, diagrams, or production behavior.

## External evidence and gates

The dated Military.com research record is `docs/research/military-com-intake-2026-10-24.md`.
Official LangGraph, Firebase, Structurizr, Adoptium, npm, and release metadata supported the
dependency record. Approved artifacts are installed only in local workspace/ignored caches.

No GitHub remote, hosted CI, GCP resource, real personal data, provider credential, paid/model call,
live enrichment call, external communication, or public publication was created. All PROJECT.md
gates remain unresolved.

## Next action

Commit the verified 1.1–1.5 slice as the first Phase 1 implementation commit, then begin task 2.1:
freeze the Phase 1 versioned domain schemas and boundary cases before implementing rubric/runtime
behavior. With no remote, there is no draft PR or hosted CI.
