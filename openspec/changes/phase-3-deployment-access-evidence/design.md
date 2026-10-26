## Context

Phase 2 is complete on `main`: the browser talks only to Fastify, intake is committed before the
seven-node LangGraph workflow starts, Firestore Emulator state and checkpoints are durable, live
local enrichment is bounded, drafts are consent-gated and human-reviewed, verification and metrics
are deterministic, and the operator views are responsive. The application remains local-only:
Fastify binds to loopback, startup requires the emulator project/host, Vite serves the web build,
the browser has no authentication client, and an in-process executor continues after the intake
response.

Peter resolved the Phase 3 design on 2026-10-26. The target is a private single-owner hosted proof
of concept, not a production service. Direct Cloud Run IAP replaces the earlier Firebase Auth plan
because Google's normal Firebase end-user flow requires a publicly invokable service, conflicting
with the accepted ban on `allUsers` and `allAuthenticatedUsers`. All hosted data remains fictional,
deployed enrichment uses recorded fixtures, and no model or sending capability is introduced.

The intended cloud boundary is one scale-to-zero Cloud Run service, Firestore Standard in Toronto,
direct IAP, Artifact Registry, and a manual Cloud Shell/Cloud Build release. The exact project,
identity, subject allowlist, audience, support contact, URL, IAM membership and billing identifiers
are private deployment parameters. Planning and a public draft PR are authorized; resource changes
remain gated until an enumerated owner approval after proposal review.

## Goals / Non-Goals

**Goals:**

- Package and run the existing system as one private Cloud Run service without weakening the local
  emulator path or the offline gate.
- Authenticate the sole operator through direct IAP and authorize a private stable subject at every
  application/API boundary.
- Replace unsafe post-response cloud work with bounded request-held execution while retaining
  persist-before-processing, polling, idempotency, resume and visible failure.
- Use one regional Firestore database through a least-privilege runtime identity with seven-day TTL
  and explicit purge; browser clients never access Firestore.
- Build once from an exact public commit, deploy the immutable digest, capture complete evidence,
  and exercise rollback and teardown within the accepted cost boundary.
- Produce a public, newcomer-readable README, updated architecture views, sanitized evidence index,
  and private-preview-first walkthrough.

**Non-Goals:**

- Public access, multiple users/tenants, production reliance, SLA/load claims, or unattended 24x7
  operation.
- Firebase Auth/Identity Platform, Cloud Tasks, Hosting, load balancing, custom domains, GitHub
  Actions, a second runtime service, backup/PITR, or a secret with no consumer.
- Cloud-originated live enrichment, provider/model calls, real data, insurer behavior, automatic
  outreach, or intake parity.
- Rubric, priority, metrics, evidence, consent, approval or no-send methodology changes.

## Decisions

### 1. Lifecycle and capability posture

The deployed target is a remotely accessible **pilot-grade proof of concept** for one named owner.
Remote access, persistent state and cloud spend activate B01-B08 where applicable, but no production
availability or business-reliance claim is made. Peter is the operator. Before each deployment and
demo he verifies identity, billing, configuration and the candidate; monthly review applies only
while the service remains hosted.

Alternative rejected: calling the system production-like would require a distinct operating model,
representative load and recovery objectives, ongoing incident response, and real-data controls.

### 2. One service, same-origin web and API

One Node container SHALL serve the built React assets and `/v1` API through Fastify. Local mode keeps
Vite and the emulator workflow. Cloud mode listens on `0.0.0.0:$PORT`, uses ADC and the selected
Firestore database, disables reset/development fixture routes, requires recorded enrichment, and
fails closed when IAP, project, database, retention or bundle configuration is missing.

The single origin avoids CORS and a second public/static service. The Cloud Run service is named
`leadflow-ai-demo`; Artifact Registry uses repository `leadflow-ai-demo` and image `app`; the runtime
service account is `leadflow-ai-runtime`; the IAP display name is `LeadFlow AI Demo`. Scripts accept
private values as parameters rather than committing them. No custom domain is added.

