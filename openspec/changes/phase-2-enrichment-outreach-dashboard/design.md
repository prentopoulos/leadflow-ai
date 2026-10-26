## Context

Phase 1 left a verified local slice on `main`: strict `intake-v1` intake, atomic persistence before
LangGraph execution, a project-owned Firestore checkpointer, the four-node qualification graph
(interpret, score, simulate, finalize), explicit resume with expired-lease reclaim, a stored run
dossier, the `phase-1.0` evaluator and lifecycle reporting. Everything runs on loopback against the
Firestore Emulator with fictional data and no outbound calls.

Phase 2 adds the parts of the brief that turn this into an operations tool: real enrichment,
consent-gated drafts, verification, and a monitored dashboard. Peter accepted the full Phase 2
decision set on 2026-10-25 (PROJECT.md "Phase 2 decisions"). Two decisions widen the outside
boundary and are owner authorizations: live read-only GETs to exactly `vpic.nhtsa.dot.gov` and
`api.zippopotam.us`, and the Phase 2 UI dependency downloads. The paid-API, deployment, real-data,
external-communication, publication and parity gates stay unresolved.

Research recorded during grilling (retrieved 2026-10-25):

- vPIC is HTTPS, keyless, JSON, actively maintained ("Version 4.10, last code change 10/17/2026"),
  and rate-controlled automatically; its FAQ sets no daily limit. `GetModelsForMakeYear` returns
  models listed for a make and model year.
- Zippopotam.us is free and keyless, serves GeoNames data "as-is", and publishes no terms, rate
  limits, 404 behavior or changelog. HTTPS on `api.zippopotam.us` and 404-on-unknown-ZIP are
  unverified until the first authorized probe.
- The Firebase Auth Emulator would let the browser call `127.0.0.1:9099` directly, contradicting
  the Phase 1 rule that browser traffic goes through Fastify; Auth therefore moves to Phase 3.
- The API validates neither Host nor Origin today (`apps/api/src/config.ts` pins only the listener).

## Goals / Non-Goals

**Goals:**

- Enrich every persisted lead from two real sources with complete, verifiable evidence, and show an
  unavailable source as unavailable rather than as a negative result.
- Produce a grounded email draft only when consent exists, and make approval an explicit, recorded,
  content-bound human act with no send path anywhere in the product.
- Verify evidence, drafts, language and invariants deterministically before anything is presented as
  enriched fact or enters the approval queue.
- Give the operator a leads/runs list, an approval queue, run monitoring and a metrics dashboard whose
  every number comes from stored data under a named definition.
- Keep the ordinary gate offline and credential-free; keep live evidence separate and labelled.

**Non-Goals:**

- Firebase Auth, users, remote access, deployment, hosted CI, publication.
- A model, provider SDK, prompt or paid call; VIN decoding; insurer, quote or eligibility behavior.
- Sending, scheduling or queuing any message; phone follow-up.
- Changing `rubric-v1`, alerting, production telemetry, SSE/WebSocket transport or caching.

## Decisions

Each decision names who made it: **owner** (Peter, 2026-10-25) or the settled basis.

### Versions and records

- New contract versions (settled, default): `intake-v2`, `lead-v2`, `run-v2`, `event-v2`,
  `enrichment-evidence-v1`, `email-check-v1`, `outreach-draft-v1`, `draft-review-v1`,
  `verification-result-v1`, `metrics-definitions-v1`, `metrics-report-v1`, `phase-2-graph-v1` and a
  `system-bundle-v2` that adds enrichment mode, adapter, template, verifier and metric versions.
  Phase 1 local data is cleared by the existing guarded reset, not migrated (owner).
- `intake-v2` keeps every `intake-v1` field and adds `consentRecord`: `{ wordingVersion,
  wordingSha256 }` when consent is true and `null` otherwise. The server, not the browser, owns the
  canonical wording table; a submitted version or digest that does not match it is rejected (owner).
- New Firestore collections: `enrichmentEvidence`, `emailChecks`, `outreachDrafts` (one document per
  immutable revision), `draftReviews` (append-only) and `verificationResults`. The run document
  links them by ID. The existing reset clears them because it flushes the whole emulator database
  (settled, fact: `packages/runtime/src/local-reset.ts`).

### Enrichment

- vPIC (owner): `GET https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/{make}/modelyear/{year}?format=json`.
  Only make and year leave the machine. The model is matched locally, exactly and
  case-insensitively, against returned `Model_Name` values. Outcomes: `found` (the model is listed for
  that make and year), `not_found` (a valid response that does not list it), `unavailable`, or
  `not_attempted` (year, make or model missing). The stored claim is only "make/model listed by NHTSA
  vPIC for that model year"; nothing is corrected or inferred about the person's vehicle.
