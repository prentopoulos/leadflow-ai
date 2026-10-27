## Context

Drafts come from `composeDraft`, a deterministic slot template run in the `compose_draft` node; the
`verify_outputs` node runs eight rules and holds a failing draft as `verification_blocked`. The
system bundle records provider, model and prompt as unavailable ("gate unresolved"). Peter's
2026-10-27 direction (HANDOFF.md, PROJECT.md § Phase 5 decisions) settles the shape below; it was
not re-grilled. API facts were checked against the claude-api skill on 2026-10-27 and again in this
session: Sonnet 5.5 costs $2/$10 per million input/output tokens, Haiku 5.5 $0.10/$0.50, web search
$10 per 1,000; Haiku 5.5 takes `web_search_20250305`; forced `tool_choice` returns 400 on Sonnet
5.5, so JSON comes through `output_config.format`; web-search citations are
`web_search_result_location` objects with `url`, `title` and `cited_text`.

## Goals / Non-Goals

**Goals:** a short, cited, personalised paragraph per consenting lead, produced under a hard spend
reservation, verified by code before a person sees it, with every claim's source stored and shown.

**Non-Goals:** see the proposal.

## Decisions

### 1. Where it runs (owner direction)

Inside `compose_draft`, only when the process was started with agents enabled, consent is recorded
and qualification is not held. The agent team returns an `agent-brief-v1` record; when it holds a
paragraph, `composeDraft` inserts it as the `agentParagraph` slot after the location sentence. The
rest of the template is unchanged, so greeting, consent, follow-up action and compliance notice
keep their existing rules. Hosted startup rejects the switch.

### 2. Privacy projection (owner direction)

`AgentLeadProjection` holds `vehicle` (model year, make, model; from intake), `area` (place name and
state, only from a `found` Zippopotam.us record with exactly one place) and `needs` (the coded
timeline, coverage focus and intent). Name, email, ZIP code and request details are not fields of
the projection, and a test asserts no model request contains them.

### 3. Research team (owner direction)

1. **Lead plan** (Sonnet 5.5, JSON output): one to three questions per topic `vehicle`, `area`,
   `coverage`. Questions are validated (length, no URL/email) before use.
2. **Workers** (Haiku 5.5 ×3, parallel, `web_search_20250305` with `max_uses: 3`): answer their
   questions in short sentences. Claims are taken from the response's cited text blocks, not from
   model-written JSON: each block with a `web_search_result_location` citation becomes a candidate
   claim (text = the block text, URL, title, quote = `cited_text`).
3. **Claim verifier** (code): keeps a claim only if its URL is `https`, its quote is non-empty and
   came back on that response, every number in the claim text appears in the quote, and at least
   half of the claim's content words (four letters or more) appear in the quote. Kept claims get
   IDs `c1…c12` (at most four per topic). If no claim survives, the team falls back.
4. **Lead merge** (Sonnet 5.5, JSON output): up to five brief points, each citing kept claim IDs.
   Unknown IDs drop the point.

### 4. Draft loop (owner direction)

Writer (Sonnet 5.5, JSON `{paragraph, claimIds}`) → rule checker (code) → critic (Sonnet 5.5, JSON
`{approved, issues}`) → at most two rewrites carrying the checker's and critic's notes. The rule
checker (`agent-rules-v1`) requires: 1–600 characters, two to four sentences, at least one cited
claim, only kept claim IDs, every number in the paragraph present in a cited claim's quote, no URL,
email address, `@`, line break or angle bracket, and none of the decision-language terms. The
paragraph is used only when the final attempt passes the rule checker and the critic approves;
otherwise the reason (`rule_check_failed` or `critic_unresolved`) is recorded and the template draft
is used. Decided by the agent, basis: owner's "a person approves" plus §5 "verify external
evidence before presenting it" — a critic objection left unresolved is not shown as approved work.

### 5. Spend limits (owner direction, AdScout Phase 2 values)

`SpendLedger` holds a per-lead cap of $0.30 and a per-process cap of $8 (one `api:local` session;
an operator restart starts a new process total, matching AdScout's per-run cap). Before every call
it reserves the worst case: input tokens estimated as characters ÷ 2 plus 30,000 tokens per allowed
search, output at `max_tokens`, plus $0.01 per allowed search. If the reservation would exceed
either cap the call is not made, the team stops with `budget_exceeded` and the template draft is
used. After the call the reservation is replaced by the cost computed from reported usage
(`input_tokens`, `output_tokens`, `server_tool_use.web_search_requests`). Costs are integer
micro-dollars. Each call's role, model, usage, cost and outcome are stored on the brief.

### 6. Records and verification (`verification-rules-v2`)

`agentBriefs/{briefId}` (`agent-brief-v1`, id derived from run and evidence ids so a replay
collides) stores status (`drafted` | `fallback`), fallback reason, projection digest, questions,
kept and rejected claim counts, kept claims, brief points, the paragraph and its claim IDs, critic
notes, calls and total cost. The `agentParagraph` slot carries `provenance: "agent_brief"` and the
brief id as its `evidenceId`. `draft.slots_grounded` recomposes the template with the stored
brief's paragraph; `evidence.claim_bounded` additionally re-runs the claim verifier and the rule
checker on the stored brief, so a tampered quote, claim or paragraph fails. `no_request_text` and
`no_decision_language` still run over the whole text. The verification rule list itself is
unchanged; only its version moves.

### 7. System bundle v5

`provider`, `model` and `prompt` are either the unavailable boundary (template only) or the values
`anthropic`, `{lead, writer, critic: claude-sonnet-5-5, worker: claude-haiku-5-5}` and the SHA-256
of the prompt set `agent-prompts-v1`. `versions` gains `agentTeam` (`agent-team-v1` or null) and
`verificationRules` becomes `verification-rules-v2`. A cloud bundle must have no agent team.
`system-bundle-v4` data is cleared locally, not migrated.

### 8. Adapter (`@anthropic-ai/sdk` 0.79.0)

0.79.0 (2026-03-16, Apache-2.0) types `output_config`, both web-search tool versions and the
web-search citation; the 1.x line was under a week old. `AnthropicModelPort` reads
`ANTHROPIC_API_KEY` from the gitignored `.env` loaded by the launch script, never logs it, uses a
60-second timeout, the SDK's two retries and `effort: low`. Refusals, unparseable JSON and API
errors become a typed `ModelCallError` whose safe code is stored; raw provider text is not stored.
A `max_tokens` stop is an error for the JSON roles, but a worker keeps the cited blocks it finished
(each still goes through the claim verifier) and its call records `max_tokens`. Workers get 4,000
output tokens: the 2026-10-27 live probe cut two of three workers at 2,000 and lost their answers.

### 9. Prompt-injection boundary

Web results are untrusted. Workers have only web search; the lead, writer and critic have no tools.
Model output reaches the operator only through the rule checker, the verification rules and the
human review; claims are shown with their source URL and quote.

## Risks / Trade-offs

- Web search quality varies → claims without a matching quote are dropped and the template
  remains the fallback.
- Worst-case reservation overestimates input → a lead may fall back early on a tight budget; the
  estimate errs on the side of the cap.
- The critic is a model → it cannot establish correctness; the code checks do, the critic only
  blocks.

## Migration Plan

Clear the local emulator (`pnpm demo` starts fresh). Hosted is unchanged and not redeployed.