Alternative rejected: split web/API services introduce a second deployable boundary and CORS without
serving the one-operator demonstration better.

### 3. Direct IAP and application authorization

Cloud Run SHALL require authentication through direct IAP and SHALL have no public invoker binding.
IAP's service agent is the only web invocation path. Fastify validates the signed
`x-goog-iap-jwt-assertion` signature, issuer, audience, expiry and stable `sub` on every application
and API route, then checks that subject against a private exact allowlist. Email/display headers are
not authorization. Local mode keeps its loopback Host/Origin boundary and labelled local operator.

The authenticated subject becomes the trusted review principal without storing the owner's email in
public artifacts. Missing, forged, expired, wrong-issuer, wrong-audience and non-allowlisted claims
fail before state access. No browser Firebase SDK is introduced. OAuth support/contact metadata is
configured privately and may be visible only on Google's sign-in surface.

Alternatives rejected: public Cloud Run plus Firebase tokens contradicts the access gate; IAP plus
Firebase duplicates session systems; raw IAM browser access has unsuitable UX.

### 4. Request-bound cloud execution

The existing intake transaction remains unchanged in authority: it atomically writes idempotency,
lead, run and `lead.persisted`, then returns `202`. In cloud mode it does not start post-response work.
After receiving the stored identity, the browser sends an authenticated, idempotent execution request
with the expected revision. That request remains active while the workflow reaches a terminal or
explicit recoverable state; the browser polls stored detail concurrently every three seconds.

The route uses the existing transactional claim, lease, checkpoints, compared writes and resume
semantics. Duplicate/stale execution requests cannot repeat completed effects. A client disconnect or
deadline leaves stored state eligible for the existing revision-checked resume path. Local mode may
keep the current background executor so the credential-free development experience does not regress.

Initial Cloud Run limits are request-based billing, one vCPU, 512 MiB, minimum zero, maximum one,
concurrency eight and a 60-second request timeout. The workflow uses an approximately 45-second
deadline so it can persist a recoverable state and respond. If measured recorded-fixture execution
cannot fit, the design is reopened; limits are not silently widened.

Alternatives rejected: post-response request-based work is unreliable; an always-on minimum instance
adds steady cost and still needs recovery; Cloud Tasks plus a worker is preferable for a later
production topology but exceeds this phase's minimal service boundary.

### 5. Firestore, retention and data recovery

The first/default Firestore database SHALL be Standard edition, Native mode, regional
`northamerica-northeast2`. This location is immutable and matches Cloud Run. Only the runtime service
account receives the minimum practical data role; client rules remain deny-all. ADC supplies runtime
credentials, so no JSON key or `GOOGLE_APPLICATION_CREDENTIALS` exists.

Every retained lead/run/event/checkpoint/evidence/draft/review/result document and subcollection
document gains an `expiresAt` compatible with a seven-day collection-group TTL. Because TTL is
eventual and billed, the phase also provides an explicit, enumerated recursive purge that operates
only on the configured project/database after owner confirmation. No backup or PITR is enabled; data
is synthetic and seedable, and purge is intentionally unrecoverable.

### 6. Build and release identity

The public repository remains the source. From Cloud Shell, a source-less Cloud Build invocation
uses a checked-in build definition that clones the exact clean commit, verifies the SHA, builds the
container, pushes it to Artifact Registry and reports its digest. Build logs use Cloud Logging only,
avoiding an application source staging bucket. If a deterministic no-source build is not feasible,
the process stops before adding Cloud Storage.

The human deployer, build identity and runtime identity are distinct. The runtime cannot deploy or
write images; no service-account key is created. The checked-in service template references an image
digest and the bounded settings, while private project/audience/subject/contact values are supplied
at apply time. The same digest tested is the digest deployed. A previous compatible revision is kept
until rollback passes.

