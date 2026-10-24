# Current handoff

Read PROJECT.md and current user instructions. Inspect actual Git/OpenSpec state before resuming.

## Current checkpoint

Phase 0 started on 2026-10-23 after Peter accepted the complete decision list. The active branch and
OpenSpec change are both `phase-0-foundation`. Planning artifacts define a local-only toolchain,
application skeleton, offline evaluation scaffold, and deterministic quality gate. No application
implementation, dependency install, cloud resource, GitHub remote, or provider credential has yet
been created.

The accepted toolchain target is Node.js 24.22.1, pnpm 12.15.0, a private four-package workspace,
Fastify 5, Zod 4/JSON Schema Draft 2020-12, ESM/strict TypeScript 6, React 19.3, Vite 8, Tailwind
CSS 4.3, ESLint 10, Prettier 3.9.10, and Vitest 5. Peter authorized local Node/pnpm activation,
Phase 0 dependency downloads, and a separate non-mutating registry-backed dependency audit.

OpenSpec 1.6.0 created project-local Claude and Codex skills. Its optional global Codex prompt install
could not write to `C:\Users\Peter\.codex\prompts` under the workspace sandbox; project-local Codex
skills are present in `.codex/skills/` and are the supported path for this repository.

## Implemented behavior

None yet. The repository still contains planning, safety, design, review, and phase-workflow
scaffolding only. The new OpenSpec artifacts are plans, not runtime evidence. Illustrative dashboard
values in the source brief remain requirements/examples, not runtime output.

## Verification and next action

- Source kit validator: passed required files, all 26 verbatim hashes, course provenance, template
  metadata, Claude settings, Markdown links, and all four render variants.
- OpenSpec initialization: project-local Claude and Codex skills created; `openspec list` exited
  successfully with no active changes.
- Setup verification: unresolved-template scan passed; all 26 installed verbatim hashes matched;
  no accidental nested copies were found; 110 Markdown files had valid local links; Claude pointer
  frontmatter matched canonical skills; constitution copies matched; strict OpenSpec validation
  returned the valid empty-project result.
- Phase 0 planning: all four artifacts complete; `openspec validate --all --strict` passed for
  `phase-0-foundation`. An attempted `openspec validate --change ...` invocation failed because
  OpenSpec 1.6 does not support that flag; the failure is retained here rather than hidden.
- Runtime and AI evaluation: not run; no app or AI runtime exists.
- 21st.dev: routed through the installed design workflow. No paid generation or project design context
  is initialized before the UI phase and owner approval for any paid quota.

Next action: complete OpenSpec task 1.1 by activating and verifying Node.js 24.22.1 and pnpm 12.15.0,
then implement tasks 1.2–1.3 for the workspace, lockfile, and bootstrap. Continue only through the
Phase 0 task list; do not start Phase 1. Public GitHub publication, hosted CI, GCP, real personal data,
paid/model calls, external communication, and Military.com parity claims remain unresolved gates.
