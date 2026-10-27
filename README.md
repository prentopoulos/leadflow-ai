<div align="center">

# LeadFlow AI

**Turns a fictional auto-insurance inquiry into a stored, scored and enriched lead with an email
draft a person can approve, on your own machine or as a private one-person cloud demo.**

Fictional leads · Firestore Emulator · Public vehicle and ZIP data · Optional Claude agent team

</div>

## Start

Clone the public repository, then enter it:

```console
git clone https://github.com/prentopoulos/leadflow-ai.git
cd leadflow-ai
```

On macOS (Apple Silicon or Intel), use the project-local Bash toolchain:

```bash
bash ./scripts/bootstrap-phase1-tools.sh
source ./scripts/activate-toolchain.sh
pnpm install --frozen-lockfile
pnpm check
```

On Windows, use PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-phase1-tools.ps1
. .\scripts\activate-toolchain.ps1
pnpm install --frozen-lockfile
pnpm check
```

Both bootstraps download only checksum-verified Node.js, Java, Firestore Emulator and Structurizr
artifacts into the ignored `.tools/` folder. No system-wide Node or Java installation is required.
`pnpm check` is the offline gate: formatting, lint, strict TypeScript, tests, builds, the fixed
evaluation cases, local smoke tests, diagram and docs checks, governance and OpenSpec validation. It
needs no credentials and makes no outside calls.

### Run the demo

In an activated shell (above), one command starts everything with saved responses:

```console
pnpm demo
```

Open the link it prints (the Metrics view), then press **Run simulated traffic**. Sixty fictional
leads arrive one every 10 seconds from made-up ad channels, and the cost-per-lead figures update
live. Press Ctrl+C to stop; nothing is kept. Add `-- --open` to open the browser for you.

`pnpm demo -- --agents` turns on the Claude agent team (below). It reads `ANTHROPIC_API_KEY` from
the gitignored `.env`, spends real money, and stops itself at $0.30 per lead and $8 per session.

## How it works

<img src="docs/diagrams/pipeline.svg" alt="LeadFlow pipeline: a fictional inquiry is stored before processing, scored for marketing readiness, enriched from public sources, optionally given one cited research paragraph, checked and held for human review; nothing is sent" width="100%">

1. An operator enters a fictional inquiry. The API saves the lead and its run in one Firestore
   transaction before any work starts.
2. A fixed LangGraph.js workflow scores marketing readiness with a fixed 100-point rubric. The
   score measures how ready the lead is for follow-up, never insurance eligibility or price.
3. It checks the vehicle against NHTSA's public vehicle database and looks up the ZIP Code. Each
   answer is stored with its source, time and a fingerprint, labelled live, recorded or mock. A
   source that does not answer is shown as unavailable, never as a "no".
4. If the lead agreed to be contacted, it writes an email draft from a fixed template. Every
   sentence comes from the inquiry, from a verified answer, or from fixed wording. With the agent
   team switched on, one extra paragraph comes from cited web research.
5. Eight checks run before a draft reaches a person: sources are complete, claims are verified,
   consent is recorded, there is no pricing or eligibility language, and none of the lead's own
   free text is copied in.

## Technical system

<img src="docs/diagrams/architecture.svg" alt="Technical boundary: the browser calls a loopback Fastify server, which stores the lead before the LangGraph workflow uses deterministic rules, read-only vehicle and ZIP sources, and an optional local-only Claude service" width="100%">

The browser calls a loopback Fastify API and never talks to Firestore directly. The API persists the
lead, runs the fixed graph and records every step. Only two optional outbound calls exist in local
mode: read-only requests to NHTSA vPIC and Zippopotam.us. Recorded responses keep the whole demo and
quality gate offline.

## Optional research team

<img src="docs/diagrams/agent-workflow.svg" alt="Optional research team: a lead plans bounded questions, three workers research vehicle, area and coverage topics in parallel, code checks every cited claim, the lead merges only kept claims, a writer drafts one paragraph, review allows at most two rewrites, and a person reviews the result" width="100%">

With `--agents`, the outreach agent becomes a small team that researches the lead's situation and
writes one short paragraph for the email. A Claude Sonnet 5.5 lead plans a few questions, three
Claude Haiku 5.5 workers search the web at the same time (the car, the area, the coverage the lead
asked about), and plain code keeps only the answers whose quoted source contains their numbers and
key words. A Sonnet writer drafts from those facts and cites them; a code checker and a Sonnet
critic review the paragraph, with at most two rewrites. The run's dossier shows every cited source
with its quote and what the run cost.

The models see the vehicle, the area and the coded answers, never the person's name, email, ZIP
Code or message; plain code adds the greeting. Every call reserves its worst-case cost first. A
failed check, a model error or the spend cap leaves the plain template draft. The paragraph is a
new slot in the same template, so the eight checks still run, now including the stored sources.
The hosted demo never uses the agent team.

## Human review

A draft that passes waits in the approval queue. The operator can approve it, reject it or edit
it. An edit becomes a new version that is checked again. An approval applies to that exact text
and means the draft may be copied or exported for manual use. LeadFlow has no way to send email,
and a governance check fails the build if one appears.

## Recovery

Every step is saved as it happens. A temporary fault gets one retry, and a run that still fails can
be resumed by the operator. A run stopped by a crash can be picked up again once its lease expires,
and lookups that were in flight are repeated. Failures stay visible rather than turning into
success.

## Security

<p align="center">
  <img src="docs/diagrams/security-trifecta.svg" alt="LeadFlow security trifecta: no current role combines untrusted input, real personal data and outbound or state-changing access; recorded local, live local and optional agent-local modes each hold at most two capabilities" width="900">
</p>

The current runtime cannot combine untrusted lead input, real personal data and a way to send data
out. Current modes accept bounded fictional input and no real personal data. Only live local
enrichment has fixed read-only HTTPS requests to NHTSA and Zippopotam.us. The optional local research
team can search and read public pages but receives no name, email, ZIP Code or request text. Insurer
connections, quotes, real personal data and automatic sending are absent. See [PROJECT.md](PROJECT.md) for
the gates that must be resolved before any of those boundaries changes.

## Private hosted demo

The same code also runs as one private Google Cloud Run service in Toronto, for one owner to
demonstrate with fictional leads. Google's Identity-Aware Proxy asks for a Google sign-in before
any page loads, and the app checks Google's signed identity header and an allowlist of one account
on every request. Only the server talks to Firestore; the browser cannot. Saved lookup responses
are used instead of live ones, and every stored record expires after seven days.

Cloud Run gives a service processor time only while a request is open, so the hosted app does not
work in the background. After the lead is saved, the browser sends a second request that holds
the run open while it polls for progress. A run stopped at its time limit stays saved and can be
resumed. Each release is built from one public commit, deployed by its image fingerprint and kept
for at most seven days (see the [runbook](docs/operations/runbook.md)). The hosted mode is built and checked locally; whether it
has been deployed, and what that deployment showed, is recorded in the
[evidence index](docs/evidence/phase-3/index.json).

## Dashboard

The metrics view shows lead volume, priority mix, processing time, lookup success, failed runs and
the approval queue. Each figure is calculated from stored runs and states what it counts and what it
leaves out. Live and saved lookups are never added together, and the synthetic simulator's
outcomes appear only in their own labelled panel. Every chart also has a table of its values.

### Simulated acquisition

The acquisition section shows where leads came from and what they cost. Each simulated lead
carries a made-up source, campaign and click ID. A fixed spend sheet gives each simulated campaign
a budget, so the dashboard can show cost per lead, cost per qualified lead and cost per lead that
agreed to be contacted, overall and by channel. Each channel's share of spend sits beside its
share of leads. Channels follow Google Analytics' default channel rules in simplified form.

Everything in this section is simulated: the spend, channels, campaigns and click IDs are made up,
and no Google Ads or Analytics data is used. Leads are assigned to channels at random, so
differences between channels show the calculation, not which channel is better.

## Evidence

<!-- bottom-line:start -->
- 90 fixed synthetic evaluation cases
- rubric-v1 weights: need timeline 40, request clarity 30, completeness 30
<!-- bottom-line:end -->

Results are tied to a system bundle that records the code, lockfile, cases and tool versions, and,
when the agent team runs, the provider, models and prompt fingerprint. The agent cases use a
scripted model, so they prove the checks, not the quality of Claude's writing. Cases that need a
hosted model, the live sources, the deployed service, real personal data or production are
reported as `not_run`, never as passes. The live lookups were checked once with an authorized
probe, and their saved responses are what the offline tests use. See [AI_OPS.md](AI_OPS.md).

## Limits

- This is a prototype. The hosted mode is a private demonstration for one person, not a
  production service: one instance, no availability promise and no public access.
- Every lead, contact and outcome is fictional. Of the demo's fields, ZIP Code, vehicle year, make
  and model, name and email match questions on the public Military.com form
  ([source record](docs/research/military-com-intake-2026-10-26.md)). That form also asks about
  driving record, insurance history and personal details that LeadFlow leaves out, so form parity
  is not claimed.
- The agent team is local and opt-in, under the owner's spend limits. Hosted model calls, real
  personal data, live lookups from the cloud and any sending of messages stay behind the gates in
  [PROJECT.md](PROJECT.md).

## Commands

| Command | What it does |
|---|---|
| `pnpm check` | Full offline gate |
| `pnpm emulator:start` | Temporary Firestore Emulator on `127.0.0.1:8080` |
| `pnpm api:local` | Serve the API with live lookups; add `-- --enrichment=recorded` for saved responses or `-- --agents=claude` for the agent team |
| `pnpm demo` | Start the emulator, API and web app for a live demo; add `-- --agents` for the paid Claude agent team |
| `pnpm simulate:traffic` | Send 60 fictional leads with simulated attribution through the API, one every 10 s (saved responses only) |
| `pnpm enrichment:probe` | Owner-authorized live lookup that refreshes the saved responses |
| `pnpm emulator:runtime` | End-to-end test of the API and workflow against the emulator |
| `pnpm eval` | Run the fixed evaluation cases (after `pnpm build`) |
| `pnpm docs:diagrams` | Regenerate the four documentation diagrams |
| `pnpm audit:dependencies` | Registry audit (network; never applies fixes) |

## Documents

| Document | Contents |
|---|---|
| [PROJECT.md](PROJECT.md) | Scope, decisions, roadmap and operator gates |
| [docs/development.md](docs/development.md) | Toolchain, local session and shell workarounds |
| [docs/architecture/workspace.dsl](docs/architecture/workspace.dsl) | Structurizr model behind the diagrams |
| [docs/dependencies/phase-2.md](docs/dependencies/phase-2.md) | Phase 2 dependencies, licences and limits |
| [docs/dependencies/phase-3.md](docs/dependencies/phase-3.md) | Phase 3 container base and IAP verification library |
| [docs/dependencies/phase-5.md](docs/dependencies/phase-5.md) | Phase 5 Anthropic SDK, models, prices and spend limits |
| [docs/operations/runbook.md](docs/operations/runbook.md) | Hosted setup, release, smoke, rollback, purge and teardown |
| [docs/evidence/phase-3/index.json](docs/evidence/phase-3/index.json) | Deployment evidence, with checks not yet run marked `not_run` |
| [docs/evidence/phase-4/index.json](docs/evidence/phase-4/index.json) | Phase 4 hosted demonstration evidence; every check `not_run` until the approved run |
| [docs/walkthrough.md](docs/walkthrough.md) | Timed script for the two-minute captioned walkthrough |
| [WORKFLOW.md](WORKFLOW.md) | Phase, review and verification workflow |

## Licence and credits

Released under the [MIT License](LICENSE). Vehicle data comes from NHTSA's
vPIC API, and ZIP data comes from Zippopotam.us, which uses GeoNames data. The optional agent team
uses Anthropic's Claude API. Diagrams are drawn with
the MIT-licensed [diagram-design](.agents/skills/diagram-design/SKILL.md) skill. Dependencies and
their licences are listed in [docs/dependencies/phase-1.md](docs/dependencies/phase-1.md),
[docs/dependencies/phase-2.md](docs/dependencies/phase-2.md),
[docs/dependencies/phase-3.md](docs/dependencies/phase-3.md) and
[docs/dependencies/phase-5.md](docs/dependencies/phase-5.md).

LeadFlow AI is an independent portfolio prototype. It is not affiliated with or endorsed by
Military.com, NHTSA, Google, Anthropic or any insurer.
