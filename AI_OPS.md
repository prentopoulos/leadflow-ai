# LeadFlow AI operations

PROJECT.md owns scope, decisions and operator gates. OpenSpec owns requirements and tasks. This record
maps AI capabilities to current evidence. Read
[the AI-ops skill](.agents/skills/leadflow-ai-ai-ops/SKILL.md) for the affected procedure.

## Capability map

| Capability | Status | Reason / evidence or task | Recheck when |
|---|---|---|---|
| Hosted or local model inference | deferred | Claude or OpenAI backend adapter is planned; provider/model/budget are gated | Phase 1 provider selection or provider change |
| Prompts and structured output | deferred | Qualification and outreach require versioned prompts plus validated JSON schemas | First Phase 1 prompt/schema/model task |
| RAG / document ingestion | deferred | Not required by the current MVP | Scope adds indexed documents or retrieval |
| Semantic or response caching | deferred | No cache is planned | Cache or replay optimization is proposed |
| Model training / feature pipelines | deferred | No training is planned; rubric scoring is deterministic | Scope adds training or feature serving |
| Tool actions / external adapters | deferred | Read-only NHTSA, ZIP, email-domain, model, Firestore, and auth adapters are planned | First adapter task or destination change |
| Persistent state / replay | deferred | Firestore lead and run state plus LangGraph checkpoints are planned | Phase 1 persistence design |
| Multiple users / tenants | deferred | Firebase Auth is planned; roles and tenant boundaries remain TBD | Phase 2 auth/access design |
| Generated code execution | deferred | Not part of the MVP | A code-execution tool is proposed |
| MCP / external tool servers | deferred | Not part of the runtime design | An MCP/runtime tool server is proposed |
| Messages sent to people | deferred | MVP creates approval-gated drafts only and cannot auto-send | Any outbound channel is proposed |
| Business outcome measurement | deferred | MVP reports operational metrics, not insurer quotes or CRM conversion attribution | Downstream CRM/outcome integration is proposed |

## Evidence locations

| Record | Location / current status |
|---|---|
| Design choices: autonomy, pattern, framework, model tiers, hosting, fallback | Phase 0/1 OpenSpec design; not created yet |
| System bundle and last known-good version | Not established; first AI runtime phase |
| Evaluation plan, held-out cases and evaluator | Phase 0 offline scaffold; not created yet |
| Offline deterministic check command | `TBD in Phase 0` |
| Authorized provider-evaluation command and budget | Not authorized; paid API gate unresolved |
| Run records / metrics / alerts | Phase 1/2 Firestore and dashboard design; not created yet |
| Release evidence and stop/recovery runbook | Phase 3; not created yet |
| Operational owner and maintenance/recheck cadence | Peter; cadence TBD before deployment |

## Current operational limits

- Lowest autonomy rung: sequential LangGraph workflow with three bounded specialist agents,
  deterministic routing/security checks, and a human approval queue. No autonomous sending.
- Data: fictional identities and test contacts only until the real-data gate is resolved. Minimize
  fields sent to models; secrets and raw credentials never enter prompts or logs.
- Models and paid tools: provider, model, token/time budgets, retry counts, concurrency, and spend
  ceiling are TBD and gated. Ordinary CI must remain credential-free and deterministic.
- External reads: NHTSA and Zippopotam.us calls are planned and must preserve source, subject,
  retrieval time, status, and failure evidence. Email checks do not prove identity or ownership.
- State: a lead must exist before agent work starts; checkpoint, retry, failure, verification, and
  approval states must be durable enough for the dashboard to show actual workflow state.
- Outputs: score weights are fixed by the accepted rubric; model prose cannot alter the arithmetic.
  Outreach remains a draft requiring consent and human approval.
- Retention, deletion, telemetry sampling, model fallback, and production incident limits remain TBD
  for the phases that introduce them.

## Latest scoped evidence

No AI runtime evaluation has been established by installing this kit. All runtime capabilities are
deferred and untested. Phase 0 must create offline fixtures for rubric arithmetic, schema rejection,
consent denial, prompt-injection handling, unavailable enrichment, and failed/partial agent runs
before any provider evaluation is proposed.
