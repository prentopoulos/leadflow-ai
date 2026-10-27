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

Local implementation and synthetic fixtures come first. GCP deployment, live model calls, and any
paid quota remain behind the gates below; repository publication was resolved at the close of
Phase 2. Insurer
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
- Data and auth: Google Firestore and direct Cloud Run IAP for Phase 3 private access.
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
The public repository is `github.com/prentopoulos/leadflow-ai` (owner-authorized 2026-10-26; see
the publication gate in section 6). Push phase branches and open PRs at the points WORKFLOW.md sets;
nothing goes straight to main, and a PR merges only after review and the owner's go-ahead.

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
- At the close (2026-10-26) Peter licensed the project under MIT and approved publishing it as the
  public repository `prentopoulos/leadflow-ai` after the pre-publication scans (section 6 gate).

Settled by the agent with a cited basis and accepted in the same confirmation: syntax-plus-
reserved-domain email check with no network call (recorded/fact); revision-aware polling through
Fastify (default); background in-process execution with resume returning 202 and a fixed
qualify -> enrich -> draft -> verify -> finalize graph (default); `rubric-v1` unchanged by enrichment
(recorded); the Phase 1 visual direction extended, free 21st inspiration only (recorded);
verification rules derived from section 5 and mapped to OWASP LLM Top 10 2025 and ASVS 5.0
(recorded); frozen `phase-2.0` cases (recorded); event-v1 as the telemetry system of record with
OpenTelemetry HTTP attribute names and no SDK (default); diagram and README rendering per the
owner's 2026-10-25 feedback.

### Phase 3 decisions

Accepted by Peter on 2026-10-26 for the Phase 3 proposal after two informed-answer rounds and a
single consolidated confirmation:

- The hosted target is a private, single-owner, pilot-grade proof of concept, not production or an
  SLA/load claim. Direct Cloud Run IAP replaces the earlier Firebase Auth plan. The service has no
  `allUsers` or `allAuthenticatedUsers` binding, and Fastify validates the signed IAP assertion plus
  a private stable-subject allowlist before application or API access.
- One Cloud Run service serves the built web app and API. Intake still commits before returning
  `202`; cloud execution then runs in a separate authenticated, idempotent request held open while
  the browser polls stored progress. Local mode may retain the background executor. Initial limits
  are request-based billing, minimum zero, maximum one, one vCPU, 512 MiB, concurrency eight, a
  60-second request timeout, and an approximately 45-second workflow deadline.
- Firestore is Standard edition, Native mode, in Toronto (`northamerica-northeast2`), accessed only
  by the backend through ADC with deny-all client rules. Hosted synthetic records receive seven-day
  TTL metadata plus an explicit project/database-guarded recursive purge. No backup or PITR is
  enabled for this seedable synthetic data.
- Releases are owner-triggered from Cloud Shell through a checked-in, source-less Cloud Build
  definition that clones and verifies one exact public commit, reports an immutable Artifact
  Registry digest, and deploys that digest through checked-in configuration. GitHub Actions,
  mutable-tag promotion, long-lived service-account keys, and implicit Cloud Storage are excluded.
- The minimum planned services are Cloud Run, Artifact Registry, Firestore, IAP, Cloud Build, IAM,
  and Service Usage; Logging and Monitoring are verified. Firebase Auth/Identity Platform, Cloud
  Tasks, Firebase Hosting, a load balancer, Secret Manager without a real consumer, Cloud Storage,
  and a custom domain are excluded.
- The existing CA$10 Cloud Run control remains, and a project-wide CA$10 alert budget is planned
  with actual-spend alerts at 50%, 80%, and 100% plus a 100% forecast alert. At 50% the owner
  inspects attribution before another build/demo; at 80% new builds/demos stop; at 100% or on an
  unexpected charge deployment work stops and teardown begins. These are delayed controls, not an
  absolute whole-project cap.
- Deployed demonstrations use recorded enrichment only. The qualification rubric, metric
  definitions, evidence semantics, consent and human-review rules, no-send boundary, and intake-
  parity boundary do not change. Hosted data, screenshots, and walkthrough content remain
  fictional and visibly labelled.
- Evidence binds the exact source/lock/gate/review/scan result, build ID, image digest, revision,
  configuration and runtime identity. Authorized probes cover owner access and unauthenticated
  denial, signed-claim failures, Firestore denial/success, persist-before-`202`, request execution
  and polling, idempotency/recovery/conflict, labels/no-send/log privacy/cost, and verified rollback.
  The offline gate remains credential-free; deployed probes are separately named and authorized.
- Phase 3 includes the deferred accessibility refinements and minimal signing-in, signed-in,
  denied, expired, and retry states without redesigning the product. It produces a roughly
  two-minute captioned walkthrough plus `docs/walkthrough.md`; preview is private, while MP4
  publication needs a separate owner decision.
- Public-safe resource labels are fixed as service/repository `leadflow-ai-demo`, image `app`,
  runtime service account `leadflow-ai-runtime`, and IAP display name `LeadFlow AI Demo`. Exact
  project, account, principal, subject, audience, URL, IAM, and billing values remain private
  deployment parameters.
