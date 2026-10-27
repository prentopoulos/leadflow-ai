# Phase 3 local candidate review

Date: 2026-10-26. Scope: `main...phase-3-deployment-access-evidence`, OpenSpec change
`phase-3-deployment-access-evidence`. This is local evidence only; no hosted result is claimed.

## Consolidated review

The standards, specification and security passes agreed on four release-blocking findings. Each was
fixed before selecting the local candidate:

- Deployed evidence could pass with local-scoped checks and incomplete candidate identity. Check ID
  and scope now agree, every deployed result binds source, lockfile, system bundle, build, image and
  revision through a candidate fingerprint, and any changed identity holds readiness.
- The purge trusted caller assertions and had no executable boundary. The purge now compares the
  actual Admin SDK target, configured target and requested target, while the Cloud Shell entry point
  independently verifies the active `gcloud` owner and ADC owner before any delete.
- First-deployment subject discovery depended on a browser seeing IAP's proxy-only assertion. The
  pre-deploy helper now validates the active owner's `gcloud` identity token and writes the stable
  subject only to the ignored private record.
- The final image was not inspected. `pnpm container:inspect` now builds an isolated `git archive`,
  inspects immutable metadata, exports the runtime filesystem and scans `/app` for forbidden
  development artifacts, local/emulator paths, configured private values and credential patterns.

Additional fixes: hosted resume uses the accepted 75-second lease; a later non-JSON IAP 403 unmounts
the workspace into the access-denied state; Cloud Build permits only the commit substitution, fixes
its repository and destination, and pins both privileged helper images by digest.

Two judgment findings were not taken: renaming the established Phase One runtime surface and
extracting a small set of route helpers would enlarge this deployment-focused change without fixing
a correctness or security boundary. No material scope creep was found.

## Domain and interface review

The change does not alter `rubric-v1`, point weights, marketing-readiness meaning, enrichment truth
labels, consent rules, or dashboard metric definitions. The deterministic evaluation and existing
lead-quality regression cases remain authoritative; hosted evidence remains recorded-only and
synthetic.

The completed synthetic intake/dossier was rendered in Chrome at desktop width and at an explicit
390 by 844 viewport. The mobile document had no horizontal overflow (`scrollWidth` equalled
`clientWidth`), persistence moved focus to the dossier heading, Tab reached the next disclosure, and
the focused disclosure had a visible 3 px solid teal outline. Labels, headings, synthetic context,
no-send notice and disclosure controls remained present at both sizes. No design blocker was found.

The connected locked-dependency audit completed without changing the lockfile: zero high or critical
advisories and two moderate, development-only advisories under `firebase-tools` (`uuid` buffer bounds
and OpenTelemetry baggage allocation). Neither path is installed in the production runtime image;
they remain recorded for the next Firebase CLI/toolchain update.

## Remaining gate

Exact source/lock identities, the final full gate, dependency audit, built-image inspection and
publication scans are recorded only after the review fixes form a clean commit. All cloud checks
remain `not_run` pending the separate enumerated owner approval for task 6.1.

The first post-review full-gate attempt reached governance and stopped because a synthetic test
expectation contained a literal shaped like a private IAP subject. The scanner worked as designed;
the test now assembles the expected value without embedding a subject-shaped literal. This failed
attempt is retained and is not reported as a passing candidate gate.

The first exact-commit image build then stopped before producing an image because GNU `find -delete`
implicitly enables depth traversal and invalidated the command's `node_modules` prune. The Dockerfile
now uses an explicit pruned `-exec rm` for compiled test artifacts. Commit `d5799d8` is therefore not
the selected image candidate; the replacement commit must repeat the material checks and inspection.
