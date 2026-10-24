# Current handoff

Read PROJECT.md and current user instructions. Inspect actual Git/OpenSpec state before resuming.

## Current checkpoint

Phase 0 is merged into `main` at merge commit `642f70d`. Its branch was deleted after the approved
local `--no-ff` merge. The Phase 0 implementation, archive, accepted specs, gate evidence, and review
record remain in history and under `openspec/changes/archive/2026-10-24-phase-0-foundation/`.

Phase 1 planning is complete on branch `phase-1-intake-qualification` in OpenSpec change
`phase-1-intake-qualification`. Proposal, design, ten capability delta specs, and the ordered task
list are apply-ready. No Phase 1 runtime dependency, data, emulator, model, service, or code behavior
has been implemented yet. The phase remains `Planned` in PROJECT.md until its first implementation
commit.

The planning artifacts record Peter's accepted 2026-10-24 decision set. The most important scope
choices are:

- ZIP code is the only exact Military.com field verified from the current public landing page;
  every other Phase 1 intake field is visibly a LeadFlow demo field and the parity gate remains open.
- All inputs and outcomes remain fictional/synthetic and local. Firestore Emulator is the sole
  durable application store, reached only through loopback Fastify.
- Intake atomically persists idempotency, lead, run, and first event before graph execution.
- LangGraph.js uses a project-owned Firestore `BaseCheckpointSaver`; official JavaScript docs do not
  provide a Firestore saver.
- `rubric-v1` is deterministic: need timeline 40, request clarity 30, completeness 30; priority is
  high at 80–100, standard at 50–79, nurture at 0–49, and invalid evidence holds priority.
- The interpreter is a deterministic structured stub. Provider/model/prompt calls remain gated and
  `not_run`.
- A fixed-seed score-independent simulator exercises lifecycle/metric contracts only and makes no
  predictive or live-conversion claim.
- The product direction is a restrained operations dossier with a persistent
  `SIMULATION · Synthetic leads and outcomes` label, complete failure/recovery states, and desktop/
  390px accessibility.

## Planning verification

On the uncommitted planning tree, the following passed on 2026-10-24:

- `openspec validate --all --strict`: 5 items passed, 0 failed, including the Phase 1 change;
- Prettier check over PROJECT, the intake research record, and the complete change directory;
- `git diff --check`; and
- `openspec status --change phase-1-intake-qualification --json`, which reported proposal, design,
  specs, and tasks all `done` and the change apply-ready.
- `. .\scripts\activate-toolchain.ps1; pnpm check`: exact Node/pnpm preflight, Prettier, ESLint,
  strict TypeScript, 5 Vitest files/17 tests, production builds, synthetic-local evaluation (21
  passed, 0 failed, 3 `not_run`), API/web loopback smoke, constitution/hygiene checks, and strict
  OpenSpec validation.

The first gate attempt reached smoke and was denied an ephemeral loopback connection by the Windows
sandbox (`EACCES 127.0.0.1`); that failed attempt is retained. The identical offline gate passed when
allowed to open its temporary loopback ports. The planning read-through then tightened the accepted
test-email domains to `example.com`, `example.org`, and `example.net` and narrowed proposal wording to
the one verified ZIP field. This is planning evidence only; it does not establish Firestore,
LangGraph, UI, diagram, or Phase 1 runtime behavior.

## External evidence and gates

The dated research record is `docs/research/military-com-intake-2026-10-24.md`. It was based on a
read-only fetch of `https://auto.military.com/`; no form value was submitted and no downstream partner
form was opened. Current official LangGraph/Firebase documentation was consulted for design
feasibility, but no dependency was downloaded or installed during planning.

No GitHub remote, hosted CI, GCP resource, real personal data, provider credential, paid/model call,
live enrichment call, external communication, or public publication was created. All PROJECT.md
gates remain unresolved.

## Next action

Present the spec-only branch head for Peter's proposal review. After Peter authorizes implementation,
begin task 1.1 from `openspec/changes/phase-1-intake-qualification/tasks.md`; do not mark the phase In
progress before the first implementation commit. With no remote, there is no draft PR or hosted CI.
