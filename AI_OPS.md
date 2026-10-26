# LeadFlow AI operations

PROJECT.md owns scope, decisions and operator gates. OpenSpec owns requirements and tasks. This record
maps AI capabilities to current evidence. Read
[the AI-ops skill](.agents/skills/leadflow-ai-ai-ops/SKILL.md) for the affected procedure.

## Capability map

| Capability | Status | Reason / evidence or task | Recheck when |
|---|---|---|---|
| Hosted or local model inference | deferred | Paid-API gate unresolved (Phase 2 decision); interpreter and draft composer stay deterministic behind provider-neutral ports | Owner resolves the provider, model, spend ceiling and secret path |
| Prompts and structured output | partial-local | Strict versioned schemas; deterministic interpreter and `deterministic-template-v1` composer with slot provenance; no prompt exists | First prompt/model task or schema change |
| RAG / document ingestion | deferred | Not required by the current MVP | Scope adds indexed documents or retrieval |
| Semantic or response caching | deferred | No cache is planned | Cache or replay optimization is proposed |
| Model training / feature pipelines | deferred | No training is planned; rubric scoring is deterministic | Scope adds training or feature serving |
| Tool actions / external adapters | implemented-local | Read-only HTTPS GETs to exactly `vpic.nhtsa.dot.gov` (`GetModelsForMakeYear`) and `api.zippopotam.us` (`/us/{zip}`), owner-authorized 2026-10-25: host/path allowlist, 5 s timeout, one jittered retry on network/timeout/429/5xx, explicit `live`/`recorded`/`mock` evidence class, bounded raw body plus SHA-256. Email check is local only. No model, auth or outbound-message adapter | Any new host, endpoint, payload field, retry budget or evidence-class change |
| Persistent state / replay | implemented-local | Versioned Firestore leads/runs/events/results, LangGraph checkpoints, bounded retry history, explicit compatible-state resume, ambiguous-write reconciliation, and process-restart reconstruction are exercised locally | State schema, checkpointer, retry, resume, or reconstruction change |
| Hosted operator identity | planned-phase-3 | The accepted design replaces Firebase Auth with direct Cloud Run IAP for one private owner, validates signed assertions plus a private stable-subject allowlist, and keeps the labelled `local-operator` boundary locally; no cloud identity path exists yet | IAP implementation, policy, audience, allowlist, or operator-count change |
| Multiple users / tenants | deferred | Phase 3 is explicitly single-owner; no tenant or role model is planned | Scope adds another operator or tenant |
| Generated code execution | deferred | Not part of the MVP | A code-execution tool is proposed |
| MCP / external tool servers | deferred | Not part of the runtime design | An MCP/runtime tool server is proposed |
| Messages sent to people | deferred | Consent-gated email drafts with content-bound human review; "approved" means approved for manual use. A governance check fails on any delivery package, send route, mail transport or unauthorized outbound host | Any outbound channel is proposed |
| Business outcome measurement | deferred | MVP reports operational metrics, not insurer quotes or CRM conversion attribution | Downstream CRM/outcome integration is proposed |

## Evidence locations

| Record | Location / current status |
|---|---|
| Design choices: autonomy, pattern, framework, model tiers, hosting, fallback | Phase 0 foundation design records the local-only boundary; runtime/model choices remain Phase 1 work |
| System bundle and last known-good version | `system-bundle-v1` is persisted with code/tool/schema identity; latest verified workflow checkpoint is recorded in `HANDOFF.md` |
| Evaluation plan, held-out cases and evaluator | `packages/evals`; combined `phase-2.0` corpus retains all Phase 0 and 1 IDs, adds 13 fixed Phase 2 contracts, validates bundle freshness, and preserves explicit `not_run` outcomes |
| Offline deterministic check command | Activate with `. .\scripts\activate-toolchain.ps1`, then run `pnpm check` |
| Authorized provider-evaluation command and budget | Not authorized; paid API gate unresolved |
| Run records / metrics / alerts | Local run/event/result records plus `lifecycle-report-v1` privacy-aware summaries are implemented; dashboard queries, alert thresholds, retention, and production telemetry remain deferred |
| Release evidence and stop/recovery runbook | Planned by `phase-3-deployment-access-evidence`; not created or run yet |
| Operational owner and maintenance/recheck cadence | Peter; accepted cadence is pre-deploy, pre-demo, post-demo, and monthly only while hosted |

