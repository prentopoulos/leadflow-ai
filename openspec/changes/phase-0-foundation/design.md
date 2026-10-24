## Context

LeadFlow AI currently contains governance, workflow, review, and skill scaffolding only. There is no
runtime, dependency manifest, lockfile, application source, evaluation harness, or executable quality
gate. Phase 0 must create those foundations without activating any later-phase capability or relying
on credentials, live services, real personal information, hosted CI, or public infrastructure.

Peter accepted the Phase 0 decision set on 2026-10-23. The target is a local prototype foundation:
one private pnpm workspace, deterministic checks, synthetic fixtures, and bootable application
shells. The implementation may download public packages and run the separately authorized registry
audit, but the normal quality gate is offline once dependencies are installed.

The current repository is the source of truth. There is no remote, accepted main spec, application
data, or previous runtime bundle to migrate.

## Goals / Non-Goals

**Goals:**

- Pin the accepted runtime and package manager, create a single lockfile, and document reproducible
  Windows-friendly bootstrap steps.
- Create small React/Vite and Fastify applications with shared Zod-owned contracts and clean package
  boundaries for later domain and agent work.
- Establish a credential-free offline check that validates source quality, tests, builds, local
  startup behavior, OpenSpec, constitution copies, secret/config hygiene, and Phase 0 evaluations.
- Freeze the first synthetic evaluation corpus and result contract before later model or workflow
  implementation can tune against it.
- Record which security controls are implemented, only designed, or not applicable to this local
  phase, with recheck triggers for later capabilities.

**Non-Goals:**

- Firestore, Firebase Auth, LangGraph orchestration, provider prompts/models, live enrichment,
  outreach generation, operational dashboard data, or durable workflow state.
- Docker, Cloud Run, hosted CI, remote repository configuration, public publication, or licence
  selection.
- Real personal data, claims of Military.com form parity, insurer decisions, quotes, or external
  communication.
- Product methodology not yet approved: priority bands, field-level completeness, metric timing and
  denominators, model-quality thresholds, retention, and production operations.

## Decisions

### Runtime, packages, and repository shape

- Pin Node.js `24.22.1` and pnpm `12.15.0` in repository metadata and bootstrap validation. Peter
  authorized local activation. Node 24 is the current LTS line; Node 22 remains a compatibility
  fallback only while activation is being completed.
- Use one private pnpm workspace with `apps/web`, `apps/api`, `packages/domain`, and
  `packages/evals`. Root configuration owns TypeScript, lint, format, and orchestration scripts.
- Use private provisional package names under `@leadflow-ai/*`. These are internal imports, not a
  public npm or repository identity.
- Use ESM, strict TypeScript 6 project references, React 19.3 with Vite 8, Tailwind CSS 4.3,
  Fastify 5, ESLint 10 with typescript-eslint, exact-pinned Prettier 3.9.10, and Vitest 5. The
  generated lockfile records exact transitive resolutions.
- Do not add a monorepo task runner. Four packages and root scripts do not justify Nx or Turborepo.

### Application boundaries

- `apps/web` owns only the browser shell and its presentation contract. The Phase 0 page identifies
  itself as a local synthetic foundation and does not display fabricated operational metrics.
- `apps/api` owns HTTP startup, local configuration, and a schema-validated `GET /health` process
  health route. Health says the process is running; it does not imply Firestore, model, enrichment,
  or deployment readiness.
- `packages/domain` owns deterministic schemas and invariant helpers. Zod 4 is the TypeScript source
  of truth; JSON Schema Draft 2020-12 exports are generated only for boundaries that need them.
- `packages/evals` owns fixture schemas, cases, evaluator behavior, and result serialization. It may
  depend on domain contracts; application packages must not own evaluation truth.
- Runtime configuration is validated and contains no default secret. `.env` remains ignored and an
  `.env.example` may contain names and safe local values only.

### Quality and smoke contract

- Root `pnpm check` is the Phase 0 gate. After a frozen install it performs, without network or
  credentials: runtime/package-manager preflight, Prettier check, ESLint, strict TypeScript project
  checks, unit and contract tests, evaluator self-tests and all runnable cases, production builds,
  API/web localhost smoke tests, constitution-copy/version drift validation, tracked-file secret and
  configuration hygiene, and `openspec validate --all --strict`.
- The API smoke test starts the built server on an ephemeral port bound to `127.0.0.1`, validates
  `GET /health`, and terminates it. The web smoke test starts the built preview similarly, verifies
  an identifiable LeadFlow AI shell, and terminates it. Processes are cleaned up on success or
  failure.
- `pnpm audit:dependencies` is a separate, connected, non-mutating command using a high-severity
  threshold. Peter authorized the registry request. Its evidence is reported separately because an
  offline `pnpm check` must remain reproducible without a network.

### Evaluation contract and system bundle

- The Phase 0 bundle identifier includes the Git revision or dirty-patch digest, Node/pnpm versions,
  lockfile digest, source/config/schema revisions, fixture/evaluator revision, and environment facts.
  Model, prompt, tool, and provider fields remain `null` with `not_run` reasons.
- Case IDs are fixed before implementation. The minimum corpus covers: valid bounded 40/30/30
  arithmetic; out-of-range, non-finite, and total-mismatch rejection; malformed/missing/invalid-enum
  schema inputs; consent false and absent; consent true yielding only a draft-awaiting-approval
  expectation; prompt injection unable to change rubric, authority, consent, or evidence labels;
  timeout/error/empty enrichment represented as unavailable; partial and failed runs preserved;
  invalid and duplicate state events; and fixture/mock/live labeling.
