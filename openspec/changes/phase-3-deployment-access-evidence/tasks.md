## 1. Package the bounded local and cloud runtime

- [ ] 1.1 Add one production container and strict local/cloud configuration that serves the built web app and API from Fastify, preserves the emulator path, requires recorded enrichment in cloud mode, listens on the platform port only in cloud mode, and passes deterministic container/configuration checks without credentials or network access.

## 2. Enforce private identity and durable hosted state

- [ ] 2.1 Implement direct-IAP assertion verification and stable-subject allowlisting on every hosted application/API route, backend-only Toronto Firestore access through ADC, deny-all client rules, seven-day TTL metadata, and a project/database-guarded recursive purge; prove all fail-closed identity, state-access, and retention cases locally.

## 3. Make hosted execution request-bound and operable

- [ ] 3.1 Add the idempotent, revision-checked cloud execution request with an approximately 45-second workflow deadline, durable interruption/recovery behavior, concurrent stored-state polling, and the accepted authentication/session plus deferred accessibility states, while retaining the local background executor and existing scoring, consent, evidence, metrics, and no-send contracts.

## 4. Define the reproducible release and evidence system

- [ ] 4.1 Add checked-in Cloud Build and digest-pinned Cloud Run templates, least-privilege identity/configuration guidance, budget stop rules, rollback/purge/teardown runbooks, `system-bundle-v3` and `phase-3.0` evaluation coverage, sanitized evidence schemas, updated AI operations/architecture/README material, and the captioned `docs/walkthrough.md` script without embedding private deployment values.

## 5. Verify the exact local candidate

- [ ] 5.1 On one clean implementation commit, pass affected tests, the credential-free offline `pnpm check`, container/configuration checks, strict OpenSpec validation, rendered desktop/390 px accessibility review, dependency evidence, consolidated code/security/lead-quality/design review, and secret/private-data/generated-asset/history scans; fix findings through new commits and record the exact source and lockfile identities.

## 6. Run the separately authorized hosted proof and close the phase

- [ ] 6.1 Only after an enumerated owner approval, reverify the private project/billing/IAM boundary; enable only the accepted services; create the budget, identities, Toronto database, Artifact Registry repository and private IAP-protected Cloud Run service; build the exact public commit once; deploy its immutable digest; capture all required access, persistence, execution, privacy, cost, observability and verified-rollback evidence; provide the private walkthrough preview; execute the accepted seven-day/30-day teardown schedule; rerun publication scans; update HANDOFF; and prepare archive/merge while leaving merge and MP4 publication for separate owner decisions.
