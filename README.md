<div align="center">

# LeadFlow AI

**Turns a fictional auto-insurance inquiry into a stored, scored and enriched lead with an email
draft a person can approve, on your own machine or as a private one-person cloud demo.**

Fictional leads Â· Firestore Emulator Â· Public vehicle and ZIP data Â· No AI model or paid API

<img src="docs/readme/principles.svg" alt="Three principles: persist before processing, verified sources, human approval" width="100%">

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

`pnpm check` is the offline gate: formatting, lint, strict TypeScript, tests, builds, the fixed
evaluation cases, local smoke tests, diagram and docs checks, governance and OpenSpec validation. It
needs no credentials and makes no outside calls.

To use the app, run each line in its own activated PowerShell window, waiting for each to report
that it is ready:

```powershell
pnpm emulator:start
pnpm build; pnpm api:local -- --enrichment=recorded
pnpm seed:local
pnpm --filter @leadflow-ai/web exec vite
```

Open the URL Vite prints. It opens on the LeadFlow AI cover; `#intake` takes a new fictional lead,
`#runs` shows leads and the approval queue, and `#metrics` shows the dashboard. The seed adds 40 fictional leads that use saved
responses. Run `pnpm api:local` without `--enrichment` to look up the real public sources for leads
you enter. Stopping the emulator discards all state.

## How it works

<img src="docs/diagrams/architecture.svg" alt="Local architecture: operator dossier, Fastify API, workflow runtime and domain contracts, Firestore Emulator and offline evaluator inside the workstation boundary; NHTSA vPIC and Zippopotam.us as external sources; model provider, outreach sending and real personal data deferred" width="100%">

1. An operator enters a fictional inquiry. The API saves the lead and its run in one Firestore
   transaction before any work starts
   ([sequence](docs/diagrams/persist-before-processing.svg)).
2. A fixed LangGraph.js workflow scores marketing readiness with a fixed 100-point rubric. The
   score measures how ready the lead is for follow-up, never insurance eligibility or price.
3. It checks the vehicle against NHTSA's public vehicle database and looks up the ZIP Code. Each
   answer is stored with its source, time and a fingerprint, labelled live, recorded or mock. A
   source that does not answer is shown as unavailable, never as a "no".
4. If the lead agreed to be contacted, it writes an email draft from a fixed template. Every
   sentence comes from the inquiry, from a verified answer, or from fixed wording.
5. Eight checks run before a draft reaches a person: sources are complete, claims are verified,
   consent is recorded, there is no pricing or eligibility language, and none of the lead's own
   free text is copied in.

## Agent orchestration

<img src="docs/diagrams/agent-architecture.svg" alt="Agent architecture: after the intake API commits a lead, a LangGraph orchestrator dispatches in order to a qualification agent, an enrichment agent that reads NHTSA vPIC and Zippopotam.us, an outreach agent and a verifier guard; a passing draft goes to human review, and a stopped run resumes from its checkpoint" width="100%">

A LangGraph orchestrator runs three specialist agents and a verifier in a fixed order. The
qualification agent scores the inquiry, the enrichment agent looks up public vehicle and ZIP data,
and the outreach agent writes a draft only when consent is recorded. Agents never call each other;
the orchestrator saves a checkpoint after every step, so a stopped run resumes where it left off.
The agents are deterministic today. A language model would sit behind the same interface once its
gate in [PROJECT.md](PROJECT.md) is opened.

## Human review

<img src="docs/diagrams/review-flow.svg" alt="Flow from qualify, enrich, compose and verify to pending review, with branches for no draft, blocked draft, human review and manual use only" width="100%">

A draft that passes waits in the approval queue. The operator can approve it, reject it or edit
it. An edit becomes a new version that is checked again. An approval applies to that exact text
and means the draft may be copied or exported for manual use. LeadFlow has no way to send email,
and a governance check fails the build if one appears. The stored records are in the
[data model](docs/diagrams/data-model.svg) and the
[enrichment and review records](docs/diagrams/data-model-outreach.svg).

## Recovery

<img src="docs/diagrams/run-lifecycle.svg" alt="Run lifecycle: persisted, running, retrying, partial, failed retryable, failed terminal and complete, with lease reclaim and operator resume" width="100%">

Every step is saved as it happens. A temporary fault gets one retry, and a run that still fails can
be resumed by the operator. A run stopped by a crash can be picked up again once its lease expires,
and lookups that were in flight are repeated. Failures stay visible rather than turning into
success.

## Private hosted demo

<img src="docs/diagrams/private-cloud.svg" alt="Private cloud deployment in Toronto: the owner's browser signs in through Identity-Aware Proxy, which forwards a signed assertion to one Cloud Run container serving the web app and API; the container uses Firestore through its own service identity; Cloud Build builds one exact commit and pushes it to Artifact Registry, whose digest is deployed; logs and metrics go to the platform" width="100%">

The same code also runs as one private Google Cloud Run service in Toronto, for one owner to
demonstrate with fictional leads. Google's Identity-Aware Proxy asks for a Google sign-in before
any page loads, and the app checks Google's signed identity header and an allowlist of one account
on every request. Only the server talks to Firestore; the browser cannot. Saved lookup responses
are used instead of live ones, and every stored record expires after seven days.

