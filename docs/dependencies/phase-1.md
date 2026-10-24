# Phase 1 dependency decision

Decision date: 2026-10-24. Scope: local, synthetic Phase 1 only.

The selected stack adds durable local workflow state and architecture validation without adding a
model-provider SDK, cloud credential, remote listener, or second application database. Versions are
exact-pinned so the ordinary quality gate can run from installed dependencies and cached tools.

## Selected versions

| Component | Exact version/artifact | Licence | Compatibility and purpose |
|---|---|---|---|
| LangGraph.js | `@langchain/langgraph` `1.5.2` | MIT | Requires Node 18+ and `@langchain/core` `^1.1.48`; Node 24.22.1 and core 1.3.0 satisfy that range. Supplies the fixed `StateGraph` workflow and `BaseCheckpointSaver` contract. |
| LangChain core | `@langchain/core` `1.3.0` | MIT | Requires Node 20+; used only for LangGraph runtime/configuration types. No model integration package is selected. |
| Firebase Admin SDK | `firebase-admin` `14.5.0` | Apache-2.0 | Requires Node 22+; Node 24.22.1 is supported. It is server-only and will be configured to fail closed unless the local emulator host and synthetic project ID validate. |
| Firebase CLI | `firebase-tools` `15.34.1` | MIT | Declares Node 20, 22, or 24 support. It owns the local Emulator Suite lifecycle and is a root development dependency, not an application runtime dependency. |
| Firestore Emulator | `cloud-firestore-emulator-v1.22.0.jar` | Google-owned binary under the Firebase service terms, with bundled third-party notices | Pinned by Firebase CLI 15.34.1. SHA-256 `9b6498b7f62714d67f48f59b3818883cd682dbcd46b9f59511de81c97bb5166c`; cached but never redistributed from `.tools/firebase/emulators`. |
| Java | Eclipse Temurin JDK `21.0.12.1+1`, Windows x64 HotSpot | GPL-2.0 with Classpath Exception | Java 21 satisfies the current Firestore guidance and Structurizr's Java 17+ minimum. Archive SHA-256 `f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e`. |
| Structurizr CLI | `2025.11.09` | Apache-2.0 | The final release from the archived official CLI repository. Runs on Java 17+; Java 21 is selected. Archive SHA-256 `f5365a463fc44d539ed19bec00c48ba1e1ecda0ccfd1ba40d2e7472d264eb79a`. |

Exact download URLs and checksums are machine-readable in
[`toolchain.phase1.json`](../../toolchain.phase1.json).

## Compatibility evidence

- The npm registry metadata was checked on 2026-10-24 for package versions, licences, engines, and
  LangGraph peer requirements.
- Current LangGraph.js documentation defines custom checkpoint persistence through
  `BaseCheckpointSaver` methods including `put`, `putWrites`, `getTuple`, and ordered `list`; the
  documented JavaScript saver set does not include Firestore. Phase 1 therefore owns a small
  Firestore implementation and pins its contract tests to LangGraph 1.5.2.
- Firebase documents `FIRESTORE_EMULATOR_HOST` without a protocol, matching project IDs between the
  CLI and Admin SDK, `emulators:start`/`emulators:exec`, explicit import/export, and the emulator
  flush endpoint. Firebase's current Firestore guidance says to move to Java 21 or later for the
  latest emulator.
- `firebase-tools` 15.34.1 identifies Firestore Emulator 1.22.0 and supports the
  `FIREBASE_EMULATORS_PATH` cache override. LeadFlow uses that override so the repository-local
  ignored cache supports offline reuse.
- Structurizr CLI validates local DSL with `validate -workspace` and exports with
  `export -workspace ... -format ...`; the official installation guide requires Java 17+.

## Alternatives considered

- LangGraph's in-memory saver was rejected because restart recovery is required. SQLite/Postgres
  savers were rejected because Firestore is the Phase 1 durable authority and a second store would
  create avoidable consistency work.
- Putting orchestration and persistence directly in `apps/api` was rejected. A private
  `@leadflow-ai/runtime` package keeps adapters independently testable while preserving the one-way
  dependency on pure domain contracts.
- A browser Firebase SDK was rejected. The browser writes through Fastify so validation,
  server-owned IDs, idempotency, and the local-only boundary stay enforceable.
- A system Java installation was rejected. Project-local Temurin activation leaves unrelated
  machine installations unchanged and makes the accepted version explicit.
- Dockerized emulators and diagram tools were rejected for this local Windows phase because they
  would add an unselected runtime and do not improve the current single-operator boundary.

## Limits and recheck triggers

The Firestore Emulator does not establish production Firestore index behavior, security rules,
transaction contention/limits, deployed concurrency, backup, restore, IAM, or availability. The
Structurizr CLI repository is archived; the pin remains usable for Phase 1, but any Java/runtime
incompatibility or architecture-format change requires a replacement decision. Recheck this record
before upgrading any pinned package/tool, enabling a provider, accessing cloud Firestore, using real
personal information, exposing a listener, or making a production-readiness claim.

Sources: [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence),
[Firebase Emulator installation](https://firebase.google.com/docs/emulator-suite/install_and_configure),
[Firestore Emulator connection](https://firebase.google.com/docs/emulator-suite/connect_firestore),
[Structurizr CLI installation](https://docs.structurizr.com/cli/installation),
[Structurizr CLI release](https://github.com/structurizr/cli/releases/tag/v2025.11.09), and
[Adoptium Java 21 releases](https://adoptium.net/temurin/releases/?version=21).
