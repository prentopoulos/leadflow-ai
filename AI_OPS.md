# LeadFlow AI operations

PROJECT.md owns scope, decisions and operator gates. OpenSpec owns requirements and tasks. This record
maps AI capabilities to current evidence. Read
[the AI-ops skill](.agents/skills/leadflow-ai-ai-ops/SKILL.md) for the affected procedure.

## Capability map

| Capability | Status | Reason / evidence or task | Recheck when |
|---|---|---|---|
| Hosted or local model inference | deferred | Claude or OpenAI backend adapter is planned; provider/model/budget are gated | Phase 1 provider selection or provider change |
| Prompts and structured output | partial-local | Qualification uses strict versioned structured schemas and a deterministic interpreter; prompts/models remain absent and gated | First prompt/model task or schema change |
| RAG / document ingestion | deferred | Not required by the current MVP | Scope adds indexed documents or retrieval |
| Semantic or response caching | deferred | No cache is planned | Cache or replay optimization is proposed |
| Model training / feature pipelines | deferred | No training is planned; rubric scoring is deterministic | Scope adds training or feature serving |
| Tool actions / external adapters | partial-local | Validated API startup can construct only the exact loopback Firestore Emulator boundary with an explicit non-SSL host override; NHTSA, ZIP, email-domain, model, auth, and outbound adapters remain absent | First additional adapter or destination change |
| Persistent state / replay | implemented-local | Versioned Firestore leads/runs/events/results, LangGraph checkpoints, bounded retry history, explicit compatible-state resume, ambiguous-write reconciliation, and process-restart reconstruction are exercised locally | State schema, checkpointer, retry, resume, or reconstruction change |
| Multiple users / tenants | deferred | Firebase Auth is planned; roles and tenant boundaries remain TBD | Phase 2 auth/access design |
| Generated code execution | deferred | Not part of the MVP | A code-execution tool is proposed |
| MCP / external tool servers | deferred | Not part of the runtime design | An MCP/runtime tool server is proposed |
| Messages sent to people | deferred | MVP creates approval-gated drafts only and cannot auto-send | Any outbound channel is proposed |
| Business outcome measurement | deferred | MVP reports operational metrics, not insurer quotes or CRM conversion attribution | Downstream CRM/outcome integration is proposed |

## Evidence locations

| Record | Location / current status |
|---|---|
| Design choices: autonomy, pattern, framework, model tiers, hosting, fallback | Phase 0 foundation design records the local-only boundary; runtime/model choices remain Phase 1 work |
| System bundle and last known-good version | `system-bundle-v1` is persisted with code/tool/schema identity; latest verified workflow checkpoint is recorded in `HANDOFF.md` |
| Evaluation plan, held-out cases and evaluator | `packages/evals`; versioned synthetic fixtures, evaluator, bundle identity, and explicit `not_run` outcomes established in Phase 0 |
| Offline deterministic check command | Activate with `. .\scripts\activate-toolchain.ps1`, then run `pnpm check` |
| Authorized provider-evaluation command and budget | Not authorized; paid API gate unresolved |
| Run records / metrics / alerts | Local run/event/result records are implemented; dashboard metrics and alerts remain Phase 1/2 work |
| Release evidence and stop/recovery runbook | Phase 3; not created yet |
| Operational owner and maintenance/recheck cadence | Peter; cadence TBD before deployment |

## Current operational limits

- Current Phase 1 runtime: one fixed four-node qualification workflow with a deterministic
  interpreter, deterministic score, score-independent synthetic simulation, and no tool authority.
  The broader three-specialist/human-approval design remains later work. No autonomous sending.
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
- Retention, deletion, telemetry sampling, model fallback, and production incident limits remain TBD
  for the phases that introduce them.

## Latest scoped evidence

Phase 0 review-fix revision `c183118b467bd6f200f25f729a5a0833558cccac` passed the credential-free,
offline `pnpm check` gate on 2026-10-24. Its synthetic-local evaluation ran 24 fixed cases: 21
passed, 0 failed, and 3 future capabilities were honestly reported as `not_run` (hosted-model
injection behavior, live enrichment, and agent retry/checkpoint behavior). The generated bundle
recorded clean source state, Node 24.22.1, pnpm 12.15.0, source/lockfile/fixture digests, and null
model, provider, prompt, and tool-contract fields.

This is deterministic scaffold evidence, not AI-runtime, live-provider, enrichment, or production
evidence. Provider evaluation remains unauthorized until the provider, model, budget, credentials,
and cases are approved. The separately authorized connected dependency audit reported no known
vulnerabilities and did not modify the lockfile.

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
evidence; the retained evaluator still reports provider/live cases as `not_run` until tasks 7.1–7.3
replace the Phase 0 corpus.