- Zippopotam.us (owner): `GET https://api.zippopotam.us/us/{zip}`. `found` stores every returned
  place (place name, state, state abbreviation) without picking one; `not_found` is a valid
  response saying the ZIP is unknown; anything else is `unavailable`. The first authorized probe
  confirms HTTPS and the not-found shape; until then the adapter treats an unconfirmed shape as
  `malformed` and therefore `unavailable`.
- Call budget (owner): one request per source per lead, `AbortSignal` timeout 5 s, at most one retry
  after a jittered 250–750 ms backoff, only on network error, timeout, 429 or 5xx. No retry on other
  4xx. Both lookups run concurrently inside the enrich node with `Promise.allSettled`, so no
  parallel LangGraph supersteps reach the checkpointer (settled, default). Every attempt is an
  event; the evidence record keeps the final outcome, failure kind and attempt count.
- Evidence record (owner + recorded): source, endpoint template, request subject, requested and
  retrieved times, HTTP status, outcome, failure kind (`timeout | network | rate_limited |
  server_error | malformed | null`), attempts, evidence class (`live | recorded | mock`), the
  recorded capture date where applicable, a raw body bounded to 64 KiB with a `truncated` flag, the
  SHA-256 of the full body, the normalized claim, and `attribution`. Retained until local reset; no
  cross-lead cache, so each lead's retrieval time is its own.
- Evidence classes (owner): the runtime takes an explicit `ENRICHMENT_MODE` of `live`, `recorded` or
  `mock` from validated configuration with no fallthrough. `pnpm api:local` runs `live` for
  operator-submitted leads and shows it. The offline gate, smoke and seed use `recorded` fixtures
  (captured by the probe, carrying their capture date and digest) or `mock` fixtures (hand-written
  failure shapes). A recorded fixture is never relabelled live.
- Live probe (owner): `pnpm enrichment:probe` performs authorized live calls for a fixed short list
  of fictional-lead subjects, writes recorded fixtures with capture date and digest, and reports
  outcomes. It is outside `pnpm check`, like `pnpm audit:dependencies`.
- Email check (settled, recorded/fact): local only. Result `syntax_valid` plus
  `reserved_test_domain` with the fixed limit "no mailbox existence, deliverability or ownership
  claim". It is not an enrichment source and is excluded from enrichment metrics.
- Attribution (owner): "Vehicle data: NHTSA vPIC" and "ZIP data: Zippopotam.us / GeoNames" beside
  evidence and in the README. The GeoNames licence is cited only after it is verified at source.

### Outreach drafts and review

- Composer port (owner): `DraftComposer.compose(input) → draft content`, with one implementation,
  `deterministic-template-v1`. The input is the minimum projection: given name, priority, need
  timeline, coverage focus, request intent, and verified enrichment claims. Request details and
  unverified evidence are never inputs. A future model composer is one adapter behind the same port
  and the same verifier.
- Content (owner): subject and body built from template slots; every slot carries provenance
  `intake | verified_evidence | fixed_copy` (and an evidence ID where relevant). The body includes the
  follow-up action from a fixed priority map (high "Review today", standard "Review this week",
  nurture "Add to nurture list") and a fixed, visibly non-sendable notice: "Before any send, CAN-SPAM
  requires an advertisement disclosure, a valid physical postal address and a working opt-out." No
  address is ever filled in.
- When (owner): a draft is composed only when consent is true and qualification is not held, for
  every priority. Otherwise the run records `draft.skipped` with the reason.
- Revisions and reviews (owner): each revision is immutable with a content SHA-256. An operator edit
  creates a new revision labelled `operator_edited` that supersedes the previous one and returns to
  `pending_review`. A review is an append-only `draft-review-v1` record carrying decision
  (`approved | rejected`), revision ID, content digest, operator principal and time. A review must
  name the latest revision and its digest; anything else is a 409. Revision state is derived:
  `verification_blocked`, `pending_review`, `approved`, `rejected` or `superseded`.
- Approval meaning (owner): "approved for manual use" — the operator may copy or export the text.
  The codebase contains no send route, SMTP client, email SDK or outbound queue, and a governance
  check fails the gate if one appears.
- Operator principal (owner): until Phase 3 adds Firebase Auth, reviews record the fixed principal
  `{ id: "local-operator", label: "Local operator (unauthenticated)" }`, and the interface shows that
  label.
