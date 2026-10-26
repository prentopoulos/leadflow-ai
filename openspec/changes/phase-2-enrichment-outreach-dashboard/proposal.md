## Why

Phase 1 proved one durable, honest qualification run. Phase 2 makes LeadFlow AI the operations tool
the brief describes: each persisted lead is enriched from two real public sources, receives an
evidence-grounded outreach draft only when consent exists, passes a verification layer, and appears
in a live leads list and metrics dashboard computed from stored runs. Nothing is sent, and every
live, recorded, mock and synthetic value stays labelled as what it is.

This change implements PROJECT.md Phase 2 as narrowed by the Phase 2 decisions accepted on
2026-10-25. It does not amend the constitution. Peter authorized two bounded live read sources and
the Phase 2 UI dependency downloads; every other PROJECT.md gate stays unresolved.

## What Changes

- Add live, read-only enrichment from NHTSA vPIC (`GetModelsForMakeYear`) and Zippopotam.us, with a
  5-second timeout, at most one evented retry, per-lookup evidence records (source, endpoint, subject,
  retrieval time, HTTP status, outcome, bounded raw body and SHA-256), and explicit `recorded`, `mock`
  and `live` evidence classes. A local email check reports syntax plus reserved test domain only.
- Add consent-gated email outreach drafts from a deterministic slot template behind a
  provider-neutral composer port, with immutable revisions, a priority-based follow-up action, a
  fixed CAN-SPAM notice, and append-only approve/reject review records bound to the revision digest.
  No send path exists.
- Add a deterministic verification layer for evidence completeness, claim bounding, draft slot
  provenance, prohibited insurance-decision language, consent/approval invariants and event privacy.
  Unavailable sources mark the run `partial`; failed drafts become `verification_blocked`.
- Move intake to `intake-v2`, which records the consent wording version and the digest of the exact
  text shown. Phase 1 local data is cleared, not migrated.
- Extend the fixed graph to interpret → score → enrich → draft → verify → simulate → finalize, run
  workflows in a background executor, and make resume return 202 after its durable commit.
- Add a Host/Origin allowlist and a fixed, labelled local operator principal for review actions.
- Add `metrics-definitions-v1`, a leads/runs list with the approval queue and run monitoring, and a
  metrics dashboard polled through Fastify, meeting WCAG 2.2 AA at desktop and 390px.
- Add a fixed 40-lead fictional seed command that uses `recorded` enrichment, a separately named
  live enrichment probe, frozen `phase-2.0` evaluation cases, updated C4 views and README.

## Non-goals

- Firebase Auth, multiple users, remote access, Cloud Run, GCP resources, hosted CI or publication.
- A live model, provider SDK, prompt, paid quota or model-quality claim.
- VIN fields or VIN decoding, insurer, quote, pricing, eligibility, underwriting or risk behavior.
- Sending email or SMS, an SMTP/email SDK, phone follow-up, or any external communication.
- Rubric changes: enrichment never alters `rubric-v1` points or priority.
- Alerting, production telemetry, an OpenTelemetry SDK, SSE/WebSocket transport, or a shared cache.
- Real personal information or a Military.com parity claim.

## Capabilities

### New Capabilities

- `live-enrichment`: Bounded vPIC and Zippopotam.us adapters, the local email check, evidence
  records and classes, raw-response retention, and the separately named live probe.
- `consent-gated-outreach`: Template drafts, revisions, follow-up actions, review records, the
  operator principal and the enforced absence of any send path.
- `verification-layer`: Deterministic rules over evidence, drafts, language, consent, approval and
  privacy, and their effect on run and draft state.
- `operations-dashboard`: Metric definitions, the leads/runs list, approval queue, run monitoring,
  metrics views, polling, seed data, and WCAG 2.2 AA behavior.
- `local-access-boundary`: Host/Origin allowlisting for the loopback API in place of authentication.

### Modified Capabilities

- `verified-intake`: `intake-v2` with recorded consent wording; consent now enables a draft only.
- `durable-lead-workflow`: The Phase 2 graph, background execution, 202 resume and evented
  enrichment retries.
- `offline-evaluation`: Frozen `phase-2.0` cases with honest `not_run` live boundaries.
- `quality-gate`: Recorded-fixture enrichment offline, a no-send governance check and Phase 2 smoke.
- `architecture-evidence`: External systems, enrichment/outreach/review flows and new collections.

## Impact

- **Packages:** `packages/domain` gains Phase 2 schemas, verification rules, the template and metric
  arithmetic; `packages/runtime` gains adapters, evidence/draft/review repositories, the graph
  extension and the background executor; `packages/evals` gains `phase-2.0`.
- **Applications:** `apps/api` gains the access boundary and leads, metrics, draft-review and
  evidence routes; `apps/web` gains the leads/runs, approval and dashboard views.
- **Dependencies:** recharts, lucide-react and shadcn/ui components with Radix peers, recorded in
  `docs/dependencies/phase-2.md`. No provider, Firebase client, SSE or email SDK.
- **State:** new Firestore Emulator collections for evidence, drafts, reviews and verification
  results; new schema versions; Phase 1 local data cleared by the existing guarded reset.
- **External calls:** read-only GETs to `vpic.nhtsa.dot.gov` and `api.zippopotam.us` only, carrying
  ZIP and vehicle year/make, never names or contact details.
- **Documentation:** PROJECT, AI_OPS, HANDOFF, architecture sources, diagrams and README.