- After evidence and walkthrough approval, the service may remain for at most seven days before
  synthetic data, service access, the service, and non-final images are removed. The final image
  and empty repository may remain until day 30, then are deleted unless extended; the empty Toronto
  database and sanitized repository evidence remain.
- This confirmation authorizes the branch, OpenSpec artifacts, local planning checks, publication
  scans, spec-only commit, push, and draft PR. It does not authorize API enablement, resource
  creation, a build, deployment, merge, or MP4 publication; those actions remain gated.
- Owner decisions after the hosted proof (2026-10-27): hosting is extended through Phase 4 so the
  live service can be demonstrated, under the same Cloud Run cap, project alert budget and stop
  rules; the seven-day teardown clock starts when Phase 4's demonstration evidence is approved. The
  walkthrough recording moves to the end of Phase 4; Phase 3 delivers its timed script
  (`docs/walkthrough.md`) only. The same night Peter closed Phase 3 before billing posted so Phase 4
  could start; the hosted cost is recorded from the posted bill on 2026-10-27 in the Phase 4 session.

### Phase 4 decisions

Peter set the direction on 2026-10-27 ("keep it simple") and the same day accepted every round-1
recommendation: nine owner calls and ten settled answers.

Owner calls:

- Phase 4 is simulated acquisition: attributed synthetic traffic, cost per lead and per qualified
  lead (simulated), a hosted demonstration and the walkthrough recording, in nine tasks. The
  recording happens at the end of Phase 4, inside the phase. Teardown is an owner action after the
  archive; its seven-day clock starts at the owner's approval of the Phase 4 demonstration
  evidence. Non-goals: real Google Ads/GA4 data and real click IDs, intake-page UTM capture,
  ROAS/revenue/LTV, cost per appointment, multi-touch attribution, budget optimisation, leads-list
  channel filters, any rubric/draft/verification change, live enrichment in the simulation, and any
  unattended run.
- Attribution is stored on the lead: `intake-v3` adds an optional strict `attribution` object
  (lowercase-slug source, medium, campaign; nullable synthetic click ID) stored as `lead-v3`. The
  server derives the channel on read; the form sends no attribution; `intake-v2` is rejected;
  local emulator data is cleared, not migrated.
- `channel-rules-v1` adapts a subset of GA4's default channel group (Paid Search, Paid Social,
  Email, Affiliates, Organic Search, Direct, Unassigned, plus LeadFlow's Unattributed), stated as
  "not GA4 data". Fictional `sim-` campaigns: `sim-search-auto-insurance-q4`,
  `sim-social-pcs-move`, `sim-email-veterans-day`, `sim-affiliate-partner-guide`, plus organic and
  direct. Channels are assigned by a seeded permutation independent of lead content.
- `synthetic-spend-v1` is a checked-in flight-spend fixture in simulated USD (search $1,200, social
  $800, affiliate $400, email $150, organic and direct $0), labelled illustrative. Blended CPL is
  total spend over all stored leads in the current-bundle window (unattributed and failed runs
  included and counted); per-channel and per-campaign CPL use each group's leads; zero-spend groups
  show "n/a, no spend"; empty denominators are `insufficient_data`; the view shows planned-lead
  progress.
- A qualified lead's latest priority is high or standard ("marketing-qualified (high or standard
  readiness)"); cost per qualified lead uses that denominator.
- Added during implementation (owner, 2026-10-27): qualified-lead rate per channel and campaign,
  cost per contactable lead (spend over leads with recorded email consent), and each channel's
  spend share against its lead share. Click-, revenue- and appointment-based measures (CTR, CPC,
  conversion rate, ROAS, CPA, LTV, cost per appointment) stay out: the demo stores no clicks or
  revenue and `simulator-v1` outcomes are score-independent.
- Before the hosted demonstration (owner, 2026-10-27), so a performance-marketing manager reads it
  first: the acquisition panel moves to the top of the Metrics view, and its figures use industry
  terms explained once (CPL, cost per MQL for high or standard readiness, cost per contactable
  lead, MQL rate) with Spend and Leads tiles beside them.
- Hosted traffic runs from an owner-triggered "Run simulated traffic" control in the signed-in
  browser (Stop, pauses when hidden); no OAuth-client allowlisting, service account or unattended
  run. Locally `pnpm simulate:traffic` is the script.
- The metrics view gains an "Acquisition — SIMULATED" section (two headline tiles, per-channel
  table, CPL bar chart, campaign disclosure), not a fourth view; the dossier gains an attribution
  block. The walkthrough keeps its intake-first opening.
- Hosted demonstration: only if the posted cost is below the 50% inspection point, one enumerated
  approval covers the guarded purge, one build and deploy of the exact Phase 4 commit to the
  existing service under the same cap and budget, smokes 5–6 and rollback, the hosted traffic, the
  evidence file and the recording. Firestore reads are measured in the cost checks; if they cost
  money the hosted metrics poll slows to 15 s. Fallback: local-only demonstration.