## Current operational limits

- Current runtime: one fixed seven-node `phase-2-graph-v1` (interpret, score, enrich, compose,
  verify, simulate, finalize) run by an in-process background executor; resume returns 202 after
  its durable commit. Tool authority is limited to the two read-only enrichment endpoints.
  Enrichment never changes `rubric-v1` points or priority. No autonomous sending.
- Accepted hosted runtime (not implemented): the intake commit still precedes `202`, but cloud mode
  starts work only through a separate authenticated, idempotent execution request held open within
  an approximately 45-second workflow deadline while the browser polls stored state. Local mode may
  retain its background executor. Deployed enrichment is recorded-only.
- Verification: eight deterministic rules (`verification-rules-v1`, `decision-language-v1`). An
  unavailable source leaves the run `complete` with `evidenceCompleteness: partial`; a failing
  draft is `verification_blocked` and held out of the approval queue; an evidence-digest or event-
  privacy failure ends the run `failed_terminal`.
- Metrics: `metrics-definitions-v1` names numerator, denominator, exclusions and window for every
  value, scopes to the current system bundle, keeps live and recorded/mock enrichment apart and
  shows simulator outcomes only as SYNTHETIC. A window above 2,000 runs is an explicit error.
- Data: fictional identities and test contacts only until the real-data gate is resolved. Minimize
  fields sent to models; secrets and raw credentials never enter prompts or logs.
- Models and paid tools: provider, model, token/time budgets, concurrency, and spend ceiling are TBD
  and gated. The local synthetic interpreter has exactly one typed transient retry; this grants no
  retry authority to future provider/tool calls. Ordinary CI remains credential-free and deterministic.
- External reads: NHTSA and Zippopotam.us calls are planned and must preserve source, subject,
  retrieval time, status, and failure evidence. Email checks do not prove identity or ownership.
- State: a lead must exist before agent work starts; checkpoint, retry, failure, verification, and
  approval states must be durable enough for the dashboard to show actual workflow state.
- Outputs: score weights are fixed by the accepted rubric; model prose cannot alter the arithmetic.
  Outreach remains a draft requiring consent and human approval.
- Lifecycle reporting: `lifecycle-report-v1` accepts only strict `event-v1` records from one system
  bundle. Its stored-run completion rate uses complete runs as numerator; complete,
  `failed_retryable`, and `failed_terminal` latest states as denominator; and names all active-state
  exclusions. Empty denominators are `null` with `insufficient_data`. Duration and usage coverage
  retain unavailable counts rather than filling values. This is a synthetic local prototype summary,
  not a service-level objective, production reliability measure, or conversion metric.
- Hosted synthetic retention is planned as seven-day TTL metadata plus guarded recursive purge;
  teardown is planned at day seven with final-image cleanup at day 30. These controls are not yet
  implemented. Telemetry sampling, model fallback, and production incident limits remain deferred.

## Latest scoped evidence

### Phase 3 planning (2026-10-26, branch `phase-3-deployment-access-evidence`)

- Peter accepted a private, single-owner, pilot-grade Cloud Run proof with direct IAP, backend-only
  Toronto Firestore, one scale-to-zero service, recorded-only deployed enrichment, request-bound
  cloud execution, an immutable Cloud Build/Artifact Registry release, bounded cost controls,
  verified rollback, evidence, walkthrough, and teardown.
- `system-bundle-v3` and `phase-3.0` are planned, not measured. Hosted, IAP, Firestore, build,
  revision, cost, log, rollback, accessibility, and walkthrough cases remain `not_run` until their
  named local or separately authorized deployed probes execute.
- Planning, validation, scans, the spec-only commit, push, and draft PR are authorized. No cloud API
  enablement, resource creation, build, deployment, merge, model call, message send, or MP4
  publication is authorized by this record.

### Phase 2 (2026-10-25/26, branch `phase-2-enrichment-outreach-dashboard`)

- Authorized live probe (`pnpm enrichment:probe`, 2026-10-25): 18 of 18 requests answered. Seven
  vehicles listed, three deliberate mismatches not found, eight ZIPs found, two unknown ZIPs
  answered HTTP 404 with `{}`. Responses are stored as `recorded` fixtures with capture times; an
  independent digest check confirmed all 18 bodies. Live behaviour after that date is unmeasured.
