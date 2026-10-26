# LeadFlow AI

Owner: Peter. Created: 2026-10-23.

## 1. Goal

Build a visually strong, secure proof of concept for Military.com's auto-insurance lead funnel.
LeadFlow AI saves an inquiry immediately, coordinates three specialized agents to qualify and
enrich it, prepares consent-gated outreach for human review, verifies evidence and security rules,
and shows live workflow progress and operational metrics to a sales operator.

This is a marketing lead-processing demonstration. It is not an insurance quote engine, an
underwriting or eligibility system, a pricing tool, a CRM replacement, or an autonomous outreach
system. The demonstrated identities and contact details are fictional.

## 2. Current scope boundary

The MVP includes a verified recreation of the relevant intake experience, immediate Firestore
persistence, a LangGraph.js workflow, qualification, enrichment, outreach drafting, verification,
consent and human-approval controls, execution logs, and a responsive dashboard. Qualification
measures marketing readiness using a deterministic 100-point rubric after structured LLM
interpretation; it never measures insurability.

NHTSA VIN decoding and Zippopotam.us ZIP lookup are real read-only integrations. Email checks may
validate syntax and domain evidence but never claim that a mailbox exists or belongs to a person.
The exact Military.com questions, including whether VIN and renewal timeline are collected, remain
TBD until verified. Fields not confirmed from the real funnel must be visibly labeled as demo
fields, not represented as Military.com fields.

Local implementation and synthetic fixtures come first. GCP deployment, Firebase Auth, live model
calls, public GitHub publication, and any paid quota remain behind the gates below. Insurer
integrations, real quotes, automatic email/SMS, a Bayesian engine, fully autonomous self-hosted
agents, and additional services are out of scope unless the owner amends this project.

## 3. Acceptance and evidence

- A synthetic lead is persisted before agent processing begins, and its progress, retries, failures,
  verification result, and final state remain inspectable.
- Qualification returns structured reasons, missing information, priority, and a deterministic
  score matching the documented 40/30/30 rubric on fixed test cases.
- Live enrichment evidence names the source, request subject, retrieval time, and success/failure;
  mocks prove contracts only and are labeled.
- Outreach is absent when contact consent is missing. With consent it is a draft awaiting human
  approval; no product path sends it automatically.
- The dashboard calculates lead volume, priority distribution, processing time, enrichment success,
  agent failures, and approval-queue counts from stored run data, with fixtures clearly labeled.
- Intake, dashboard, loading, empty, partial, error, and long-content states work at desktop and
  390px mobile widths with keyboard access, visible focus, semantics, and reduced-motion support.
- The local quality gate and `openspec validate --all --strict` pass. Live cloud or provider claims
  require separately recorded evidence from an owner-authorized run.

Read [AI_OPS.md](AI_OPS.md) and the
[AI-ops skill](.agents/skills/leadflow-ai-ai-ops/SKILL.md) for model, prompt, evaluation,
agent-runtime, state, monitoring, or provider changes.

## 4. Stack and commands

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide icons, and Recharts.
- Backend: Node.js and TypeScript, with the exact HTTP framework selected in Phase 0.
- Orchestration: LangGraph.js with structured JSON state, bounded retries, and explicit failures.
- AI: Claude or OpenAI through a backend-only adapter; provider, model, and budget are TBD.
- Data and auth: Google Firestore and Firebase Auth.
- Hosting: Google Cloud Run, subject to account eligibility and the deployment gate.
- Enrichment: NHTSA vehicle APIs, Zippopotam.us, and a bounded email syntax/domain check.
- Frontend method: project-local frontend-product workflow coordinated with Impeccable,
  ui-ux-pro-max, design-taste for public pages only, 21st.dev for inspiration/sketches, and
  design-eval before UI readiness. Paid 21st generation requires owner approval.
- Architecture diagrams: C4 as code, drawn to the c4model.com notation guide (context and
  container views, plus an ERD once there is a data schema). One Structurizr DSL model in
  `docs/architecture/` as the source model, rendered with the diagram-design skill
  (`pnpm docs:diagrams`); READMEs follow the showcase skill and never use Mermaid.
- Code review: every change to code is reviewed before merge (WORKFLOW.md).

Gate: `. .\scripts\activate-toolchain.ps1` followed by `pnpm check`. The gate is credential-free
and offline after the frozen dependency install. Run `pnpm audit:dependencies` separately when
registry access is authorized; it is evidence, not part of the offline gate.
Public GitHub repository planned; no remote exists yet. Do not run `git push` or `gh` until the
owner authorizes repository creation/publication. Once a remote exists, push phase branches and
open PRs at the points WORKFLOW.md sets; nothing goes straight to main, and a PR merges only after
review and the owner's go-ahead.

### Phase 0 decisions