- Real advertising or analytics data is a non-goal; connecting it would need the
  real-personal-information gate, the paid-API gate and a new phase. No constitution amendment.

Settled with a cited basis (round 1, 2026-10-27; full report in the proposal/design):
1. Synthetic click IDs: `sim-` + 20 hex, `clickIdClass: "synthetic"`, dossier-only (recorded:
   owner direction, §5; Google documents no GCLID format).
2. `pnpm simulate:traffic` replaces `seed:local`: 60 leads, 10 s default interval, recorded-only,
   per-bundle idempotency keys (default).
3. Version bumps `intake-v3`, `lead-v3`, `metrics-definitions-v2`, `metrics-report-v2`; the bundle
   records the rules, fixture and plan versions (recorded precedent).
4. Attribution never reaches the rubric, drafts, verification, events, logs or model inputs
   (recorded: §5, AI_OPS).
5. Frozen `phase-4.0` evaluation cases fixed before measuring (recorded: AI_OPS, lead-quality skill).
6. Strict input validation per the Phase 2 ASVS mapping (default).
7. C4 model, ERD, AI_OPS, runbook, README and walkthrough updates (recorded: §4, showcase skill).
8. WCAG 2.2 AA under the existing dashboard requirement, design-eval before UI readiness (recorded).
9. The cost read runs on or after 2026-10-27 local; only the hosted approval waits for it (fact).
   The 09:45 reading showed CA$0.00 on the reports and all three budgets, under 24 hours after the
   last hosted activity, so it stays pending until rechecked.
10. No new dependencies (fact: recharts 3.10.1 and zod 4.6.7 already pinned).

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
| 2 | Live enrichment, consent-gated outreach drafts, verification/security layer, responsive live dashboard, and run monitoring (Firebase Auth moved to Phase 3) | Done |
| 3 | Owner-authorized private Cloud Run deployment with direct IAP access control, evidence bundle, README, and demonstration walkthrough (the repository went public under MIT at the close of Phase 2) | Done |
| 4 | Simulated acquisition: attributed synthetic traffic, cost per lead and per qualified lead (simulated), hosted demonstration and walkthrough | In progress |

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

1. Package one strict local/cloud runtime and production container without weakening the offline path.
2. Enforce private IAP identity, backend-only Firestore access, retention, and guarded purge.
3. Add request-bound hosted execution, stored polling, session states, and deferred accessibility work.
4. Define the immutable release, evaluation, evidence, runbook, architecture, README, and walkthrough artifacts.
5. Verify one exact local candidate through the full gate, reviews, rendered checks, and publication scans.
6. After enumerated approval, run the hosted proof, verified rollback and teardown, then prepare archive/merge.

**Phase 4 blueprint — at most nine tasks**

1. Record the posted Phase 3 hosted cost.
2. Add the attribution contract, channel rules and frozen `phase-4.0` cases.
3. Add the seeded traffic plan, local simulator and hosted traffic control.
4. Add the spend fixture and acquisition metrics.
5. Build the simulated acquisition section and dossier block.
6. Update diagrams, AI operations, runbook, README and walkthrough script.
7. Verify one exact local candidate through the full gate, reviews and scans.
8. After enumerated approval, run the hosted demonstration and record the walkthrough.
9. Record the teardown start, archive and prepare merge.

### Before paid API or AI quota

- [ ] Owner selects the provider/model or paid design tool, approves the account and spend ceiling,
  and provides credentials through an approved secret path.

### Before live GCP deployment or public exposure

- [ ] Owner selects the GCP project, region, account/billing path, budget, secrets path, and access
  policy; security, privacy, rollback, and cost checks pass.

  The owner selected the private Phase 3 parameters on 2026-10-26. The gate remains unchecked until
  the exact candidate passes its required checks and the owner separately authorizes the enumerated
  cloud mutations.

### Before using real personal information

- [ ] Owner authorizes the specific data source and purpose after privacy, retention, access, prompt,
  logging, and deletion controls are documented and verified.

### Before any external communication

- [ ] Owner explicitly authorizes the exact channel and action. The MVP still provides drafts only;
  automated sending requires a constitution amendment and a new scoped phase.

### Before public GitHub publication

- [x] Owner approves the public repository name and framing after secret, private-data, licensing,
  generated-asset, and history scans pass. Resolved 2026-10-26: Peter approved the public repository
  `prentopoulos/leadflow-ai` under the MIT License, publishing every tracked file and the full
  history. The scans found no secret in any of the 1,002 history blobs (scanner proven on planted
  keys), no real personal data, no third-party binary and no unlicensed bundled skill. The two
  home-directory paths in current docs were neutralised; Peter chose to keep the commit email and
  three older blobs containing the home path in history rather than rewrite it.

### Before claiming Military.com intake parity

- [ ] The actual funnel questions and wording are verified from a current source and the implemented
  form is reviewed against that evidence.