- Approval timing (owner): the run completes when its draft reaches `pending_review`; review happens
  after the run, not through a LangGraph `interrupt()`, so human latency never holds a lease or
  counts as processing time.

### Verification layer

- Rules (settled, recorded from PROJECT §5; OWASP LLM Top 10 2025 and ASVS 5.0 mapping):
  1. `evidence.complete`: every enrichment record has every required field and a matching digest.
  2. `evidence.claim_bounded`: an enriched value appears in a draft or summary only from `found`
     evidence of a matching subject.
  3. `draft.slots_grounded`: every template slot has allowed provenance and resolves to its source.
  4. `draft.no_decision_language`: a versioned deny-list (quote, price, premium, rate, savings,
     eligible, approved for coverage, underwriting, guarantee, risk) finds no match, case-insensitive
     on word boundaries. Applies to template and operator-edited revisions alike.
  5. `draft.no_request_text`: no substring of request details of 12 characters or more appears in
     the draft (LLM01).
  6. `draft.consent_present`: a draft exists only with a matching `consentRecord`.
  7. `draft.compliance_notice`: the fixed notice is present and unaltered.
  8. `events.private`: new events and summaries carry no contact, ZIP, vehicle, request or raw-body
     values (LLM02).
- Failure semantics (owner): an `unavailable` enrichment leaves the run status `complete` with
  `evidenceCompleteness: partial` and its evidence visible; a draft failing rules 2–7 is stored
  `verification_blocked`, is never queued, and the run completes with the hold
  `draft_verification_blocked`; a broken invariant over stored state (rule 1, rule 8, mismatched IDs)
  fails the run `failed_terminal`. The Phase 1 run status `partial` keeps its existing meaning (a
  step has failed and the run failure is being recorded); it is never a finished state.
- Operator-edited revisions are re-verified with rules 4, 5 and 7 before entering the queue; rules
  2 and 3 do not apply to free text, and the revision is labelled `operator_edited` instead.

### Workflow and execution

- Graph `phase-2-graph-v1` (settled, default): interpret → score → enrich → draft → verify →
  simulate → finalize, all fixed nodes. Draft skips itself without consent. `rubric-v1` is
  unchanged; enrichment never alters points or priority (settled, recorded).
- Background execution (settled, default): an in-process executor in the API runs workflows after
  their durable commit, using the existing lease and expired-lease reclaim. Intake keeps returning
  202 on commit; resume now returns 202 after its transactional `run.resume_requested` commit
  instead of awaiting the workflow. This resolves the deferred synchronous-resume review item.
- Resume after a crash during enrichment repeats the lookups with fresh evidence records; the
  superseded attempt's evidence remains stored and marked superseded rather than deleted.
- The whole-subcollection checkpoint read stays deferred until cloud use (HANDOFF review item).
- Telemetry (settled, default): `event-v2` stays the system of record and adds enrichment, draft,
  verification and review events. External-call fields follow OpenTelemetry HTTP client names:
  `http.request.method`, `server.address`, `http.response.status_code`, `error.type`, plus duration.
  No OpenTelemetry SDK is added.

### API and access boundary

- Access (owner): an `onRequest` hook rejects any request whose `Host` is not the configured
  loopback API host, and any state-changing request whose `Origin` is present and not the configured
  web origin. This guards against DNS rebinding and cross-site POSTs while Auth is deferred.
- New routes: `GET /v1/runs` (bounded, cursor-paged summaries with status, priority, age, retries,
  evidence completeness, draft state and lease state; filters include the approval queue);
  `GET /v1/metrics` (`metrics-report-v1`); `POST /v1/drafts/:draftId/revisions` (operator edit);
  `POST /v1/drafts/:draftId/reviews` (approve or reject). Run detail grows evidence, email check,
  drafts, reviews and verification results. Every route keeps Phase 1's fixed safe errors.
- Summaries never include contact fields; the list identifies leads by short ID, priority and status.

### Metrics

- `metrics-definitions-v1` (owner) is a domain constant that the API serves alongside the values:
  - lead volume: persisted leads;
  - priority distribution: latest qualification per lead over high, standard, nurture, held and not
    scored;
  - processing time: `lead.persisted` to the last automated event, with median, p90, mean and n;
    active runs excluded and counted; human review excluded and reported as review latency;
  - enrichment success: per source lookup, (found + not_found) / attempted; unavailable counts as a
    failure; not_attempted excluded and counted; found-rate reported separately; retries collapse
    into the final outcome;
  - agent failures: runs whose latest state is failed / finished runs, with a per-step breakdown;
  - approval queue: drafts whose latest revision is `pending_review`.
