# LeadFlow AI

Multi-agent marketing lead qualification, enrichment, outreach drafting, verification, and
operator monitoring for a Military.com-style auto-insurance funnel.

Read PROJECT.md for scope, acceptance criteria and gates. Follow WORKFLOW.md and
`.agents/skills/next-phase/SKILL.md` for phase/checkpoint work. Read HANDOFF.md for recovery state.
Use `.agents/skills/leadflow-ai-build-safety/SKILL.md` for architecture, dependencies, tool
contracts, data, telemetry, spend or readiness. Read `AI_OPS.md` and
`.agents/skills/leadflow-ai-ai-ops/SKILL.md` for model, prompt, evaluation, agent-runtime, state,
monitoring, or provider changes. Use
`.agents/skills/leadflow-ai-lead-quality-review/SKILL.md` for qualification scores, enrichment
claims, evidence verification, and reported dashboard metrics.

## Boundaries

- The MVP uses fictional identities and test contact details; real personal data is gated.
- Qualification measures marketing readiness only, never eligibility, underwriting, pricing, or risk.
- NHTSA and Zippopotam.us are read-only enrichment sources; no insurer integration or quotes exist.
- Outreach is a consent-gated draft for human approval; automatic sending is outside scope.
- Local, deterministic work may proceed; paid APIs, GCP exposure, public GitHub publication, and
  external communication remain gated.
- Actual Military.com form questions must be verified before the product claims intake parity.

## Non-negotiables

Verbatim from PROJECT.md section 5, the project's constitution, which governs. Only the owner
amends it; a gate check fails if this copy drifts.

**Version 1.0.0** · Ratified 2026-10-23 · Last amended 2026-10-23

- Secrets use the runtime secret mechanism (gitignored .env for local development); never print,
  commit or include them in reports.
- Never fabricate results or external-service output. Label mocked, local and live results
  accurately. Preserve failed runs.
- Operator resolves all gated actions. The agent never satisfies or waives one itself.
- Qualification scores marketing readiness only; never use or describe it as insurance eligibility,
  underwriting, pricing, risk, or personal financial advice.
- Use fictional identities and test contact details in development, demonstrations, screenshots,
  prompts, fixtures, and public repository content unless the real-data gate is explicitly resolved.
- Persist a lead before agent execution; represent partial progress, retries, verification failures,
  and unavailable external evidence honestly.
- Outreach requires recorded contact consent and human approval, remains a draft in this MVP, and
  is never sent automatically.
- Keep API keys on the backend, minimize data sent to models, require structured agent outputs, and
  verify external evidence before presenting it as enriched fact.
- Qualification uses the documented deterministic rubric; model interpretation may supply structured
  criterion evidence but may not silently change point weights or make insurance decisions.
- Claims about Military.com's form must be backed by verified source evidence; unconfirmed or added
  demo fields must be labeled as such.
- Dashboard metrics must come from stored run data or a clearly labeled synthetic fixture; never
  present illustrative values as live operational results.
- UI must preserve keyboard access, visible focus, semantic structure, reduced-motion behavior, and
  readable desktop and 390px mobile layouts.

Surface and stop at the relevant gate; local work can proceed before deferred gates. Every change
to code gets a code review before it merges (WORKFLOW.md).

## Development

Phase 0 establishes exact Node version, package manager, backend HTTP framework, lockfile, local
bootstrap, and quality gate. Do not claim those commands exist before Phase 0 verifies them.

Architecture diagrams: C4 as code (Structurizr DSL in `docs/architecture/`), rendered with the
diagram-design skill; READMEs follow the showcase skill and never use Mermaid. Figma is for slides and mocks.

Windows working notes:
- write multi-line scripts to a file and run it; long bash heredocs mangle backslashes;
- clone into a short path, or set `git config core.longpaths true`; deep paths fail with
  "Filename too long";
- after starting a local server, confirm it listens on 127.0.0.1 only unless public exposure is
  explicitly authorized.

Gate: activate the repository toolchain with `. .\scripts\activate-toolchain.ps1`, then run
`pnpm check`. The gate is credential-free and offline after the frozen dependency install.
Public GitHub repository planned; no remote exists yet. Do not run `git push` or `gh` until the owner
authorizes repository creation/publication. Once a remote exists, use phase branches and PRs; nothing
goes straight to main, and merge only after review and the owner's go-ahead.