Accepted by Peter on 2026-10-23 for the Phase 0 proposal:

- Pin Node.js 24.22.1 LTS and pnpm 12.15.0; Peter authorized their local activation and the
  dependency downloads needed for Phase 0.
- Use a private pnpm workspace with `apps/web`, `apps/api`, `packages/domain`, and
  `packages/evals`; use private provisional package names under `@leadflow-ai/*`.
- Use Fastify 5 for the backend HTTP boundary, Zod 4 as the shared schema source, JSON Schema
  Draft 2020-12 for exported contracts, ESM, strict TypeScript 6, React 19.3, Vite 8, Tailwind
  CSS 4.3, ESLint 10, exact-pinned Prettier 3.9.10, and Vitest 5.
- Keep Phase 0 local-only. Docker, hosted CI, public package/repository identity, and licence
  selection remain deferred to their later phases and gates.
- The root quality command is `pnpm check`. It remains credential-free and offline after dependency
  bootstrap and was verified on the Phase 0 implementation revision recorded in HANDOFF.md.
- Peter authorized a separately named connected dependency audit against the package registry.
  It is not part of the offline `pnpm check` command and never fixes dependencies automatically.
- Freeze deterministic synthetic cases for rubric arithmetic, schema rejection, consent,
  injection resistance, unavailable enrichment, invalid events, and partial/failed runs. Every
  applicable assertion must pass; deferred capabilities remain `not_run`.
- Priority thresholds, field-level completeness rules, processing-time boundaries, enrichment
  success and agent-failure denominators, and model-quality percentages remain explicitly TBD.
- Complete the recorded Phase 0 acceptance criteria without a separate hours cap; defer
  nonessential later-phase infrastructure rather than weakening the checks.

### Phase 1 decisions

Accepted by Peter on 2026-10-24 for the Phase 1 proposal:

- Keep Phase 1 local-only and synthetic. Use the Firestore Emulator as the sole durable application
  store, keep browser traffic behind Fastify, and bind every listener to `127.0.0.1`.
- Treat ZIP code as the only exact Military.com field verified from the current public landing page.
  Name, email, vehicle, coverage, timeline, intent, request-detail, and consent inputs are LeadFlow
  demo fields; the Military.com intake-parity gate remains unresolved.
- Persist the lead, run, first lifecycle event, and idempotency record atomically before LangGraph
  execution. Use a project-owned Firestore implementation of LangGraph.js's checkpoint interface,
  because the official JavaScript checkpointer list has no Firestore implementation.
- Use one sequential qualification workflow with one bounded retry for explicitly transient local
  faults and an idempotent operator resume action. Do not add live enrichment, outreach, or a
  general-purpose autonomous tool loop.
- Use a deterministic structured interpreter stub and `rubric-v1`: need timeline 40 points, request
  clarity 30 points, and completeness 30 points. Priority is `high` at 80–100, `standard` at 50–79,
  and `nurture` at 0–49; invalid or unsupported evidence holds priority instead of guessing.
- Keep provider, model, prompt, and paid-call fields null and provider cases `not_run`. The paid/API
  gate remains unresolved.
- Add a fixed-seed synthetic outcome simulator only to exercise lifecycle and metric contracts. Its
  outcomes are independent of score, visibly synthetic, and are not evidence that the rubric
  predicts conversion.
- Use a restrained operations-led interface: a continuous intake-to-run workspace, warm neutral
  surfaces, dark ink, one teal accent, thin borders, minimal motion, and no Military.com visual
  imitation. Evidence, source status, failures, and the persistent synthetic label stay close to
  the result they qualify.
- Pin and locally activate Java 21 for the Firestore Emulator and Structurizr tooling without
  changing the accepted Node/pnpm versions. Normal `pnpm check` remains credential-free and offline
  after the frozen dependency/tool bootstrap.

### Phase 2 decisions

Accepted by Peter on 2026-10-25 for the Phase 2 proposal (round-1 grilling; every recommendation
was accepted as presented):

- Phase 2 builds enrichment, outreach drafts, verification, the dashboard and run monitoring.
  Firebase Auth moves to Phase 3's access-control task with deployment. Phase 2 records a fixed,
  labelled local operator principal on approvals and adds a loopback Host/Origin allowlist.
- Peter authorizes live, read-only GET requests from the local machine to exactly
  `vpic.nhtsa.dot.gov` and `api.zippopotam.us`: only ZIP and vehicle year/make leave the machine,
  one request per source per lead, a 5-second timeout, and at most one retry on network error, 429
  or 5xx. Live reads run only for operator-submitted leads and a separately named probe. The offline
  gate uses fixtures labelled `recorded` (captured from an authorized live call, with date) or
  `mock` (hand-written). Evidence credits NHTSA vPIC and Zippopotam.us / GeoNames.
