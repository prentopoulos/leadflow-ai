# Phase 5 dependency decision

Decision date: 2026-10-27. Scope: the opt-in local agent team (PROJECT.md Phase 5 decisions).

Peter resolved the paid-API gate for this scope ("use the same API as AdScout and the same spend
limit") and asked for an exact SDK version that types the features the team uses.

## Selected version

| Item | Version | Licence | Purpose |
|---|---|---|---|
| `@anthropic-ai/sdk` (direct, `packages/runtime`) | `0.79.0`, exact | Apache-2.0 | Messages API client for the lead, workers, writer and critic. |
| `json-schema-to-ts` (transitive) | `3.1.1` | MIT | SDK type helper. |
| `ts-algebra` (transitive) | `2.0.0` | MIT | Dependency of `json-schema-to-ts`. |

`0.79.0` (published 2026-03-16) is the release checked here that types everything the team uses:
`output_config` with `effort` and `format: { type: 'json_schema' }`, `WebSearchTool20250305`,
`server_tool_use.web_search_requests` and the `web_search_result_location` citation (`url`,
`title`, `cited_text`). `0.71.2` lacks `output_config`. The `1.x` line (1.0.0 to 1.3.0, published
2026-10-21 to 2026-10-23) was under a week old and adds nothing the team needs, so it was not
chosen. `zod` is an optional peer and resolves to the workspace's pinned `4.6.7`. The lockfile change
adds exactly these three packages.

## Models and prices

From the claude-api skill (model table cached 2026-10-06), rechecked 2026-10-27:

| Role | Model | Input / output per million tokens | Tools |
|---|---|---|---|
| Lead (plan, merge), writer, critic | `claude-sonnet-5-5` | $2 / $10 | none; JSON via `output_config.format` |
| Workers (vehicle, area, coverage) | `claude-haiku-5-5` | $0.10 / $0.50 ($0.50 / $2.50 above 100K input tokens) | `web_search_20250305`, `max_uses: 3` |
| Web search | — | $10 per 1,000 searches | — |

Haiku 5.5 takes the basic web-search variant; `web_search_20260209` needs Sonnet 5.5 or Opus.
Forced `tool_choice` returns 400 on Sonnet 5.5, so structured output goes through
`output_config.format`. Server-side refusal fallbacks are not enabled: they would run another model
at its own price and break the per-call cost record.

## Spend limits

About $0.30 per lead and $8 per API process (AdScout's Phase 2 values), reserved at worst case before
each call and settled from reported usage. The key is `ANTHROPIC_API_KEY` in the gitignored `.env`,
loaded only by `scripts/run-local-api.mjs --agents=claude` and never printed.

## Alternatives considered

- Raw `fetch` to the Messages API: no dependency, but the project rule for Claude code is the
  official SDK, which also supplies typed errors and retries.
- `@anthropic-ai/sdk` 1.3.0: newest, but days old; nothing in it is needed here.