- Phase 0 evaluates contracts and deterministic invariants, not model quality or future runtime
  behavior. Every applicable assertion and harness canary must behave as expected. A deferred case is
  `not_run`, never a manufactured pass. Failures remain in the generated local report.
- Priority bands, detailed completeness, operational-metric denominators, and model-quality
  thresholds remain explicit versioned TBDs.

### Security baseline and lifecycle

This phase targets a single-user local prototype. Baseline disposition:

- **B01 secrets:** required; enforced by ignored `.env`, safe example configuration, tracked-file
  hygiene, and no credential requirement.
- **B02 access/isolation:** local OS boundary only; smoke listeners are verified as loopback. Recheck
  before another user, remote listener, auth, or deployment.
- **B03 tools/action authority:** no runtime tools or external writes exist. Recheck when adapters or
  persistent actions are introduced.
- **B04 untrusted content:** deterministic fixtures include injection strings and cannot expand the
  evaluator's authority. Recheck for model/tool and live-source input.
- **B05 data handling:** synthetic fictional fixtures only; routine outputs contain no real personal
  data. Retention/deletion remains a later-phase decision before durable or real data.
- **B06 bounds/spend:** no paid calls; local test processes have termination/timeout controls. Recheck
  before model, live API, unattended, or hosted execution.
- **B07 correctness/safe failure:** deterministic schemas, invariants, canaries, and explicit
  unavailable/failed states are required.
- **B08 integrity/recovery:** exact lockfile, version preflight, bundle metadata, non-mutating checks,
  and version-control rollback apply. Connected audit evidence is distinct from offline evidence.

### Non-negotiables check

| PROJECT rule or gate touched | Phase 0 treatment |
|---|---|
| Secrets | No secret dependency; `.env` ignored; safe example and tracked-file hygiene check. |
| Honest results and failed runs | Synthetic/local/not-run labels are explicit; failures are retained. |
| Operator resolves gates | Peter approved machine activation and the connected registry audit; no other gate is exercised. |
| Marketing readiness only | Fixtures use that term and the fixed 40/30/30 arithmetic only. |
| Fictional identities/test contacts | All fixtures are synthetic and fictional. |
| Persist before agents | No agent executes in Phase 0; later implementation remains constrained by this rule. |
| Consent and human approval | Cases encode no draft without consent and draft-only/awaiting approval with consent. |
| Backend keys, minimized model data, structured outputs, verified evidence | No model/key exists; schemas and future evidence states are established without claims of live verification. |
| Deterministic rubric | Arithmetic and rejection invariants are hard checks; thresholds beyond the fixed weights remain TBD. |
| Military.com claims | The shell makes no parity claim and adds no purported intake fields. |
| Dashboard metrics | No operational metric is displayed; any fixture output is labeled synthetic. |
| Accessible UI | The minimal shell preserves semantics, keyboard use, visible focus, reduced motion, and a readable 390px layout without claiming full product WCAG conformance. |
| Paid/API quota gate | No paid/provider call; dependency downloads and the accepted registry audit are the only connected setup/check actions. |
| GCP/public exposure gate | No container, deployment, remote listener, or hosted CI. |
| Real personal information gate | No real data. |
| External communication gate | No channel or sending capability. |
| Public GitHub gate | No remote, push, `gh`, publication, licence, or public identity decision. |
| Military.com parity gate | No parity claim. |

There is no exception to the constitution.

## Risks / Trade-offs

- **[Machine runtime activation may be unavailable or conflict with the installed Node]** → Preserve
  existing installations where possible, verify versions before installing packages, and stop with
  exact bootstrap instructions if activation cannot be completed safely.
- **[Current package versions may have peer incompatibilities]** → Resolve against current official
  package metadata, use exact direct versions, commit the lockfile, and fail the clean bootstrap or
  type/build checks rather than suppressing peer problems.
- **[A broad root check becomes hard to debug]** → Keep named leaf scripts and have `pnpm check`
  compose them in a stable order with normal command output.
- **[Secret scanning can produce false positives or miss encoded secrets]** → Limit the Phase 0 check
  to tracked-file/config invariants and document that a later publication review performs the full
  history and generated-asset scan.
- **[Fixtures can be mistaken for implemented agent behavior]** → Store expected future cases as
  `not_run` until an enforcing implementation exists and label reports `synthetic-local`.
- **[Private package names may later change]** → Keep them private and defer public identity; a later
  rename is an explicit migration before publication.

## Migration Plan

1. Verify or activate the accepted Node and pnpm versions.
2. Create workspace manifests/configuration and install exact dependencies to produce one lockfile.
3. Add the four package boundaries and their minimal tests.
4. Add evaluation fixtures/harness and quality scripts, then run each leaf check.
5. Run the complete offline gate, the separate connected audit, and an independent clean-bootstrap
   verification where practical.
6. Update PROJECT.md's gate from `TBD in Phase 0` only after `pnpm check` exists and passes; update
   HANDOFF with exact evidence.

Rollback before durable state consists of reverting the Phase 0 commits. No cloud, database, remote,
or external side effect requires migration or recovery.

## Open Questions

- None for Phase 0 implementation. Later phases retain the explicit methodology, provider, cloud,
  data, publication, form-parity, and external-communication decisions listed above.
