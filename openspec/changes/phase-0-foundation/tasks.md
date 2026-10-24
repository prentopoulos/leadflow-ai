## 1. Toolchain and workspace

- [ ] 1.1 Activate and verify Node.js 24.22.1 and pnpm 12.15.0 without removing the existing fallback toolchain.
- [ ] 1.2 Add private root/workspace manifests, ESM and strict TypeScript project references, exact direct tool versions, safe ignore/example configuration, and one pnpm lockfile.
- [ ] 1.3 Document and verify the Windows-friendly bootstrap and frozen-lockfile installation path without credentials.

## 2. Shared domain and API skeleton

- [ ] 2.1 Implement domain-owned Zod contracts and JSON Schema export coverage for the Phase 0 health and evaluation boundaries.
- [ ] 2.2 Implement the Fastify application factory, narrow `GET /health` contract, validated configuration, and unit/injection tests without opening a network listener.
- [ ] 2.3 Add the built API localhost smoke test with an ephemeral port, loopback assertion, timeout, and cleanup.

## 3. Web skeleton

- [ ] 3.1 Implement the React/Vite/Tailwind application shell with honest local-synthetic labeling and no fabricated metrics or later-phase claims.
- [ ] 3.2 Add tests for semantic structure, keyboard-visible focus, reduced-motion behavior, and readable desktop/390px layout constraints.
- [ ] 3.3 Add the built web localhost smoke test with an ephemeral port, shell assertion, timeout, and cleanup.

## 4. Offline evaluation scaffold

- [ ] 4.1 Define versioned fixture and result schemas with stable case IDs, evidence labels, applicability, bundle identity, and `pass`/`fail`/`not_run` outcomes.
- [ ] 4.2 Add the fixed synthetic corpus for rubric arithmetic, schema rejection, consent, injection, unavailable evidence, invalid/duplicate events, and partial/failed runs.
- [ ] 4.3 Implement evaluator assertions, intentional canary self-tests, failure retention, and a synthetic-local report that leaves future model/provider fields null.

## 5. Quality gate and governance checks

- [ ] 5.1 Implement named format, lint, type, test, evaluation, build, and smoke scripts and compose them into the offline credential-free `pnpm check` command.
- [ ] 5.2 Implement constitution-copy/version drift and tracked secret/config hygiene checks with focused tests.
- [ ] 5.3 Add the separate non-mutating connected dependency audit using the accepted high-severity threshold.

## 6. Verification and handoff

- [ ] 6.1 Run every leaf check, the complete offline `pnpm check`, strict OpenSpec validation, the connected dependency audit, and a frozen-lockfile/bootstrap verification; preserve and resolve failures.
- [ ] 6.2 Update PROJECT.md, AI_OPS.md, and HANDOFF.md with the verified command, system/evaluator evidence, limitations, and exact next task without claiming hosted, live-provider, or production results.
- [ ] 6.3 Perform the required code review against the Phase 0 diff, resolve findings in new commits, and rerun affected checks before marking the phase ready for owner merge approval.