- Vehicle enrichment keeps year/make/model and checks it with vPIC `GetModelsForMakeYear`. The claim
  is only "make/model listed by NHTSA vPIC for that model year"; matching is exact and
  case-insensitive, and a mismatch is reported, never corrected. VIN decoding is deferred until the
  Military.com VIN question is verified.
- The paid-API gate stays unresolved. The interpreter stays deterministic and drafts come from a
  deterministic slot template behind a provider-neutral port; provider cases remain `not_run`.
- Outreach is an email draft only, created when consent is true and qualification is not held, for
  every priority. States are `pending_review -> approved | rejected`; an edit creates a new immutable
  revision back in `pending_review`; approval binds to the revision digest, operator and time.
  Approved means approved for manual use (copy/export). No send path exists and a check enforces it.
  Follow-up actions: high "Review today", standard "Review this week", nurture "Add to nurture
  list". Drafts carry a fixed CAN-SPAM notice and never invent a postal address.
- Metric definitions (`metrics-definitions-v1`): processing time runs from `lead.persisted` to the
  last automated event, excluding human review (reported as review latency), with median, p90, mean
  and n. Enrichment success is per source lookup: valid found or not-found answers succeed;
  unavailable, timeout, 429, 5xx and malformed fail; not-attempted lookups are excluded but counted;
  a found-rate is separate. Agent failures are runs whose latest state is failed among finished
  runs, with a per-agent breakdown; a recovered retry is not a failure. The approval queue counts
  drafts whose latest revision is `pending_review`. Every metric names numerator, denominator,
  exclusions and window, filters to the current system bundle, shows `insufficient_data` for empty
  denominators, keeps simulator outcomes in a separate SYNTHETIC panel, and splits live from
  recorded evidence. Priority labels stay high/standard/nurture plus held and not scored.
- An unavailable enrichment source leaves the run complete but `partial`; a draft that fails
  verification is stored `verification_blocked` outside the approval queue with a visible hold;
  corrupt internal state fails the run terminally.
- Intake moves to a new schema version that records the consent wording version and a digest of the
  exact text shown. Phase 1 emulator data is cleared, not migrated.
- Each lookup stores a bounded raw response and its SHA-256 until local reset; no cache is shared
  across leads.
- A run completes when its draft reaches `pending_review`; approve/reject are separate append-only
  review records, not a LangGraph interrupt.
- WCAG 2.2 AA is the explicit UI target: chart text equivalents, no colour-only encoding, 3:1 chart
  marks, unobscured focus, 24px targets, polite live regions and reduced-motion charts.
- A fixed fictional seed command runs 40 leads through the real pipeline with `recorded` enrichment.
- Peter authorizes downloading recharts, lucide-react, and the shadcn/ui components with their Radix
  dependencies, recorded in `docs/dependencies/phase-2.md`. No SSE, Firebase client or provider SDK.
- The interface has three views: intake -> run dossier; a leads/runs list with the approval queue as
  a filter and run monitoring; and the metrics dashboard. Alerting stays deferred.

Settled by the agent with a cited basis and accepted in the same confirmation: syntax-plus-
reserved-domain email check with no network call (recorded/fact); revision-aware polling through
Fastify (default); background in-process execution with resume returning 202 and a fixed
qualify -> enrich -> draft -> verify -> finalize graph (default); `rubric-v1` unchanged by enrichment
(recorded); the Phase 1 visual direction extended, free 21st inspiration only (recorded);
verification rules derived from section 5 and mapped to OWASP LLM Top 10 2025 and ASVS 5.0
(recorded); frozen `phase-2.0` cases (recorded); event-v1 as the telemetry system of record with
OpenTelemetry HTTP attribute names and no SDK (default); diagram and README rendering per the
owner's 2026-10-25 feedback.

## 5. Non-negotiables

These rules and the gates in section 6 are this project's constitution. They override AGENTS.md,
WORKFLOW.md, the skills, OpenSpec specs and HANDOFF.md; only the owner's current instructions and
recorded gate decisions come before them.

**Version 1.0.0** · Ratified 2026-10-23 · Last amended 2026-10-23

- Secrets use the runtime secret mechanism (gitignored .env for local development); never print,
  commit or include them in reports.
- Never fabricate results or external-service output. Label mocked, local and live results
  accurately. Preserve failed runs.
- Operator resolves all gated actions. The agent never satisfies or waives one itself.
- Qualification scores marketing readiness only; never use or describe it as insurance eligibility,
  underwriting, pricing, risk, or personal financial advice.
- Use fictional identities and test contact details in development, demonstrations, screenshots,
  prompts, fixtures, and public repository content unless the real-data gate is explicitly resolved.
- Persist a lead before agent execution; represent partial progress, retries, verification failures,
  and unavailable external evidence honestly.
