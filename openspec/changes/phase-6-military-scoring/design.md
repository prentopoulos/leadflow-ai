## Context

PR #23 copied the Military.com auto quote flow into the intake (read from the live page's flow
definition on 2026-10-27) and stores its answers on every lead, but `rubric-v1` still scores four
LeadFlow-only answers. Peter decided on 2026-10-27 that the score comes from the real Military.com
answers, driving record included, and that the LeadFlow scoring step is removed. The deterministic
rubric, evidence checks, priority bands, consent gate and model-privacy boundary stay; only their
inputs change.

## Goals / Non-Goals

**Goals:** score every lead from the Military.com answers with an owner-approved, versioned,
explainable rubric; remove the LeadFlow scoring step; keep consent, verification and the agent
team working on the new inputs; re-baseline the evals.

**Non-Goals:** quotes, rates, eligibility or insurer matching; new agents; real personal data;
Military.com parity.

## Decisions

### D1. Constitution amendment first (owner)

Section 5's qualification rule is redefined (version 2.0.0, major: a rule is redefined) in its own
`docs:` commit that updates AGENTS.md and `openspec/config.yaml`, before any code task. Proposed text:

> Qualification scores lead quality for marketing follow-up from the Military.com quote answers,
> including driving-record answers; never use or describe it as an insurance eligibility,
> underwriting, pricing or quote decision, or as personal financial advice.

### D2. Rubric v2 points (owner approves before task 2)

Draft weights. Each positive component cites the answer that earned it; a blank answer scores zero
and is listed as missing.

| Criterion (max) | Component | Points |
|---|---|---|
| Contactability (25) | Email | 5 |
| | Phone | 10 |
| | First and last name | 5 |
| | Street address | 5 |
| Coverage situation (25) | Currently insured: yes | 10 |
| | Current insurer named | 5 |
| | Wants a bundle: yes | 5 |
| | Owns home: yes | 5 |
| Vehicles (15) | First vehicle year, make and model | 9 |
| | Each additional vehicle (up to 3) | 2 |
| Driving record (25) | Valid licence: yes | 8 |
| | Tickets and accidents: none 9, one 4, multiple 0 | 9 |
| | No DUI/DWI | 4 |
| | No SR-22 | 4 |
| Profile (10) | Military service: yes (the audience) | 4 |
| | Birthdate given | 2 |
| | Marital status answered | 2 |
| | Multiple drivers answered | 2 |

Bands stay High 80–100, Standard 50–79, Nurture 0–49.

### D3. Gender (owner decision, open)

Seven US states ban gender in auto insurance rating. Options: (a) gender counts only as "answered"
for 0 points (recorded and shown, never scored) **(recommended)**; (b) gender answered earns the
2 profile points that "multiple drivers answered" holds above. The table assumes (a).

### D4. What the agents see

Models keep receiving vehicles and the verified area, and now receive four situation answers:
currently insured, current insurer, bundling interest, homeowner. Contact details, birthdate,
gender, marital status, ZIP and driving record never reach a model. The coverage worker's prompt
uses the situation answers in place of need, focus and intent; no new worker is added.

### D5. Migration

`intake-v4` / `lead-v4`; `intake-v3` is rejected. The local emulator is cleared, not migrated;
hosted synthetic data is purged before any hosted deploy (existing purge path). The system bundle
names `rubric-v2` and drops the interpreter.

## Non-negotiables check

| Rule or gate | How it is kept |
|---|---|
| Qualification meaning (amended, D1) | Score is lead quality for follow-up; UI, API and docs never call it eligibility, price or a quote |
| Deterministic documented rubric | `rubric-v2` is pure domain code with fixed weights (D2); no model scores |
| Fictional data | Phones 555-01XX only, example emails, fictional addresses |
| Minimise data to models | D4 allow-list; a privacy test checks every recorded request |
| Consent and human approval | Consent stays, scores zero and gates drafts; drafts never send |
| Dashboard honesty | Metrics recomputed from stored runs; SIMULATION strip unchanged |
| Military.com parity gate | 2026-10-27 evidence recorded; parity still not claimed |
| Paid API gate | Unchanged caps ($0.30 per lead, $8 per process); one owner-run live probe at close |

## Risks / Trade-offs

- Driving-record scoring reads like risk scoring → wording checks in tests and review (D1).
- Score distribution shifts → the evals assert the new expected priorities; the dashboard notes the
  rubric version.
- Agent quality without need and intent → the closing live probe compares a few drafts against
  Phase 5 examples; any regression is recorded, not hidden.

## Open Questions

- D2 weights and D3 gender option: Peter approves before task 2.
