## Why

Every outreach draft so far comes from a fixed template. PROJECT.md promises "three specialized
agents" that qualify, enrich and prepare outreach; Phase 5 delivers the outreach agents. Peter set
the direction on 2026-10-27 (HANDOFF.md § Phase 5 direction, recorded in PROJECT.md § Phase 5
decisions): per lead, an AdScout-style multi-agent system researches the lead's situation, writes a
short personalised paragraph that cites its sources, checks it with code and a critic, and leaves
it for a person to approve. Nothing is sent. Peter resolved the paid-API gate for this use: the
Anthropic API with AdScout's spend limits. He asked for the phase in one run with few tasks.

## What Changes

- Add an opt-in **agent team** inside the existing `compose_draft` node:
  - a **research team**: a Claude Sonnet 5.5 lead plans one to three questions for each of three
    Claude Haiku 5.5 workers (vehicle, area, coverage needs) that run in parallel with web search;
    a code **claim verifier** keeps only claims whose cited URL and quoted text came back from the
    search and whose numbers and key words appear in the quote; the lead merges kept claims into a
    brief;
  - a **draft loop**: a Sonnet 5.5 writer drafts one short paragraph citing claim IDs, a code
    **rule checker** and a Sonnet 5.5 **critic** review it, and the writer gets at most two
    rewrites. A paragraph that still fails falls back to the template draft.
- **Privacy:** models see only the vehicle (year, make, model), the area (place and state from the
  verified ZIP lookup) and the coded coverage answers. They never see the name, email or the
  free-text request; code fills the greeting.
- **Spend:** about $0.30 per lead and $8 per API process, reserved in code at worst case before each
  call and settled from reported usage after. A budget refusal, model error or failed check falls
  back to the template draft and is recorded.
- The agent paragraph becomes a new draft slot (`agent_brief` provenance) inside the existing
  template, so all eight verification rules still run. `verification-rules-v2` checks the agent
  slot against its stored brief (slot reproduced from the stored paragraph; every cited claim kept
  and bounded). A new `agentBriefs` record stores the claims (URL, quote), each call's model,
  tokens, searches and cost, the critic's notes and any fallback reason.
- **BREAKING (local data):** `system-bundle-v5` records the provider, models and prompt digest when
  agents run, and the "gate unresolved" boundary when they do not; local emulator data is cleared,
  not migrated.
- Off by default behind a switch: `pnpm api:local -- --agents=claude` and `pnpm demo -- --agents`.
  `pnpm demo` without it costs nothing. Hosted mode refuses the switch and stays template-only.
- The dossier draft panel shows the agent paragraph's cited sources (title, URL, quote), the agent
  status and its cost, or the fallback reason.
- Offline tests use a fake model port; one small owner-authorized live probe runs at the end.

## Non-Goals

Sending anything; researching the person; agents in the hosted service; model-based qualification
or scoring (the rubric stays deterministic); changing the template's fixed copy, the compliance
notice, consent or review rules; a general autonomous tool loop; streaming progress of agent steps.

## Capabilities

### New Capabilities

- `agent-drafting`: the opt-in research team, draft loop, claim verifier, rule checker, spend
  limits, privacy projection, stored brief and dossier sources.

### Modified Capabilities

- `verification-layer`: `verification-rules-v2` covers the agent slot.

## Impact

- `packages/domain`: agent contracts, claim verifier, rule checker, agent slot, rules v2, bundle v5.
- `packages/runtime`: model port, Anthropic adapter (`@anthropic-ai/sdk` 0.79.0), spend ledger,
  agent team, `compose_draft` wiring, `agentBriefs` repository.
- `apps/api`, `scripts`: the `--agents=claude` switch, hosted refusal; `apps/web`: sources panel.
- Docs: PROJECT.md gate record, AI_OPS.md, `docs/dependencies/phase-5.md`, C4 model, README, HANDOFF.
- Gates: the paid-API gate is resolved by the owner for this scope only; the real-data, external
  communication and intake-parity gates are untouched.
