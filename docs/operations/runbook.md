# Hosted proof-of-concept runbook

Operator: Peter, the sole owner. Scope: one private Cloud Run service in `northamerica-northeast2`
for fictional, recorded-mode demonstrations (PROJECT.md Phase 3 decisions). Nothing here is a
production service. Every cloud action below needs the owner's enumerated approval for that phase
step; this file does not grant it.

Private values never enter the repository. They live in the owner's private deployment record and in
`.local/private-values.txt` (one per line, ignored), which `pnpm governance` uses to scan tracked
files. Placeholders in this file: `PROJECT_ID`, `PROJECT_NUMBER`, `OWNER_EMAIL`, `OWNER_SUBJECT`
(the IAP `sub`, `accounts.google.com:` plus digits), `COMMIT_SHA`, `IMAGE_DIGEST`.

## Fixed names and limits

| Item | Value |
|---|---|
| Cloud Run service | `leadflow-ai-demo`, region `northamerica-northeast2` |
| Artifact Registry | repository `leadflow-ai-demo`, image `app`, Docker format, same region |
| Runtime identity | `leadflow-ai-runtime@PROJECT_ID.iam.gserviceaccount.com` |
| Firestore | `(default)`, Standard edition, Native mode, `northamerica-northeast2`, no backup or PITR |
| Limits | 1 vCPU, 512 MiB, min 0, max 1, concurrency 8, 60 s timeout, request-based billing |
| Workflow budget | 45 s deadline, 75 s execution lease (`HOSTED_TARGET` in `packages/domain/src/phase3.ts`) |
| Access | direct IAP; IAP display name `LeadFlow AI Demo`; no `allUsers` or `allAuthenticatedUsers` |
| Enrichment | recorded fixtures only; no live lookup, model, real data or sending |

## Identities and least privilege

| Identity | Holds | Never holds |
|---|---|---|
| Owner (human deployer) | Project owner during setup; `roles/iap.httpsResourceAccessor` on the service | — |
| Cloud Build default identity | Artifact Registry writer on `leadflow-ai-demo`; Logging writer | Cloud Run admin, Firestore access |
| `leadflow-ai-runtime` | `roles/datastore.user` on the project, conditioned on the `(default)` database where the console allows it | Deploy, image write, IAM admin, key creation |
| IAP service agent `service-PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com` | `roles/run.invoker` on the service only | Anything else |

No service-account key is created at any point. The runtime uses ADC from the metadata server.

## Services

Enable only: `run.googleapis.com`, `artifactregistry.googleapis.com`, `firestore.googleapis.com`,
`iap.googleapis.com`, `cloudbuild.googleapis.com`, `iam.googleapis.com`,
`serviceusage.googleapis.com`. Verify `logging.googleapis.com` and `monitoring.googleapis.com`; enable
them only if absent. Firebase Auth, Identity Platform, Cloud Tasks, Firebase Hosting, load balancing,
Secret Manager and Cloud Storage stay off. If any step asks for one of them, stop.

## Cost controls and stop rules

- The existing Cloud Run spend cap (`LeadFlow AI CA$10 monthly cap`, 50/80/100% notices) stays.
- A project-wide CA$10 alert budget adds actual-spend alerts at 50%, 80% and 100% and a 100% forecast
  alert, routed privately to the owner (console, Billing → Budgets).
- At 50%: inspect cost attribution before another build or demo.
- At 80%: no new builds or demos.
- At 100%, or any unexpected service charge: stop deployment activity and start teardown.
- Billing posts late. Record delayed cost as `pending` with a reason, never as zero, and never call
  the CA$10 target an absolute ceiling for the whole project.

## Pre-deployment check (before any build)

1. `gcloud config list` shows the dedicated project; billing is the owner's account; IAM lists only
   the owner (and, after setup, the identities above). No public principal.
2. Both budgets show `Configured`; current spend recorded.
3. The candidate commit is on the public branch, its `pnpm check` passed, and the evidence index
   names it. Stop if any required local evidence is `fail`, `not_run` or `stale`.

## First-time setup (once, owner)

1. Enable the services above.
2. Create Firestore: `gcloud firestore databases create --database='(default)' --location=northamerica-northeast2 --type=firestore-native --edition=standard`.
   Stop for review if the console offers any other edition, mode, ID or location; the location is
   immutable.
3. `firebase deploy --only firestore:rules --project PROJECT_ID` is **not** used (no Firebase CLI
   login in Cloud Shell). Publish `firebase/firestore.rules` (deny all) from the Firestore console's
   Rules tab and confirm it reads `allow read, write: if false`.
4. Create the TTL policies: after `pnpm install --frozen-lockfile && pnpm build` in a Cloud Shell
   clone, `node deploy/firestore-ttl.mjs` prints one TTL and one index-exemption command per
   collection group; run them and confirm each with `gcloud firestore fields ttls list`.
5. Create the Artifact Registry repository:
   `gcloud artifacts repositories create leadflow-ai-demo --repository-format=docker --location=northamerica-northeast2`.
6. Create the runtime identity and grant `roles/datastore.user`; grant Cloud Build's identity
   `roles/artifactregistry.writer` on the repository.
7. IAP in a project without an organization cannot create its OAuth client from the command line.
   Enable IAP once from the Cloud Run console on the first deployed service (Security tab →
   Identity-Aware Proxy), set the support contact privately, then use the scripted path for every
   later release.

## Build

From Cloud Shell, in a clone of the public repository at the candidate commit:

