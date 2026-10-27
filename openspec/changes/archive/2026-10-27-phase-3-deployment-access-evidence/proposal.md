## Why

Phase 2 proved the complete LeadFlow workflow locally, but the product still has no authenticated
hosted path or evidence that the packaged system can run, recover, and roll back on its selected
Google Cloud boundary. Phase 3 implements PROJECT.md Phase 3 as a private, single-owner hosted proof
of concept with bounded cost, synthetic data, reviewable deployment evidence, and a reproducible
walkthrough.

## What Changes

- Package the existing React/Fastify workspace as one Cloud Run container that serves the operator
  interface and API, while preserving the credential-free local emulator path.
- Replace Phase 3's earlier Firebase Auth plan with direct Cloud Run IAP, accepted by Peter on
  2026-10-26 to keep the service private without `allUsers` or `allAuthenticatedUsers`. The API
  validates the signed IAP assertion and a private stable-subject allowlist at the application
  boundary.
- Add a fail-closed cloud configuration for Firestore Standard/Native in Toronto, backend-only
  access, request-based Cloud Run billing, scale-to-zero limits, seven-day synthetic-data TTL, and
  explicit purge and teardown procedures.
- Replace post-response in-process execution in cloud mode with an idempotent request-bound start:
  intake still persists and returns `202`, then the authenticated browser holds an execution request
  while revision-aware polling shows stored progress. Local mode retains its current background
  executor.
- Add a reproducible Cloud Shell/Cloud Build path that builds one clean public commit, records an
  immutable Artifact Registry digest, deploys a checked-in Cloud Run configuration, and preserves a
  verified prior revision for rollback. GitHub Actions, mutable-tag promotion, and long-lived
  service-account keys are excluded.
- Extend the operator interface with the accepted authentication states and the seven deferred
  accessibility refinements. Deployed demonstrations use recorded enrichment only and keep all
  synthetic/recorded labels visible.
- Produce a sanitized deployment evidence bundle, operations/rollback/teardown runbook, current
  README and architecture views, and a roughly two-minute captioned walkthrough preview. The MP4 is
  not published without a separate owner decision.
- Keep every cloud resource action gated. This proposal authorizes planning and the draft PR only;
  it does not enable APIs, create resources, build, deploy, merge, or publish the walkthrough video.

## Non-goals

- Production availability, load, SLA, multi-user, tenant, or public-access claims.
- Firebase Auth/Identity Platform, Cloud Tasks, Firebase Hosting, a load balancer, custom domain,
  Secret Manager without a real secret, or GitHub Actions.
- Live enrichment calls from Cloud Run, a model/provider, paid AI usage, real personal data, or any
  external communication.
- Changes to `rubric-v1`, metric denominators, enrichment claim semantics, consent, human approval,
  deterministic provider-null behavior, or the no-send boundary.
- Intake-parity claims or adoption of Military.com's underwriting- and pricing-oriented fields.
- A constitution amendment. The owner resolved the Phase 3 architecture and deployment planning
  choices; unresolved cloud actions remain subject to the existing PROJECT.md gates.

## Capabilities

### New Capabilities

- `private-cloud-access`: Direct Cloud Run IAP, signed-assertion validation, private subject
  allowlisting, trusted operator identity, backend-only Firestore access, and explicit authenticated,
  denied, expired, and session-failure behavior.
- `hosted-deployment`: Container packaging, cloud/local configuration separation, Toronto Firestore,
  immutable build and deploy records, bounded Cloud Run settings, cost controls, retention, rollback,
  purge, and teardown.
- `deployment-evidence`: The deployed smoke/security/cost/observability evidence index, operating
  cadence, README and architecture updates, and the synthetic-data walkthrough.

### Modified Capabilities

- `durable-lead-workflow`: Cloud execution becomes request-bound and idempotent after the durable
  intake commit; polling, resume, revision conflicts, and recovery remain stored and observable.
- `operations-dashboard`: Add authentication/session states and the deferred keyboard, focus,
  disclosure, filter, card-name, and announcement refinements without a redesign.
- `offline-evaluation`: Extend the fixed corpus for cloud configuration, authentication assertions,
  request-bound execution, privacy-safe logs, immutable deployment identity, and rollback evidence.
- `quality-gate`: Add deterministic container/configuration/governance checks and separately named,
  owner-authorized deployed probes without putting credentials or network access in `pnpm check`.
- `architecture-evidence`: Replace the local-only deployment view with explicit local and private
  cloud trust, identity, data, build, rollback, and teardown boundaries.

## Impact

- **Applications:** `apps/api` gains local/cloud startup modes, IAP authorization, static web serving,
  and the request-bound execution route; `apps/web` gains session states and accessibility polish.
- **Packages:** runtime repositories support real Firestore through ADC and TTL metadata; evaluation
  cases cover the new access, configuration, execution, release, and recovery boundaries.
- **Infrastructure:** one private Cloud Run service, one Artifact Registry repository, one Firestore
  Standard database, direct IAP, Cloud Build, IAM/service-usage controls, default platform logs and
  metrics, the existing Cloud Run spend cap, and a project-wide alert budget. Creation remains gated.
- **Dependencies:** `google-auth-library` becomes an exact-pinned direct dependency for IAP
  assertion verification (already in the lockfile through `firebase-admin`, but pnpm forbids
  undeclared imports). Any other new direct dependency must be exact-pinned, justified, and recorded
  before installation.
- **Public artifacts:** PROJECT, AI_OPS, HANDOFF, README, architecture diagrams, deployment templates,
  sanitized evidence, and walkthrough text/stills. Private project, identity, audience, IAM, billing,
  token, cookie, and service-URL values never enter public artifacts.