- `phase-2.0` evaluation: 51 fixed cases (all Phase 0/1 IDs retained plus 13 Phase 2): 35 pass,
  0 fail, 16 `not_run`, 0 stale. Runnable Phase 2 cases call the real adapters with mock/recorded
  fixtures and the real verifier, revision-state and metric contracts. `not_run` keeps live source
  behaviour (probe only), hosted-model drafting (gated), and the emulator and rendered checks
  (measured by `pnpm emulator:runtime` and the rendered review) honest.
- Running-app review (recorded mode, 40 seeded fictional leads): 40/40 runs complete, 30 drafts
  pending review, 10 consent skips, 0 failures; one draft approved through the UI and the Origin
  check; 390 px views had no overflow, no target under 24 px and no focus hidden by the strip.
  It found and fixed a request-text false positive that had blocked 6 of 30 clean drafts.
- Live local run (2026-10-26, task 9.1): one operator-submitted fictional lead (2021 Subaru
  Outback, ZIP 22150) made exactly two read-only GETs, one per authorized host, both HTTP 200 and
  `found`, labelled `live`; the vPIC request carried only make and model year. All eight rules
  passed, the score was 90/100 (30/30/30, high), and the draft waited in review. Metrics kept the
  live class separate and reported recorded/mock and review latency as `insufficient_data`.
- Consolidated review (task 9.1) found and fixed two more rule calibrations before closing: the
  request-text rule now ignores the lead's own structured values and grounded slots (a request
  naming the lead's own vehicle had blocked a clean draft), and the event-privacy rule checks the
  strict event schema plus whole words in the one free-text field (lead names such as "Trace" or
  "Mock" had failed integrity). Regression tests cover both.
- These are local synthetic results, not provider, production, conversion or deliverability
  evidence. Recheck on any adapter, rule, template, metric-definition or fixture change.

### Phase 0 and Phase 1

Phase 0 review-fix revision `c183118b467bd6f200f25f729a5a0833558cccac` passed the credential-free,
offline `pnpm check` gate on 2026-10-24. Its synthetic-local evaluation ran 24 fixed cases: 21
passed, 0 failed, and 3 future capabilities were honestly reported as `not_run` (hosted-model
injection behavior, live enrichment, and agent retry/checkpoint behavior). The generated bundle
recorded clean source state, Node 24.22.1, pnpm 12.15.0, source/lockfile/fixture digests, and null
model, provider, prompt, and tool-contract fields.

This historical Phase 0 result is deterministic scaffold evidence, not AI-runtime, live-provider,
enrichment, or production evidence. Provider evaluation remains unauthorized until the provider,
model, budget, credentials, and cases are approved. The separately authorized connected dependency
audit reported no known vulnerabilities and did not modify the lockfile.