```sh
gcloud builds submit --no-source --region=northamerica-northeast2 \
  --config=deploy/cloudbuild.yaml --substitutions=_COMMIT_SHA=COMMIT_SHA
```

Record the build ID and the pushed digest (`gcloud builds describe BUILD_ID --region=... --format='value(results.images[0].digest)'`).
Then confirm `gcloud storage buckets list` is still empty. If the build failed for lack of a bucket
or created one, stop: Cloud Storage is not approved.

## Deploy

```sh
LEADFLOW_PROJECT_ID=... LEADFLOW_PROJECT_NUMBER=... LEADFLOW_IMAGE_DIGEST=IMAGE_DIGEST \
LEADFLOW_COMMIT_SHA=COMMIT_SHA LEADFLOW_ALLOWED_SUBJECTS=OWNER_SUBJECT \
[LEADFLOW_PREVIOUS_REVISION=leadflow-ai-demo-...] node deploy/render-service.mjs
gcloud run services replace .local/service.yaml --region=northamerica-northeast2
gcloud run services add-iam-policy-binding leadflow-ai-demo --region=northamerica-northeast2 \
  --member=serviceAccount:service-PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com --role=roles/run.invoker
gcloud iap web add-iam-policy-binding --region=northamerica-northeast2 --resource-type=cloud-run \
  --service=leadflow-ai-demo --member=user:OWNER_EMAIL --role=roles/iap.httpsResourceAccessor
```

The first release takes 100% of traffic. Later candidates deploy at 0% beside the verified previous
revision with the `candidate` tag. Compare `gcloud run services describe` with the template: image
digest, limits, concurrency, timeout, identity, region, `Iap Enabled: true`, and an invoker policy
holding only the IAP service agent. Any difference keeps the release on hold.

The owner's IAP subject comes from the first signed-in request: the application never logs it, so
read it once from the IAP assertion in the browser's developer tools on the owner's own session and
store it only in the private record.

## Smoke and evidence (the authorized deployed probe)

Run each case with fictional recorded-mode leads entered through the authenticated interface, then
record it in `docs/evidence/phase-3/index.json` with sanitized inputs and observed results:

1. Owner signs in; `/v1/session` reports `cloud`, `iap-verified`, `recorded`.
2. A private window without a session is redirected to Google sign-in; `curl` without a session gets
   IAP's denial; a second, non-allowlisted Google account receives the application's `Access
   denied`.
3. A forged or replayed-expired assertion header sent through IAP gets `authentication_required`
   (IAP's documented `secure_token_test` mode exercises the invalid-assertion path).
4. A browser Firestore REST call without credentials is denied by the rules.
5. Intake answers 202 and the run stays `persisted` until the execution request; progress appears
   by polling; a duplicate execution is a conflict; a deliberately interrupted run resumes after its
   lease expires.
6. Every enrichment record is labelled recorded; the draft remains consent-gated and unsent.
7. Logs: request lines carry status, latency and revision only; no contact value, assertion,
   subject, cookie or IAM list (`gcloud logging read` over the demo window).
8. Cost: current Cloud Run and project spend, or `pending` with the reason.

## Rollback

1. Check the previous revision reads the current stored schema; if not, purge and reseed synthetic
   data and record the loss.
2. `gcloud run services update-traffic leadflow-ai-demo --region=northamerica-northeast2 --to-revisions=PREVIOUS=100`.
3. Rerun smoke cases 1, 2, 5 and 6 against it. Moving traffic alone is not a passing rollback.
4. Return traffic to the candidate the same way and rerun case 1.

## Purge (synthetic data, unrecoverable by design)

`purgeHostedData` in `packages/runtime/src/retention.ts` deletes only the application's known
collections and stops if any other collection exists. It requires the configured and requested
project/database to match, the owner's authenticated ADC session, and the exact confirmation
`PURGE SYNTHETIC LEADFLOW HOSTED DATA`. Run it from Cloud Shell only after a final evidence export.
TTL removes documents about seven days after their last create, usually within a further 24 hours.

## Pre-demo, post-demo and monthly

- Pre-demo: run the pre-deployment check, smoke cases 1, 5 and 6, and confirm spend.
- Post-demo: confirm no unexpected runs or errors in logs; record spend or `pending`.
- Monthly, only while hosted: review IAM, IAP access, budgets, spend, image list and TTL policies.

## Access revocation

Remove the owner's IAP binding (`gcloud iap web remove-iam-policy-binding ...`), remove the IAP
service agent invoker binding, then revoke `leadflow-ai-runtime`'s data role. Each removal is checked
with the matching `get-iam-policy`.

## Teardown schedule

After the owner approves the evidence and walkthrough, the service stays up for at most seven days.

- By day 7: export final evidence; purge synthetic data; delete the Cloud Run service; remove its IAP
  and invoker bindings; revoke the runtime data role; delete every image except the final digest.
  The empty Toronto database and the sanitized repository evidence remain.
- Day 30: delete the final image and the empty repository unless the owner extends retention.
- After day 30 the release is reconstructible only by rebuilding the recorded commit; bit-for-bit
  identity with the deleted image is not claimed.

## What makes evidence stale

Any change to code, lockfile, container base, IAP audience or allowlist policy, cloud configuration,
retention policy, runtime identity or Cloud Run revision marks dependent evidence `stale`. Rerun:
smoke 1–3 for identity changes, 4 for rules, 5–6 for code or configuration, 7 for logging, and the
rollback section for any new revision.
