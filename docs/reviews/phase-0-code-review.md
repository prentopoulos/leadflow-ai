# Phase 0 code review

## Scope

- Branch diff: `main...phase-0-foundation`
- Fixed point: `main` at `43a1efe80d8229593ff87ba6dab96151dd67e3dd`
- Reviewed implementation through: `41e8359`
- Finding-fix revision: `c183118b467bd6f200f25f729a5a0833558cccac`
- Applicability: Phase 0 local foundation only; no hosted, live-provider, cloud, or production claim
- Review date: 2026-10-24
- Owner: Peter

## Standards axis

One medium documented-standard violation was found. `scripts/check-hygiene.mjs` included the first
four characters of a credential-like match in its failure output, conflicting with the constitution
rule that secrets are never printed or included in reports. No actionable baseline code smell was
found.

Resolution: hygiene output now reports only the normalized path and finding category. Its regression
test asserts that even the canary prefix is absent.

## Spec axis

Two medium findings were found:

1. The typecheck used solution build mode, emitted artifacts, and let evaluation depend on those
   outputs before the named build step, contrary to the non-emitting typecheck requirement.
2. The evaluation bundle identified source, lockfile, schemas, fixtures, evaluator, and environment,
   but did not independently identify configuration as required.

Resolution: `tsconfig.check.json` now performs a root non-emitting source typecheck; the composed gate
runs the named build before evaluation. The bundle schema and generator now include the explicit
`configurationVersion` field, covered by the report-schema test. No actionable scope creep or other
missing Phase 0 behavior was found.

## Evidence and disposition

After removing only verified ignored build outputs, the corrected typecheck passed without creating
any build directory. The complete gate then passed from that artifact-clean state. After committing
the fixes, the clean revision `c183118` passed `pnpm check` again: 5 test files and 17 tests passed;
the synthetic-local evaluation recorded 21 passed, 0 failed, and 3 `not_run`; both smoke listeners
used `127.0.0.1`; governance and strict OpenSpec validation passed.

Disposition: all review findings are resolved. Recheck this review if the gate composition, secret
scanner output, evaluation bundle identity, or Phase 0 scope changes before merge.
