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

Two inspector defects then surfaced on Windows and were fixed through new commits: the inspector's
Git calls now pass `safe.directory` per call (the checkout is owned by the Codex sandbox account),
and it extracts the source archive with relative paths because GNU tar reads `C:` as a remote host.
Extracting the exported runtime filesystem still failed on its symlinks, so the inspector now
streams regular `/app` files straight from the exported tar. Its first complete run reported 1,300+
findings that were all third-party package tests and docs or the compiled local-mode guard
constants; the content rules were scoped to what each area can leak (project files: artifacts,
build-machine paths, emulator data or configuration, key material, private values; third-party
packages: env or Git files, key material, private values), with a test proving each class is still
caught and that an upstream documentation placeholder (a private-key header followed by `xxxxxxx`) is not.

## Selected local candidate

Commit `b45328604ac78442a6cc9e8b76965418e7667cd7`, checked on 2026-10-26 on Windows 11, Node
24.22.1, pnpm 12.15.0, Docker 29.8.2.

| Check | Outcome |
|---|---|
| `pnpm check` (offline, credential-free) | pass: 48 files / 415 tests, 68 evaluation cases (43 pass, 25 `not_run` by design, 0 fail, 0 stale), governance, docs, Structurizr, 16 OpenSpec items |
| `pnpm emulator:runtime` | pass, including hosted retention, deny-all client rules, purge guard, held execution, deadline and lease reclaim |
| `pnpm container:inspect` | pass: image `sha256:d019ba1141abb98949f0f7620b543fad53bbe266f58048be30251175d29d399e`, user `node`, reviewed command and environment, no forbidden `/app` content |
| Release identity | the image manifest and the local clean bundle agree: revision as above, `dirty: false`, source `ab77cf72874be83aea09df59749d339fed1affb91258a511ffce09a9c6a35158`, lockfile `19a406d787ebf68320682513302aaef23e557ff0dd99a7506ecbbe213cce57d6`, fixtures `7a36183bd1dd36461a38c46bd62816e6cec797f8e36b5f89da62475340c113bc` |
| Offline hosted container probe (no network, synthetic configuration) | pass: process health 200 `hosted-process`; `/`, session and intake 401, including a forged assertion and an unsigned email header; no log output |
| History secret scan | pass: 1,219 blobs, planted canary detected; every finding is a digest, a synthetic test value, a regex literal or the scan method's own key-shape list; no `.env`, Codex config or `.local` file ever committed |
| Tracked-file personal data | pass: no owner email, home path or machine name; no binary or video file |
| Dependency audit | recorded above: 0 high or critical; two moderate development-only `firebase-tools` advisories not in the runtime image |

Before this candidate, the working tree held eight vendored files with CRLF bytes although Git
reported them clean against their LF blobs, so the local Git-listed source digest differed from the
image's. Restoring those files from the index (identical committed content) aligned the digests; no
commit was needed.

Private-value scanning ran with no `.local/private-values.txt` present, so only the generic shapes
were checked. The owner should create that file before task 6.1 so later scans also match the exact
private deployment values.

## Hosted proof notes

Commit `2f75efa` (the first recorded hosted evidence) was pushed with one failing evaluation case:
`p3-evidence-index` built its "unbound result" probe from the first recorded check, which had just
become a real, candidate-bound pass, so the probe was no longer unbound. A chained command let the
commit and push continue after the test failure. The probe now sets `candidateFingerprint: null`
explicitly; the case's intent and expected outcome are unchanged, and the full gate passed again
before the next push. The failed push is retained here rather than rewritten.
