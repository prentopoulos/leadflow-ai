## Why

Phase 1 turns the Phase 0 skeleton into the first inspectable LeadFlow workflow: a source-backed
intake persists a synthetic lead before bounded LangGraph processing, produces an explainable
marketing-readiness result, and retains enough state to review success and failure honestly. This
also establishes the durable contracts that later enrichment, outreach, verification, and dashboard
work will extend without implying Military.com scoring or production conversion performance.

This change implements PROJECT.md Phase 1. It does not amend the constitution or resolve any
PROJECT.md gate.

## What Changes

- Implement a responsive intake using the verified current Military.com ZIP field plus clearly
  labeled LeadFlow identity, contact, vehicle, timeline, request-intent, focus, and consent fields.
- Persist the synthetic lead, run, initial event, and idempotency record atomically in the local
  Firestore Emulator before any agent work begins.
- Add a sequential LangGraph.js runtime with Firestore-backed versioned checkpoints, append-only
  lifecycle events, one bounded retry for synthetic transient faults, and explicit operator resume.
- Add the Phase 1 qualification specialist using a deterministic structured interpreter stub and
  owner-approved `rubric-v1`; model/provider calls remain gated and `not_run`.
- Add a deterministic, fixed-seed synthetic outcome simulator downstream of qualification to exercise
  lifecycle and metric contracts without claiming predictive validation.
- Replace the Phase 0 shell with the scoped intake-to-run-detail vertical slice and one persistent
  `SIMULATION · Synthetic leads and outcomes` label for the all-synthetic experience.
- Add guarded local emulator retention/reset behavior, independently versioned schemas and system
  bundles, and reproducible workflow, rubric, simulator, accessibility, recovery, and failure tests.
- Create C4 context, container, and persist-before-processing dynamic views as code, plus an ERD and
  compact README Mermaid summary.
- Record the verified public Military.com landing-page evidence and the exact limits of any form
  or parity claim.

## Non-goals

- Live model calls, provider selection, paid quota, or model-quality claims.
- Live NHTSA, ZIP, email-domain, insurer, quote, pricing, underwriting, or eligibility behavior.
- Enrichment and outreach agents, sending email or SMS, automatic outreach, or bypassing consent and
  human approval.
- Firebase Auth, multi-user or remote access, Cloud Run, GCP resources, hosted CI, or public GitHub
  publication.
- A full Phase 2 operations dashboard, production monitoring, real conversion attribution, or claims
  that synthetic outcomes validate the rubric.
- Real personal information, unverified Military.com fields, Military.com visual imitation, or an
  assertion that LeadFlow reproduces Military.com's private routing or scoring.

## Capabilities

### New Capabilities

- `verified-intake`: Source-backed intake fields, LeadFlow demo-field labeling, validation,
  consent capture, accessibility, and responsive behavior.
- `durable-lead-workflow`: Atomic persistence-before-processing, Firestore-owned workflow state,
  LangGraph checkpoints, lifecycle events, idempotency, bounded retry/resume, and guarded local reset.
- `marketing-readiness-qualification`: Structured interpretation and deterministic `rubric-v1`
  scoring, priority guards, integrity holds, evidence, and explicit non-insurance semantics.
- `synthetic-outcome-simulation`: Fixed-seed post-score lifecycle simulation, strict provenance,
  funnel metric definitions, leakage prevention, and non-validation claims.
- `phase-1-operator-flow`: Intake submission, durable progress, qualification result, failures,
  evidence, and simulation summary in one accessible local vertical slice.
- `architecture-evidence`: Structurizr C4 views, schema ERD, README summary, decision traceability,
  and locally verifiable diagram sources.

### Modified Capabilities

- `application-skeleton`: Replace the Phase 0 informational shell with the Phase 1 local synthetic
  intake and per-run result experience without claiming later-phase capabilities.
- `local-toolchain`: Add project-local Java 21 activation and pinned local tooling for the Firestore
  Emulator and Structurizr validation while preserving the credential-free offline gate after
  bootstrap.
- `offline-evaluation`: Make Phase 1 rubric, event, retry/checkpoint, simulator, and operator-flow
  cases runnable while retaining unavailable provider/live boundaries as `not_run`.
- `quality-gate`: Exercise the local Firestore/LangGraph vertical slice, emulator isolation/reset,
  diagram sources, accessibility-sensitive behavior, and generated-artifact cleanliness.

## Impact

- **Applications:** `apps/web` gains the intake and run-detail experience; `apps/api` gains validated
  intake, run, resume, simulation, and bounded reset boundaries.
- **Packages:** `packages/domain` gains the versioned schemas and deterministic rules;
  `packages/evals` gains Phase 1 fixtures, runtime cases, and simulation reports. A project-owned
  runtime/persistence module is added only where the dependency plan justifies it.
- **Dependencies:** LangGraph.js, Firebase Admin/Firestore Emulator tooling, and locally pinned
  diagram tooling are added under the frozen lockfile/toolchain. No hosted provider SDK is activated.
- **State:** Firestore Emulator becomes the sole durable application-state authority for leads,
  runs, events, checkpoints, pending writes, idempotency, bundles, and simulation records.
- **Documentation:** PROJECT, AI_OPS, HANDOFF, architecture sources, README summary, and verified
  intake research are updated with decisions, evidence status, and deferred gates.
- **Security and privacy:** All services remain loopback-only; the browser writes through Fastify;
  fixtures use fictional identities and test contacts; routine events exclude contact data, prompts,
  raw model/stub output, secrets, and stack traces.