- Outreach requires recorded contact consent and human approval, remains a draft in this MVP, and
  is never sent automatically.
- Keep API keys on the backend, minimize data sent to models, require structured agent outputs, and
  verify external evidence before presenting it as enriched fact.
- Qualification uses the documented deterministic rubric; model interpretation may supply structured
  criterion evidence but may not silently change point weights or make insurance decisions.
- Claims about Military.com's form must be backed by verified source evidence; unconfirmed or added
  demo fields must be labeled as such.
- Dashboard metrics must come from stored run data or a clearly labeled synthetic fixture; never
  present illustrative values as live operational results.
- UI must preserve keyboard access, visible focus, semantic structure, reduced-motion behavior, and
  readable desktop and 390px mobile layouts.

### Amending the constitution

- Only the owner amends it: a change to a rule above, or adding, removing or loosening a gate.
  Recording an operator decision on a gate is not an amendment.
- An amendment states its reason and goes in its own `docs:` commit. That commit updates the
  verbatim copies in AGENTS.md and `openspec/config.yaml` and adds a row below. A check in the
  Phase 0 gate fails if a copy or the version line drifts.
- Version: major when a rule is removed or redefined, minor when one is added or materially widened,
  patch for wording only.

| Version | Date | Change | Decided by |
|---|---|---|---|
| 1.0.0 | 2026-10-23 | Ratified at setup | Peter (setup) |

## 6. Milestones and gates

Milestones are ordered by dependency.

| Phase | Deliverable | Status |
|---|---|---|
| 0 | Toolchain, app skeleton, lockfile, quality gate with constitution copy check, smoke checks, and offline AI evaluation scaffold | Done |
| 1 | Verified intake, immediate Firestore persistence, LangGraph orchestration, qualification agent, and C4 architecture diagrams as code | Done |
| 2 | Live enrichment, consent-gated outreach drafts, verification/security layer, responsive live dashboard, and run monitoring (Firebase Auth moved to Phase 3) | In progress |
| 3 | Owner-authorized Cloud Run deployment with Firebase Auth access control, public-repository polish, evidence bundle, README, and demonstration walkthrough | Planned |

### Lean task budgets for remaining phases

Future OpenSpec plans SHALL stay outcome-focused: no more than nine implementation tasks per phase,
one logical commit per task where practical, affected leaf checks during construction, and one clean
full gate at completion. Tests, documentation, and review evidence belong with the capability they
verify unless they are genuinely independent deliverables. These budgets organize work; they do not
resolve or waive any gate below.

**Phase 2 blueprint — at most nine tasks**

1. Add bounded live enrichment adapters with verified evidence and explicit unavailable states.
2. Add consent-gated outreach drafting with mandatory human approval and no sending path.
3. Add the verification/security layer across enrichment, drafts, prompts, and stored evidence.
4. Add Firebase Auth and the accepted local/remote access boundary after its gate is resolved.
5. Build the stored-data dashboard and run monitoring with honest metric denominators.
6. Complete the responsive operator flows and essential automated/rendered accessibility checks.
7. Extend evaluation, telemetry, architecture, and AI-operations evidence for the new boundaries.
8. Integrate the offline gate and any separately authorized live checks.
9. Run one consolidated review, fix findings, update handoff evidence, and prepare archive/merge.

**Phase 3 blueprint — at most six tasks**

1. Resolve the deployment and public-publication gates without broadening product scope.
2. Implement the approved Cloud Run/GCP configuration with secrets, budget, rollback, and access controls.
3. Prepare the public repository, README, licensing decision, and secret/private-data/history scans.
4. Produce the evidence bundle and demonstration walkthrough from verified stored results.
5. Run authorized deployment smoke, security, cost, observability, and rollback checks.
6. Run one consolidated review, fix findings, update final handoff evidence, and prepare archive/merge.

### Before paid API or AI quota

- [ ] Owner selects the provider/model or paid design tool, approves the account and spend ceiling,
  and provides credentials through an approved secret path.

### Before live GCP deployment or public exposure

- [ ] Owner selects the GCP project, region, account/billing path, budget, secrets path, and access
  policy; security, privacy, rollback, and cost checks pass.

### Before using real personal information

- [ ] Owner authorizes the specific data source and purpose after privacy, retention, access, prompt,
  logging, and deletion controls are documented and verified.

### Before any external communication

- [ ] Owner explicitly authorizes the exact channel and action. The MVP still provides drafts only;
  automated sending requires a constitution amendment and a new scoped phase.

### Before public GitHub publication

- [ ] Owner approves the public repository name and framing after secret, private-data, licensing,
  generated-asset, and history scans pass.

### Before claiming Military.com intake parity

- [ ] The actual funnel questions and wording are verified from a current source and the implemented
  form is reviewed against that evidence.
