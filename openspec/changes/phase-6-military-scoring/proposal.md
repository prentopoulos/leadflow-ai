## Why

The intake now asks the Military.com auto quote flow's own questions in their order and wording
(read from auto.military.com on 2026-10-27), but the score still comes from four LeadFlow-only
questions (request intent, coverage focus, need timeline, request details) that Military.com never
asks. Peter decided on 2026-10-27 that the score must come from the real Military.com answers,
including the driving-record answers, and that the LeadFlow scoring step goes. This change adds
PROJECT.md Phase 6 (Military.com lead scoring) and builds on the intake and simulator work in PR #23.

## What Changes

- **Constitution amendment (own `docs:` commit, version 2.0.0, owner decision).** The rule
  "Qualification scores marketing readiness only; never use or describe it as insurance eligibility,
  underwriting, pricing, risk, or personal financial advice" is redefined: qualification scores
  **lead quality for marketing follow-up from the Military.com quote answers, including
  driving-record answers**, and is still never used or described as an insurance eligibility,
  underwriting, pricing or quote decision, or as personal financial advice. The verbatim copies in
  AGENTS.md and `openspec/config.yaml` change with it.
- **BREAKING** Intake moves to `intake-v4` and leads to `lead-v4`: request intent, coverage focus,
  need timeline and request details are removed; the Military.com answers are required; email
  consent stays (outreach still needs it). Local emulator data is cleared, not migrated; hosted
  synthetic data is purged before a hosted deploy.
- **BREAKING** `rubric-v2` replaces `rubric-v1`: four criteria (contactability, coverage situation,
  vehicles, driving record) plus a profile criterion, 100 points, from Military.com answers only.
  The priority bands (High 80+, Standard 50–79, Nurture under 50) stay unless Peter changes them.
- The request-text interpreter is removed: no free-text scoring input remains.
- The agent team's coded inputs move from need, focus and intent to Military.com answers that
  describe the lead's situation (current insurer, bundling interest, homeowner, vehicle count).
- The traffic plan, drafts, verification rules, evals, dashboard labels, glossary and docs follow.
- The `Before claiming Military.com intake parity` gate records the 2026-10-27 evidence; parity
  stays unclaimed (the flow's make/model lists and final submission are not copied).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `marketing-readiness-qualification`: `rubric-v2` from Military.com answers; timeline, clarity and
  interpreter requirements removed; the result names lead quality, still not an insurance decision.
- `verified-intake`: `intake-v4` without the LeadFlow scoring step; the copied Military.com
  questions are source fields with their retrieval date.
- `agent-drafting`: model requests use situation answers from the Military.com flow instead of
  need, focus and intent.

## Non-goals

- No insurer integration, quote, rate or eligibility output, and no Military.com submission.
- No real personal data: identities, phones and addresses stay fictional.
- No new agents or sub-agents; no hosted change beyond the existing purge-and-redeploy path.
- No Military.com intake parity claim.

## Impact

- `packages/domain` (intake, qualification, traffic, agents, metrics labels), `packages/runtime`
  (workflow, interpreter removal, drafts, verification), `packages/evals` (re-baselined cases),
  `apps/web` (intake, dossier, glossary), `apps/api` fixtures.
- About 42 files reference the removed fields (357 references).
- PROJECT.md section 5, AGENTS.md and `openspec/config.yaml` (amendment); PROJECT.md section 6 adds
  Phase 6; README and diagrams describe the new score.