- Every value names numerator, denominator, exclusions and window; the window is all retained local
  data for the current system bundle, with other bundles counted separately. Empty denominators are
  `null` with `insufficient_data`. Live and recorded/mock enrichment are split. Simulator outcomes
  appear only in a separate SYNTHETIC panel. The report rejects more than 2,000 runs with a visible
  `window_exceeded` error instead of truncating.

### Interface

- Direction (settled, recorded): extend the Phase 1 operations dossier — warm neutrals, dark ink,
  one teal accent, thin borders, minimal motion, the persistent SIMULATION label — via the
  frontend-product workflow and design-eval before readiness. 21st.dev for free inspiration only.
- Views (owner): intake → run dossier (extended with evidence, draft, verification and review);
  leads/runs with the approval-queue filter and monitoring of status, age, retries and resumable
  expired-lease runs; and the metrics dashboard built with Recharts and shadcn/ui.
- Live updates (settled, default): revision-aware polling every 3 s through Fastify, reusing the
  Phase 1 `retrievedAt` and stale-label pattern; polling pauses while the tab is hidden.
- WCAG 2.2 AA (owner): a text or table equivalent for every chart; no colour-only encoding; 3:1
  contrast for chart marks; focus never hidden by the sticky SIMULATION strip; targets of at least
  24 px; polite, non-chatty live regions; chart animation off under reduced motion. Desktop and
  390 px are both verified in the running app.
- Seed (owner): `pnpm seed:local` submits 40 fixed fictional leads through the real API and
  pipeline with `recorded` enrichment, so the dashboard has volume; seeded runs carry their
  evidence class and are counted separately from live runs.

### Dependencies

- Owner-authorized downloads: recharts, lucide-react, and shadcn/ui components with their standard
  peers (Radix primitives, class-variance-authority, clsx, tailwind-merge), exact-pinned under the
  frozen lockfile and recorded with licence, release date and alternatives in
  `docs/dependencies/phase-2.md` before installation. No provider SDK, Firebase client, SSE package or
  email library.

## Non-negotiables check

| PROJECT §5 rule | How Phase 2 keeps it |
|---|---|
| Secrets | No credentials exist; both sources are keyless. |
| No fabricated results; label live/recorded/mock | Explicit evidence classes, recorded fixtures carry capture date and digest, unavailable is never negative. |
| Operator resolves gates | Only the two authorized hosts and the authorized downloads are used; other gates stay open. |
| Marketing readiness only | Rubric unchanged; deny-list blocks decision language in drafts. |
| Fictional identities | Reserved example domains; only ZIP and vehicle year/make leave the machine. |
| Persist before agent execution | Unchanged atomic intake; enrichment runs after scoring inside the graph. |
| Consent and human approval, never sent | Consent record required, content-bound review records, no send path plus a governance check. |
| Backend keys, minimal data, structured outputs, verified evidence | Strict schemas, minimum composer projection, verification before presentation. |
| Deterministic rubric | `rubric-v1` untouched. |
| Military.com claims | No new form claims; VIN deferred. |
| Dashboard from stored data or labelled fixture | Metrics computed from stored runs under named definitions; seed and simulator labelled. |
| UI accessibility | WCAG 2.2 AA target verified at desktop and 390 px. |

## Risks / Trade-offs

- Zippopotam.us has no published terms, limits or changelog → per-lead single calls, a timeout,
  `unavailable` handling, and the probe confirms behavior before evidence is claimed.
- vPIC make spelling differs from intake (for example "Chevy") → mismatches are `not_found` and
  visible; nothing is normalized silently.
- Background execution can hide failures from the HTTP caller → every outcome is durable and
  polled; the monitoring view surfaces expired-lease and failed runs.
- Operator-edited text cannot be grounding-checked → it is labelled `operator_edited` and still
  passes the language, request-text and notice rules.
- The deny-list can block legitimate wording → it is versioned and its matches are shown to the
  operator.
- Recorded fixtures age → each carries its capture date, and the probe refreshes them.
- The live sources can be unavailable during review or a demo → recorded mode is one setting away
  and labelled.

## Migration Plan

Phase 1 emulator data is cleared with the guarded reset. There is no cloud data. Rollback is
reverting the branch and resetting local data.

## Open Questions

None. Firebase Auth, a model provider, VIN decoding and alerting are deferred by decision, not open.