Phase 1 tasks 3.1–5.6 now provide local-only runtime evidence: strict Firestore repositories,
atomic intake, concurrency-safe lifecycle updates, a project-owned durable LangGraph checkpointer,
the fixed qualification graph, and exactly one automatic retry only for the typed
`SyntheticTransientFault`. Unit fixtures cover success after the first transient, exhaustion after
the second transient with `failed_retryable`, immediate terminal handling for unknown errors, safe
telemetry, absence of a third attempt, revision/lease/status rejection, and compatible-checkpoint
resume. Recovery fixtures additionally cover pre-commit rollback, persisted-before-claim restart,
transactional event-write failure, ambiguous checkpoint/pending-write/result commits, stable
one-result-per-run identities, and reconstruction through a newly created checkpoint adapter. The
real isolated emulator confirms durable attempt/retry/resume events and checkpoint reconstruction
across that adapter restart.
API startup now separates process health from stateful configuration readiness: invalid or missing
local configuration constructs no Admin SDK boundary, while the ready path requires the exact
synthetic project and `127.0.0.1:8080` emulator target. `GET /health` remains process-scoped in both
states and makes no emulator, workflow, model, cloud, or production-readiness claim.
The intake HTTP boundary requires the bounded idempotency header and strict fictional/test-contact
payload, carries one server-generated request/trace pair into the durable first event and post-commit
processor, returns the committed identity before processing outcome can alter it, and never starts
duplicate processing for an idempotent replay. Validation, conflict, unavailable-runtime, and
storage failures use fixed schema-valid responses without raw exception or intake content.
Run detail is assembled only from strict stored lead/run/event/result records. It requires a complete
ordered event history matching the run revision, validates every linked result identity, rereads the
run to reject mixed-revision snapshots, and caps the API history at 200 events. Missing, changing,
malformed, or incompatible state produces a safe unavailable/integrity response rather than inferred
progress; `retrievedAt` lets the client label its last confirmed snapshot.
The resume HTTP boundary accepts only a strict expected revision, supplies server-owned correlation,
and delegates all eligibility, lease, checkpoint, and workflow authority to the durable resume
service. A retry is labeled `replayed` only when validated event history proves that the requested
revision advanced through `run.resume_requested`; unrelated stale revisions remain conflicts. All
race, ineligible, checkpoint, missing-run, and unavailable paths use fixed safe responses.
The destructive HTTP surface is absent unless validated startup explicitly enables local reset. When
enabled, its strict body can name only the hard-coded synthetic project and exact confirmation; the
server supplies the already-validated emulator host and actual loopback requester to the bounded
reset function. No collection, URL, host, or production project can be selected by the caller.
The built API now has one composition boundary for atomic intake, automatic deterministic workflow,
stored run detail, and explicit resume. Composition requires a strict persisted compatible system
bundle before stateful routes are enabled; otherwise the server retains process health and fails the
stateful surface closed. The isolated emulator probe exercises built loopback HTTP with five-second
client timeouts and verifies health scope, invalid intake, persistence, completion, stored failure,
resume/replay, intake replay/conflict, reset denial, listener shutdown, Admin cleanup, and final flush.
This is synthetic local runtime evidence, not provider, production, predictive, or external-tool
evidence.

The Phase 1 `phase-1.0` combined evaluator retains all 24 Phase 0 case IDs and adds 14 Phase 1
cases. Its latest local report ran 38 fixed synthetic cases: 26 passed, 0 failed, 12 were `not_run`,
and 0 were stale. The report binds source/dirty-patch state, lockfile, fixtures, evaluator, schemas,
rubric, interpreter, graph, checkpointer, simulator, configuration, environment, and absent-provider
reasons into one system bundle. Seven unrun cases preserve hosted model/provider, live enrichment,
cloud Firestore, real-personal-data, and production-readiness boundaries. The other five are
emulator-scoped or rendered-scoped cases whose declared observations this offline run checks for
consistency but does not measure; they report `not_run` and name `pnpm emulator:runtime` or rendered
local review as the measuring check. A changed bundle digest marks affected evidence `stale`.

Recovery remains local and explicit: the first transient interpreter fault gets one retry, exhausted
transient work becomes `failed_retryable`, unknown/non-retryable faults become terminal, and only an
eligible persisted or retryable run with the expected revision and compatible checkpoint can resume.
A run left `running` by a crashed process is reclaimed through the same resume path once its lease
expires, replaying from the stored lead with idempotent, compared result writes.
Crashes, ambiguous writes, lease races, unavailable/malformed stored state, and resume conflicts
remain visible rather than becoming success. Recheck this evidence on any event/run/checkpoint,
rubric/interpreter/graph/simulator, retry/resume/lease, Firestore adapter, configuration, evaluator,
or dependency change.

Final Phase 1 candidate evidence (2026-10-25, after the consolidated review fixes): the complete
offline `pnpm check` passed (29 test files/187 tests, 26 pass / 0 fail / 12 `not_run` / 0 stale
evaluation, API and web loopback smokes, docs
and Structurizr checks, strict OpenSpec 5/5); `pnpm emulator:runtime` passed the built-API, workflow
recovery and verified-flush probes; offline dependency reuse and tool verification passed; and a live
local run through `pnpm api:local` reached `complete` with simulation notices intact. The authorized
connected audit found no high or critical advisory and two moderate transitive advisories in the
development-only Firebase CLI (`uuid` < 11.1.1, `@opentelemetry/core` < 2.8.0). Recheck them when
the Firebase CLI pin changes.

No provider SDK, prompt, hosted model, live NHTSA/ZIP/email-domain adapter, insurer/quote integration,
cloud database, authentication, real-personal-data path, outreach sender, or external tool server is
enabled. Their first implementation, destination or authorization change requires the matching
PROJECT gate plus renewed design, privacy, failure, budget, and evaluation evidence.
