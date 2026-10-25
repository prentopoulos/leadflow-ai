<div align="center">

# LeadFlow AI

**Turns a fictional auto-insurance lead into a stored, scored and recoverable qualification run,
entirely on your machine.**

Synthetic data only · Firestore Emulator · No model or paid API calls

<img src="docs/readme/principles.svg" alt="Three principles: persist before processing, deterministic rubric, synthetic by design" width="100%">

</div>

## Start

Windows PowerShell, from the repository root. The bootstrap downloads only checksum-verified Java,
Firestore Emulator and Structurizr artifacts into the ignored `.tools/` folder.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-phase1-tools.ps1
. .\scripts\activate-toolchain.ps1
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` is the offline gate: toolchain preflight, formatting, lint, strict TypeScript, tests,
builds, the fixed evaluation corpus, loopback smokes, docs and architecture checks, governance and
strict OpenSpec validation. It needs no credentials.

To use the dossier yourself, run each line in its own activated PowerShell window, in order, and
start the next one only after the previous one reports it is ready:

```powershell
pnpm emulator:start
pnpm build; pnpm api:local
pnpm --filter @leadflow-ai/web exec vite
```

`pnpm api:local` records the current system bundle in the emulator, then serves the API on
`127.0.0.1:3001`. Open the URL Vite prints (normally `http://127.0.0.1:5173`) and submit a
fictional lead. Stopping the emulator discards all state.

## How it works

<img src="docs/diagrams/architecture.svg" alt="Local architecture: operator dossier, loopback Fastify API, qualification runtime and domain contracts, Firestore Emulator, offline evaluator, and deferred services outside the boundary" width="100%">

1. The **operator dossier** posts a fictional intake to the **Fastify API** on `127.0.0.1`.
2. One Firestore transaction stores the idempotency record, lead, run and first lifecycle event,
   and only then does the API answer `202 Accepted`
   ([sequence](docs/diagrams/persist-before-processing.svg)).
3. The **qualification runtime**, a fixed LangGraph.js graph, claims a lease and runs interpret,
   score, simulate and finalize, checkpointing every step into the emulator.
4. **Domain contracts** score marketing readiness with deterministic `rubric-v1` arithmetic. The
   interpreter is a deterministic stub, and `simulator-v1` produces score-independent synthetic
   outcomes that are labelled `not_live` and `not_predictive`.
5. The dossier polls the stored run and shows state, score, evidence, events and simulation.

## Recovery

<img src="docs/diagrams/run-lifecycle.svg" alt="Run lifecycle: persisted, running, retrying, partial, failed retryable, failed terminal and complete, with lease reclaim and operator resume" width="100%">

The first transient fault gets one retry. A fault that persists leaves the run `failed_retryable`,
which an operator can resume only at the expected revision with a compatible checkpoint. Unknown
or non-retryable faults end in `failed_terminal`. Crashes, stale revisions, lease races and
malformed stored state stay visible rather than turning into success.

The stored records and their relationships are in the [data model](docs/diagrams/data-model.svg).

## Evidence

<!-- bottom-line:start -->
- 38 fixed synthetic evaluation cases
- rubric-v1 weights: need timeline 40, request clarity 30, completeness 30
<!-- bottom-line:end -->

Evaluation results are bound to a system bundle that records code, lockfile, fixture, contract,
tool and environment identity. Cases that need a hosted model, live enrichment, cloud Firestore,
real personal data or production readiness are reported as `not_run`, never as passes. See
[AI_OPS.md](AI_OPS.md).

## Limits

- Phase 1 is a local prototype. Nothing is deployed, and no cloud resource exists.
- Every lead, contact and outcome is fictional. The intake's only field verified against the public
  Military.com landing page is ZIP code
  ([source record](docs/research/military-com-intake-2026-10-24.md)), and form parity is
  unresolved.
- Model providers, live enrichment, authentication, cloud Firestore and outreach are deferred
  behind the gates in [PROJECT.md](PROJECT.md). No message is ever sent automatically.

## Commands

| Command | What it does |
|---|---|
| `pnpm check` | Full offline gate |
| `pnpm emulator:start` | Ephemeral Firestore Emulator on `127.0.0.1:8080` |
| `pnpm api:local` | Record the system bundle and serve the API against a running emulator |
| `pnpm emulator:runtime` | Real emulator probe of the runtime persistence boundary |
| `pnpm eval` | Run the fixed evaluation corpus (after `pnpm build`) |
| `pnpm docs:diagrams` | Regenerate the diagrams and README assets, then export SVGs |
| `pnpm docs:check` | Check README links and figures, diagram freshness and the architecture model |
| `pnpm audit:dependencies` | Connected registry audit (network; never applies fixes) |

## Documents

| Document | Contents |
|---|---|
| [PROJECT.md](PROJECT.md) | Scope, decisions, roadmap and operator gates |
| [docs/development.md](docs/development.md) | Toolchain, emulator modes and shell workarounds |
| [docs/architecture/workspace.dsl](docs/architecture/workspace.dsl) | Structurizr model behind every diagram |
| [docs/dependencies/phase-1.md](docs/dependencies/phase-1.md) | Pinned dependencies, licences and limits |
| [WORKFLOW.md](WORKFLOW.md) | Phase, review and verification workflow |

## Licence and credits

No licence has been chosen yet. That decision belongs to the public-release phase in
[PROJECT.md](PROJECT.md), so no reuse rights are granted until then. Diagrams are drawn with the
MIT-licensed [diagram-design](.agents/skills/diagram-design/SKILL.md) skill. Third-party
dependencies and their licences are listed in
[docs/dependencies/phase-1.md](docs/dependencies/phase-1.md).

LeadFlow AI is an independent portfolio prototype. It is not affiliated with or endorsed by
Military.com or any insurer.
