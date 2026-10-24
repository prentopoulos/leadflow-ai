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
  `docs/architecture/`, exported to SVG, with Mermaid where a README shows a diagram.
- Code review: every change to code is reviewed before merge (WORKFLOW.md).

Gate: `TBD in Phase 0`.
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
- The planned root quality command is `pnpm check`. It must remain credential-free and offline;
  Phase 0 may name it as the target but must not claim it works until implementation verifies it.
- Peter authorized a separately named connected dependency audit against the package registry.
  It is not part of the offline `pnpm check` command and never fixes dependencies automatically.
- Freeze deterministic synthetic cases for rubric arithmetic, schema rejection, consent,
  injection resistance, unavailable enrichment, invalid events, and partial/failed runs. Every
  applicable assertion must pass; deferred capabilities remain `not_run`.
- Priority thresholds, field-level completeness rules, processing-time boundaries, enrichment
  success and agent-failure denominators, and model-quality percentages remain explicitly TBD.
- Complete the recorded Phase 0 acceptance criteria without a separate hours cap; defer
  nonessential later-phase infrastructure rather than weakening the checks.

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
| 0 | Toolchain, app skeleton, lockfile, quality gate with constitution copy check, smoke checks, and offline AI evaluation scaffold | Planned |
| 1 | Verified intake, immediate Firestore persistence, LangGraph orchestration, qualification agent, and C4 architecture diagrams as code | Planned |
| 2 | Live enrichment, consent-gated outreach drafts, verification/security layer, Firebase Auth, responsive live dashboard, and run monitoring | Planned |
| 3 | Owner-authorized Cloud Run deployment, public-repository polish, evidence bundle, README, and demonstration walkthrough | Planned |

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