<img src="docs/diagrams/hosted-execution.svg" alt="Hosted sequence: intake is committed and answered with 202 without starting work; the browser then sends a separate execution request that claims a 75-second lease and runs the workflow for at most 45 seconds while the browser polls stored progress every three seconds; the request answers when the run finishes or stops at its limit, and a stopped run is resumed later" width="100%">

Cloud Run gives a service processor time only while a request is open, so the hosted app does not
work in the background. After the lead is saved, the browser sends a second request that holds
the run open while it polls for progress. A run stopped at its time limit stays saved and can be
resumed. Each release is built from one public commit, deployed by its image fingerprint and kept
for at most seven days ([retention and teardown](docs/diagrams/hosted-lifecycle.svg),
[runbook](docs/operations/runbook.md)). The hosted mode is built and checked locally; whether it
has been deployed, and what that deployment showed, is recorded in the
[evidence index](docs/evidence/phase-3/index.json).

## Dashboard

The metrics view shows lead volume, priority mix, processing time, lookup success, failed runs and
the approval queue. Each figure is calculated from stored runs and states what it counts and what it
leaves out. Live and saved lookups are never added together, and the synthetic simulator's
outcomes appear only in their own labelled panel. Every chart also has a table of its values.

## Evidence

<!-- bottom-line:start -->
- 84 fixed synthetic evaluation cases
- rubric-v1 weights: need timeline 40, request clarity 30, completeness 30
<!-- bottom-line:end -->

Results are tied to a system bundle that records the code, lockfile, cases and tool versions. Cases
that need a hosted model, the live sources, the deployed service, real personal data or production
are reported as `not_run`, never as passes. The live lookups were checked once with an authorized
probe, and their saved responses are what the offline tests use. See [AI_OPS.md](AI_OPS.md).

## Limits

- This is a prototype. The hosted mode is a private demonstration for one person, not a
  production service: one instance, no availability promise and no public access.
- Every lead, contact and outcome is fictional. Of the demo's fields, ZIP Code, vehicle year, make
  and model, name and email match questions on the public Military.com form
  ([source record](docs/research/military-com-intake-2026-10-26.md)). That form also asks about
  driving record, insurance history and personal details that LeadFlow leaves out, so form parity
  is not claimed.
- AI models, real personal data, live lookups from the cloud and any sending of messages stay
  behind the gates in [PROJECT.md](PROJECT.md).

## Commands

| Command | What it does |
|---|---|
| `pnpm check` | Full offline gate |
| `pnpm emulator:start` | Temporary Firestore Emulator on `127.0.0.1:8080` |
| `pnpm api:local` | Serve the API with live lookups; add `-- --enrichment=recorded` for saved responses |
| `pnpm seed:local` | Add 40 fictional leads through the API (saved responses only) |
| `pnpm enrichment:probe` | Owner-authorized live lookup that refreshes the saved responses |
| `pnpm emulator:runtime` | End-to-end test of the API and workflow against the emulator |
| `pnpm eval` | Run the fixed evaluation cases (after `pnpm build`) |
| `pnpm docs:diagrams` | Regenerate the diagrams and README assets |
| `pnpm audit:dependencies` | Registry audit (network; never applies fixes) |

## Documents

| Document | Contents |
|---|---|
| [PROJECT.md](PROJECT.md) | Scope, decisions, roadmap and operator gates |
| [docs/development.md](docs/development.md) | Toolchain, local session and shell workarounds |
| [docs/architecture/workspace.dsl](docs/architecture/workspace.dsl) | Structurizr model behind the diagrams |
| [docs/dependencies/phase-2.md](docs/dependencies/phase-2.md) | Phase 2 dependencies, licences and limits |
| [docs/dependencies/phase-3.md](docs/dependencies/phase-3.md) | Phase 3 container base and IAP verification library |
| [docs/operations/runbook.md](docs/operations/runbook.md) | Hosted setup, release, smoke, rollback, purge and teardown |
| [docs/evidence/phase-3/index.json](docs/evidence/phase-3/index.json) | Deployment evidence, with checks not yet run marked `not_run` |
| [docs/walkthrough.md](docs/walkthrough.md) | Timed script for the two-minute captioned walkthrough |
| [WORKFLOW.md](WORKFLOW.md) | Phase, review and verification workflow |

## Licence and credits

Released under the [MIT License](LICENSE). Vehicle data comes from NHTSA's
vPIC API, and ZIP data comes from Zippopotam.us, which uses GeoNames data. Diagrams are drawn with
the MIT-licensed [diagram-design](.agents/skills/diagram-design/SKILL.md) skill. Dependencies and
their licences are listed in [docs/dependencies/phase-1.md](docs/dependencies/phase-1.md),
[docs/dependencies/phase-2.md](docs/dependencies/phase-2.md) and
[docs/dependencies/phase-3.md](docs/dependencies/phase-3.md).

LeadFlow AI is an independent portfolio prototype. It is not affiliated with or endorsed by
Military.com, NHTSA, Google or any insurer.
