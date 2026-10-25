## 1. Dependencies and local toolchain

- [x] 1.1 Verify current official LangGraph.js, Firebase Admin/CLI, Firestore Emulator, Java 21, and Structurizr compatibility; record the selected exact versions, licences, alternatives, and emulator/production limitations before installing.
- [x] 1.2 Add the private `@leadflow-ai/runtime` workspace with strict ESM/TypeScript references and the permitted dependency direction, then update exact manifests and the frozen pnpm lockfile without adding a provider SDK.
- [x] 1.3 Pin and activate project-local Java 21 plus cached Firebase/Structurizr tooling through the existing Windows-friendly toolchain scripts without changing Node 24.22.1 or pnpm 12.15.0.
- [x] 1.4 Add validated loopback-only Firestore Emulator configuration, the exact synthetic project ID, isolated start/exec/import/export commands, gitignored `.local` state, and safe example configuration.
- [x] 1.5 Update development/bootstrap documentation and verify a frozen offline reuse path for dependencies, Java, the emulator, and diagram checks after the authorized setup downloads.

## 2. Domain contracts, rubric, and versions

- [x] 2.1 Add independently versioned schemas for intake, reserved-example-domain contact data, lead, run, event, checkpoint metadata, pending writes, idempotency, qualification interpretation/result, simulation, API responses, and safe errors with unknown-property rejection and boundary tests.
- [x] 2.2 Implement `rubric-v1` as pure domain code with the exact timeline, clarity, completeness, evidence, arithmetic, consent-independence, priority-threshold, missing-information, and integrity-hold rules plus exhaustive boundary tests.
- [x] 2.3 Define allowed lifecycle transitions, run revisions/leases, event names/sequences, retry/resume eligibility, and terminal-state helpers with positive and invalid-transition tests.
- [x] 2.4 Extend the system bundle to identify schema, rubric, interpreter, graph, checkpointer, simulator, evaluator, configuration, code/patch, lockfile, runtime/tool, and environment versions while preserving null-with-reason provider/model/prompt/live-tool fields.
- [x] 2.5 Implement the pure `simulator-v1` seed/outcome/metric contracts and tests for repeatability, score independence, provenance, empty denominators, and no outbound capability.

## 3. Firestore repositories and checkpoints

- [x] 3.1 Build the emulator-only Admin SDK boundary and repositories for leads, runs, events, idempotency, bundles, qualification results, and simulation records with schema validation on every read/write.
- [x] 3.2 Implement the atomic intake transaction that creates idempotency, lead, run, and first `lead.persisted` event before returning, including same-request replay and conflicting-key tests.
- [x] 3.3 Implement transactionally revised append-only events and execution lease/claim/reclaim behavior with monotonic sequence, duplicate, stale revision, concurrent claim, and expired-lease tests.
- [x] 3.4 Implement the project-owned Firestore `BaseCheckpointSaver` for `put`, `putWrites`, `getTuple`, and `list`, including namespace/parent/bundle/schema identity, pending-write idempotency, ordering, and pinned-interface contract tests.
- [x] 3.5 Add isolated emulator fixture setup/verified flush, ephemeral default behavior, explicit gitignored retain flow, and guarded local reset with direct denial and confirmed-deletion tests.

## 4. Qualification workflow and recovery

- [x] 4.1 Implement the `QualificationInterpreter` interface and deterministic `qualification-interpretation-v1` stub using the minimum intake projection, structured field evidence, and no model/prompt/tool call.
- [x] 4.2 Compile the fixed LangGraph workflow for interpretation, deterministic score, synthetic simulation, and finalization with versioned minimal state and durable events/checkpoints.
- [x] 4.3 Add the single typed transient retry path and verify first-failure retry, second-failure exhaustion, non-retryable failure, attempt history, and absence of a silent third attempt.
- [x] 4.4 Implement revision-checked explicit resume from persisted/retryable compatible state and verify complete/running/terminal/stale/missing/incompatible/active-lease rejection paths.
- [x] 4.5 Exercise crash-before-commit, after-commit-before-claim, during checkpoint/event/result writes, and restart reconstruction so partial work remains honest and duplicate logical effects do not occur.

## 5. Fastify API boundaries

- [x] 5.1 Add validated Phase 1 configuration/startup readiness that cannot fall through to cloud Firestore and keeps `GET /health` narrower than emulator/workflow readiness.
- [x] 5.2 Implement schema-validated `POST /v1/intake` with required idempotency key, source/demo provenance, test-contact enforcement, committed-response semantics, and safe conflict/error responses.
- [x] 5.3 Implement `GET /v1/runs/:runId` from stored lead/run/events/qualification/simulation records with bounded payloads, privacy separation, stale/unavailable representation, and no fabricated progress.
- [x] 5.4 Implement `POST /v1/runs/:runId/resume` with expected revision, eligibility/lease checks, idempotent response, and safe race/error contracts.
- [x] 5.5 Implement the optional loopback-only `DELETE /v1/local-data` boundary with exact project/phrase/feature guards and no production-capable generic delete function.
- [x] 5.6 Add API contract and built loopback smoke tests for health, intake persistence, run completion/failure, resume, reset denial, timeouts, and process cleanup.

## 6. Operator intake and run detail

- [x] 6.1 Build the responsive calm operations-dossier shell and semantic intake, keeping the persistent synthetic label, honest ZIP/demo-field grouping, test-contact guidance, explicit consent, accessible validation, and no Military.com visual imitation.
- [ ] 6.2 Connect intake submission to the persisted response with stable idempotency, safe input/error handling, stored run identity, and deliberate focus movement.
- [ ] 6.3 Render stored polling, lifecycle progress, qualification evidence, failures, eligible resume, and separately labeled non-predictive simulation without fabricated progress or focus theft.
- [ ] 6.4 Cover the essential loading, validation, persistence, progress, failure/resume, complete, stale, and long-content paths with deterministic tests, then inspect and fix the running flow at desktop and 390px for keyboard, focus, semantics, and reduced motion.

## 7. Evaluation, telemetry, and AI operations

- [ ] 7.1 Add one focused, fixed Phase 1 fixture/evaluator suite covering the accepted intake, persistence, rubric, workflow recovery, simulator, privacy, reset, and UI contracts while retaining Phase 0 cases and honest `not_run` boundaries.
- [ ] 7.2 Add privacy-aware lifecycle reporting and update `AI_OPS.md` with bundle-bound evidence, recovery behavior, deferred provider/tool boundaries, prototype limits, and recheck triggers.

## 8. Architecture and source evidence

- [ ] 8.1 Create the canonical Structurizr context, container, persist-before-processing/recovery, and ERD views plus the compact README Mermaid summary, using stable identifiers and matching the implemented runtime, storage, trust, and deferred-system boundaries.
- [ ] 8.2 Validate and export the architecture views, inspect the rendered results, verify local links and collection/component names, and retain the dated Military.com source with ZIP as the only exact field claim and parity unresolved.

## 9. Completion

- [ ] 9.1 Integrate the remaining checks into the offline gate; run affected leaf checks and one clean final gate, strict OpenSpec validation, offline reuse, and the separately authorized dependency audit; perform one consolidated branch review across code, lead quality, security/state, UI, and architecture; fix findings; then update PROJECT/AI_OPS/HANDOFF and prepare the verified change for archive and owner merge approval.
