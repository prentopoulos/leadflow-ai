# Current handoff

Read PROJECT.md and current user instructions. Inspect actual Git/OpenSpec state before resuming.

## Current checkpoint

Phase 0 is implemented on branch and OpenSpec change `phase-0-foundation`. The planning commit is
`1baae83`, implementation baseline is `30456ff`, and reviewed fix revision is
`c183118b467bd6f200f25f729a5a0833558cccac`. All 18 tasks and the required branch-diff code review
are complete. Nothing has been merged or archived.

No GitHub remote, hosted CI, cloud resource, real personal data, provider credential, paid/model
call, live enrichment call, or external communication was created. The project-local Node/pnpm
toolchain and dependency caches are ignored.

## Implemented behavior

- A private pnpm workspace pins Node 24.22.1 and pnpm 12.15.0 with strict ESM TypeScript projects
  for `apps/web`, `apps/api`, `packages/domain`, and `packages/evals`.
- The Fastify API exposes only a validated `GET /health` skeleton in Phase 0. Its smoke test binds an
  ephemeral port on `127.0.0.1` and cleans up.
- The React/Vite/Tailwind shell visibly labels itself local and synthetic, makes no live or later-phase
  claims, remains readable at desktop and 390px widths, and preserves keyboard focus and reduced
  motion behavior.
- Shared Zod contracts cover health, evidence, deterministic 40/30/30 marketing-readiness scoring,
  consent/draft boundaries, enrichment availability, and partial/failed run state. Positive rubric
  points require criterion evidence; the contracts make no insurance eligibility, underwriting,
  pricing, or risk decision.
- The fixed synthetic-local evaluation corpus covers rubric arithmetic, schema rejection, consent,
  hard-boundary injection attempts, unavailable evidence, duplicate/invalid events, and partial or
  failed runs. Future hosted-model, live-enrichment, and agent-runtime cases remain `not_run`.
- `pnpm check` is the credential-free offline gate. The registry-backed dependency audit remains a
  separate non-mutating command.

## Verification evidence

On clean review-fix revision `c183118`, `. .\scripts\activate-toolchain.ps1; pnpm check` passed:

- exact Node 24.22.1 and pnpm 12.15.0 preflight;
- Prettier, ESLint, strict TypeScript, 5 Vitest files and 17 tests;
- synthetic-local evaluation: 24 total, 21 passed, 0 failed, 3 `not_run`;
- production builds plus API and web smoke tests on `127.0.0.1`;
- 12-rule constitution-copy check and tracked-file hygiene over 440 candidate files; and
- `openspec validate --all --strict` for `phase-0-foundation`.

The generated evaluation bundle recorded the clean revision, exact tool versions, and
source/lockfile/fixture digests while leaving model, provider, prompt, and tool-contract fields null.
The authorized connected `pnpm audit:dependencies` reported no known vulnerabilities and left the
lockfile unchanged. A separate clean `--frozen-lockfile --offline --ignore-scripts` bootstrap reused
all 404 packages, downloaded 0, and preserved lockfile SHA-256
`DFF53E45F62B4C68973EAD38077FAE594998180F2CC5F7B073462656EC63970D`.

Failures are retained rather than hidden: the original unsupported
`openspec validate --change ...` invocation failed before the supported strict command passed;
implementation checks exposed and resolved lint, type, test, build, smoke, formatting, and fake
credential-canary issues. During final bootstrap verification, one attempt was denied access to
pnpm's LocalAppData store lock and one intentionally workspace-store-only attempt reported a missing
offline tarball; the successful default-cache run above followed with explicit exit-code checking.
The required two-axis review then found three medium issues: partial secret text in hygiene output,
typecheck emitting artifacts used by evaluation, and missing explicit configuration identity in the
evaluation bundle. Commit `c183118` resolved all three; the artifact-clean and committed-revision
gates passed. The durable review record is `docs/reviews/phase-0-code-review.md`.

## Limits and next action

Phase 0 evidence is local and synthetic only. Hosted CI, Docker, model/provider behavior, Firestore,
LangGraph execution, authentication, live enrichment, dashboard operations, production readiness,
Military.com intake parity, and all outcome/quality thresholds deferred in PROJECT.md remain
unimplemented or unresolved.

Next action: archive/sync the completed OpenSpec change on this branch, mark Phase 0 Done, rerun the
gate, and ask Peter for merge approval. After an owner-approved merge and clean checkpoint, clear the
session and start Phase 1 through the `next-phase` workflow; do not begin Phase 1 here.