Alternatives rejected: console-only deployment is not reproducible; local tooling is unverified;
GitHub Actions/WIF and Terraform add settings/state beyond a single bounded demo service.

### 7. Service and cost boundary

The proposed minimum API set is Cloud Run, Artifact Registry, Firestore, IAP, Cloud Build, IAM and
Service Usage. Logging and Monitoring are verified and enabled only if absent; Billing Budgets is
used through the console unless later automation is approved. Firebase Auth/Identity Platform,
Cloud Tasks, Firebase Hosting, a load balancer, Secret Manager and Cloud Storage are excluded.

The existing CA$10 Cloud Run spend cap remains. A project-wide CA$10 alert budget adds actual-spend
alerts at 50%, 80% and 100% plus a 100% forecast alert, routed privately to the owner. At 50% the
owner inspects attribution before another build/demo; at 80% new builds/demos stop; at 100% or an
unexpected charge deployment activity stops and teardown begins. Reporting delay and uncapped
non-Cloud-Run services stay explicit. No API/resource is enabled until a later enumerated approval.

### 8. Evidence, evaluation and observability

`system-bundle-v3` extends the complete identity with container digest, cloud configuration version,
IAP policy version, Firestore location/retention policy, deployment revision and evidence index.
`phase-3.0` retains every earlier case ID and adds fixed deterministic cases for cloud configuration,
signed assertion validation, allowlist denial, request-bound execution, log privacy, TTL/purge guards,
immutable image identity and rollback records. Cloud and rendered cases stay `not_run` in the offline
evaluator and name their separately authorized probe.

Deployment evidence records exact source, build, image, revision, region, limits, runtime identity,
sanitized IAP/IAM posture, Firestore access, persist-before-202, progress polling, duplicate/recovery/
conflict behavior, fixture labeling, no-send, logs, cost status and rollback. Delayed billing remains
pending/null with a reason, never zero. Platform logs carry opaque run/status/duration/safe-error
metadata only; contact values, auth assertions, subjects, cookies and raw IAM lists are prohibited.

### 9. Interface and public artifacts

The existing art direction remains. The phase adds signing-in/loading, signed-in, access-denied,
session-expired and retry states; success focus/next-pending flow; `aria-pressed` filters; run-card
accessible names; quieter polling announcements; chart focus inside its explanatory frame;
disclosure markers; and documented keyboard shortcuts. Desktop and 390 px remain required.

The README and diagrams distinguish local and private-cloud boundaries and do not claim production,
live-cloud enrichment or intake parity. `docs/walkthrough.md` scripts a roughly two-minute captioned
video with fictional recorded-mode data. The owner receives the preview before any MP4 publication;
public text, stills and evidence are scanned and sanitized first.

### 10. Rollback and teardown

Rollback sends 100% traffic to the previously verified immutable revision, then reruns auth,
persistence and fixture smoke; traffic movement alone is not a passing rollback. State compatibility
is checked before routing, and incompatible synthetic state is explicitly purged/reseeded rather
than misread.

After the owner approves evidence and the walkthrough, the private service remains available for at
most seven days. By day seven, the verified service is deleted, synthetic documents are purged,
service-specific IAP/IAM bindings are removed, runtime data access is revoked, and non-final images
are deleted. The final image digest remains until day 30, then it and the empty repository are
deleted unless the owner extends retention. The empty Toronto Firestore database and sanitized repo
evidence remain. After day 30, reconstruction requires a rebuild and bit-for-bit availability is not
claimed.

## Non-negotiables check

