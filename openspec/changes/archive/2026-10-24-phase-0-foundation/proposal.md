## Why

LeadFlow AI has governing requirements and phase controls but no executable application or verified
development gate. Phase 0 establishes a reproducible, local-only foundation so later product work can
be implemented and evaluated without credentials, paid services, or unsupported readiness claims.

This change implements PROJECT.md Phase 0.

## What Changes

- Pin the accepted Node.js, pnpm, TypeScript, React, Vite, Tailwind CSS, Fastify, validation,
  formatting, linting, and test toolchain in one private workspace and lockfile.
- Scaffold bootable web and API applications with shared deterministic domain and evaluation
  packages, validated configuration, and localhost-only smoke checks.
- Establish a single offline `pnpm check` quality command covering formatting, linting, types,
  tests, builds, smoke checks, constitution-copy drift, tracked secret/config hygiene, strict
  OpenSpec validation, and runnable deterministic evaluation cases.
- Add a separate owner-authorized connected dependency-audit command that reports high-severity
  registry findings without mutating dependencies.
- Create versioned synthetic fixtures and evaluator contracts for rubric arithmetic, schema
  rejection, consent denial, prompt injection, unavailable enrichment, invalid state events, and
  partial or failed runs. Capabilities not implemented in Phase 0 remain `not_run`.
- Record toolchain decisions and evidence while preserving later-phase gates and unresolved product
  methodology.

### Non-goals

- No Firestore, Firebase Auth, LangGraph workflow, model/provider call, live enrichment, outreach
  generation, production dashboard, container, deployment, hosted CI, or public repository work.
- No real personal information, Military.com intake-parity claim, insurer integration, quote,
  automated communication, or use of paid quota.
- No priority thresholds, detailed completeness rules, operational-metric denominators, or model
  quality targets beyond the already accepted deterministic invariants.
- This change does not amend PROJECT.md section 5 or loosen any section 6 gate.

## Capabilities

### New Capabilities

- `local-toolchain`: Reproducible Node and pnpm workspace metadata, exact toolchain policy, lockfile,
  bootstrap instructions, and private package boundaries.
- `application-skeleton`: Bootable React web and Fastify API applications with shared domain schema
  ownership, validated local configuration, and localhost smoke contracts.
- `offline-evaluation`: Versioned synthetic fixtures, deterministic evaluator contracts, honest
  `pass`/`fail`/`not_run` evidence, and hard failure semantics for applicable assertions.
- `quality-gate`: One credential-free offline verification command plus a separate non-mutating,
  owner-authorized connected dependency audit.

### Modified Capabilities

None. No main OpenSpec capability exists yet.

## Impact

- Adds root workspace metadata, an exact dependency lockfile, application/package source trees,
  deterministic tests and evaluation fixtures, local scripts, and bootstrap documentation.
- Establishes Fastify and Zod as internal HTTP/schema boundaries without adding any live external
  service dependency.
- Changes PROJECT.md only to record the owner's Phase 0 decisions; the constitution is unchanged.
- Future phases may build on these boundaries but must independently resolve their provider, data,
  cloud, publication, form-parity, and communication gates.
