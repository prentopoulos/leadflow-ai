## 1. Contracts, versions and dependencies

- [x] 1.1 Record recharts, lucide-react and the shadcn/ui components with their peers (exact versions, licences, release dates, alternatives) in `docs/dependencies/phase-2.md`, install them exact-pinned under the frozen lockfile, and add the Phase 2 domain schemas (`intake-v2` with the server-owned consent wording table, `lead-v2`, `run-v2`, `event-v2`, `enrichment-evidence-v1`, `email-check-v1`, `outreach-draft-v1`, `draft-review-v1`, `verification-result-v1`, `metrics-definitions-v1`, `metrics-report-v1`, `system-bundle-v2`) with boundary tests.

## 2. Live enrichment

- [x] 2.1 Implement the vPIC and Zippopotam.us adapters with the host allowlist, 5 s timeout, single evented retry, outcome and failure-kind mapping, bounded raw body and digest, explicit `live | recorded | mock` mode, the local email check, the evidence repository, and the separately named `pnpm enrichment:probe`; run the authorized probe once to capture the recorded fixtures and confirm the Zippopotam.us HTTPS and not-found behavior.

## 3. Outreach drafts and review

- [x] 3.1 Implement the provider-neutral composer port and `deterministic-template-v1` with slot provenance, the follow-up action map and fixed CAN-SPAM notice, immutable revisions with digests, operator edits, append-only content-bound reviews with the labelled local principal, and the no-send governance check.

## 4. Verification, graph and execution

- [x] 4.1 Implement the eight verification rules and their failure semantics, extend the graph to `phase-2-graph-v1` (interpret → score → enrich → draft → verify → simulate → finalize) with Phase 2 events and linked records, move execution to the in-process background executor, make resume return 202, and cover crash-during-enrichment reclaim with superseded evidence.

## 5. API boundaries

- [x] 5.1 Add the Host/Origin allowlist, `GET /v1/runs`, `GET /v1/metrics` computed under `metrics-definitions-v1`, `POST /v1/drafts/:draftId/revisions`, `POST /v1/drafts/:draftId/reviews`, the extended run detail, `ENRICHMENT_MODE` readiness, and the Phase 2 built-API emulator smoke.

## 6. Operator views and seed data

- [x] 6.1 Build the leads/runs view with the approval-queue filter and run monitoring, the extended dossier (evidence, email check, draft, verification, review with copy/export), and the metrics dashboard with Recharts and shadcn/ui under the Phase 1 direction, polling every 3 s; add `pnpm seed:local` with 40 fixed fictional leads; verify WCAG 2.2 AA behavior at desktop and 390 px in the running app and run design-eval before readiness.

## 7. Evaluation and AI operations

- [x] 7.1 Freeze and implement the `phase-2.0` cases while retaining every earlier case ID, then update `AI_OPS.md` with the enrichment, outreach, verification and metrics capability evidence, recheck triggers and remaining `not_run` boundaries.

## 8. Architecture and README

- [ ] 8.1 Extend the Structurizr model, ERD and dynamic views for the external sources, enrichment/drafting/verification/review flow and new collections, render them with `pnpm docs:diagrams`, and update the README with the showcase method, source attribution and the no-send boundary.

## 9. Completion

- [ ] 9.1 Integrate the remaining checks into the offline gate, run one clean full gate plus the emulator runtime probe and a live local run, perform one consolidated branch review (code, lead quality, security/state, UI, architecture), fix findings, and update PROJECT, AI_OPS and HANDOFF for archive and owner merge approval.