| PROJECT rule or gate | Design treatment |
|---|---|
| Secrets | ADC and IAP-managed credentials; no service-account key or placeholder secret; private values stay deployment parameters. |
| Honest results | Offline, local, recorded, deployed and pending cost evidence remain distinct; failed runs and delayed billing are retained. |
| Operator gates | Proposal/PR only now; API enablement, resource creation, build, deployment, merge and MP4 publication remain later actions. |
| Marketing readiness only | `rubric-v1`, priorities and language rules are unchanged. |
| Fictional identities | Hosted data, evidence, screenshots and video use reserved test contacts only; operator identity is excluded from public artifacts. |
| Persist before agents | Intake transaction precedes the separately authenticated execution request. |
| Consent/approval/no send | Existing draft/review contracts and no-send governance remain required in the deployed artifact. |
| Backend keys/minimum model data | No model exists; Firestore and identity enforcement are backend-only. |
| Deterministic rubric | Deployment cannot alter scoring weights or thresholds. |
| Military.com claims | Phase 3 makes no parity claim and adds none of the underwriting-oriented fields. |
| Dashboard metrics | Stored-data definitions and evidence-class labels are unchanged. |
| Accessible UI | New auth states and deferred refinements retain keyboard, focus, semantic, reduced-motion and 390 px requirements. |
| Paid API/AI gate | No model/provider or paid design tool is added. |
| Deployment gate | Project/region/access/cost design is owner-decided; actual cloud mutations wait for an enumerated approval and required checks. |
| Real-data gate | Unresolved; only fictional/test data is permitted. |
| External communication gate | Unresolved; drafts only, never sent. |
| Publication gate | Repository publication is already resolved; every new push reruns scans. Video publication remains separate. |
| Intake-parity gate | Unresolved and outside Phase 3. |

## Risks / Trade-offs

- **Request disconnect interrupts useful work** -> durable leases/checkpoints, safe deadline and explicit
  resume preserve the failed state; no success is inferred.
- **Concurrency eight on one small instance can contend** -> one workflow claim at a time, max instance
  one, recorded-mode timing evidence, and restart-safe writes; reopen limits if measurements fail.
- **IAP configuration differs from tested assertions** -> validate actual issuer/audience/headers and
  owner access before storing application data; fail closed on drift.
- **TTL is delayed and billable** -> bounded seven-day fields, usage evidence and an explicit purge.
- **Budget controls do not cap every service instantly** -> project alerts, service limits, staged stop
  rules, one build path and teardown; never call the CA$10 target an absolute whole-project ceiling.
- **Cloud Build clone or logging requires an unplanned service** -> stop and return to the owner rather
  than enabling Cloud Storage or another service implicitly.
- **Rollback code cannot undo state** -> validate schema compatibility; synthetic state may be purged
  and reseeded with the loss recorded.
- **Public evidence leaks account identity** -> parameterized templates, candidate-file scans and manual
  evidence review exclude project, principal, subject, URL, token and billing values.

## Migration Plan

1. Implement and verify cloud/local configuration, container packaging, IAP enforcement,
   request-bound execution, Firestore TTL/purge, UI states and offline cases locally.
2. Run `pnpm check`, container/configuration checks, code/security/lead-quality/design reviews, scans,
   and strict OpenSpec validation on the exact candidate.
3. Ask the owner for one enumerated cloud-action approval naming APIs/resources, cost controls and
   private parameters. Recheck billing/IAM/project state before acting.
4. Enable only the approved services, configure the budget/cap/IAP/identities/database, build the
   exact clean commit once, and deploy its immutable digest with zero traffic until configuration
   checks pass where the platform permits.
5. Run the declared deployed auth, persistence, execution, privacy, cost, observability and rollback
   evidence. Preserve every failure and fix through new commits/builds rather than relabelling it.
6. Produce the sanitized evidence index, README/diagrams and walkthrough preview. Archive and mark the
   PR ready only after all tasks and review findings pass. Merge still requires owner approval.
7. After evidence/walkthrough approval, follow the seven-day and 30-day teardown schedule against
   reverified exact resource names.

## Open Questions

None in the design. Before cloud mutation, current account state and service availability are facts
to recheck, and the owner must separately authorize the exact enumerated actions. If an accepted
assumption fails, the dependent action stops and the design is updated rather than widened silently.
