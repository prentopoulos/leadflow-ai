# Phase 3 dependency decision

Decision date: 2026-10-26. Scope: the private hosted proof of concept (PROJECT.md Phase 3).

Peter accepted both additions in the reviewed Phase 3 proposal and approved downloading the base
image. No other direct dependency is added.

## Selected versions

| Item | Version or digest | Licence | Purpose |
|---|---|---|---|
| `google-auth-library` (direct, `apps/api`) | `11.3.1`, exact | Apache-2.0 | Verifies the signed `x-goog-iap-jwt-assertion` with IAP's public keys (`getIapPublicKeys`, `verifySignedJwtWithCertsAsync`). |
| Container base `node:24.22.1-slim` | `sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205` | Node.js and Debian package licences | Official Node image for the build and runtime stages, matching `.node-version`. |
| Cloud Build `git` helper (amd64) | `sha256:68bbb0c02d8bac5339f74a5587d685d1e631e8a0437ab5d02991fbbf9c738012` | Apache-2.0 | Clones and verifies the fixed public repository and exact commit. |
| Cloud Build `docker` helper (amd64) | `sha256:0aca0f95e1ba8f9107263d3e9782d5ce99a5b60d35b3f8985e4534b65552636f` | Apache-2.0 | Builds and publishes the reviewed Dockerfile under the fixed release destination. |

`google-auth-library` 11.3.1 was already in the lockfile as `firebase-admin` 14.5.0's own
dependency, so declaring it installed nothing new (`pnpm add --offline`, lockfile change of three
lines). pnpm's strict layout forbids importing a transitive package, which is why it is declared.

The base digest is the multi-architecture index digest reported by `docker pull` on 2026-10-26
(image created 2026-10-21). Every Dockerfile stage uses it through one `ARG`, and
`scripts/check-container.mjs` fails the gate if the Dockerfile and this record disagree.
The Cloud Build helper digests are the linux/amd64 manifests resolved read-only from GCR on
2026-10-26; the release configuration pins them and leaves only the source commit substitutable.

## Verification notes

- The library's verifier checks signature, `iat`/`exp` (with a 300-second skew and a caller-set
  maximum lifetime, here 900 seconds), issuer and audience. It does not check the algorithm, so the
  application refuses any header other than `ES256` before calling it, and it discards the
  library's error messages because they embed the token.
- IAP key fetches go to Google's public key endpoint; the application caches keys for an hour and
  refreshes at most once a minute when an unknown key ID appears.
- In the container, pnpm 12.15.0 comes from Corepack, which checks the npm registry signature of the
  package manager it downloads. The application install is `--frozen-lockfile`.

## Alternatives considered

- `@fastify/static` was not added. The built web app is a handful of files, so the API reads them
  once into an exact path map (`apps/api/src/static-web.ts`); a request is a map lookup, never a
  filesystem join.
- `jose` or a hand-written ES256 verifier would avoid the Google library, but the accepted design
  names Google's own IAP verification path and the library is already in the lockfile.
- An Alpine or distroless base would be smaller, but the owner approved the official slim image and
  it matches the local Node build exactly.

## Limits and recheck triggers

Recheck the base digest and `google-auth-library` when Node, `firebase-admin` or the IAP signing
contract changes, and run `pnpm audit:dependencies` (separately authorized registry access) before
the phase merges.
