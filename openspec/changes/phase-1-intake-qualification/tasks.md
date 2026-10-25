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
- [ ] 4.3 Add the single typed transient retry path and verify first-failure retry, second-failure exhaustion, non-retryable failure, attempt history, and absence of a silent third attempt.
- [ ] 4.4 Implement revision-checked explicit resume from persisted/retryable compatible state and verify complete/running/terminal/stale/missing/incompatible/active-lease rejection paths.
- [ ] 4.5 Exercise crash-before-commit, after-commit-before-claim, during checkpoint/event/result writes, and restart reconstruction so partial work remains honest and duplicate logical effects do not occur.

## 5. Fastify API boundaries

- [ ] 5.1 Add validated Phase 1 configuration/startup readiness that cannot fall through to cloud Firestore and keeps `GET /health` narrower than emulator/workflow readiness.
- [ ] 5.2 Implement schema-validated `POST /v1/intake` with required idempotency key, source/demo provenance, test-contact enforcement, committed-response semantics, and safe conflict/error responses.
- [ ] 5.3 Implement `GET /v1/runs/:runId` from stored lead/run/events/qualification/simulation records with bounded payloads, privacy separation, stale/unavailable representation, and no fabricated progress.
- [ ] 5.4 Implement `POST /v1/runs/:runId/resume` with expected revision, eligibility/lease checks, idempotent response, and safe race/error contracts.
- [ ] 5.5 Implement the optional loopback-only `DELETE /v1/local-data` boundary with exact project/phrase/feature guards and no production-capable generic delete function.
- [ ] 5.6 Add API contract and built loopback smoke tests for health, intake persistence, run completion/failure, resume, reset denial, timeouts, and process cleanup.

## 6. Operator intake and run detail

- [ ] 6.1 Replace the Phase 0 shell with the accepted calm operations-dossier tokens and continuous desktop/mobile workspace, preserving the persistent `SIMULATION · Synthetic leads and outcomes` context and avoiding Military.com visual imitation.
- [ ] 6.2 Build the semantic intake with ZIP source evidence, visible LeadFlow demo-field grouping, fictional/test-contact guidance, explicit consent default, client/server validation, linked error summary, and long-error behavior.
- [ ] 6.3 Connect submission to the persisted API response with stable idempotency behavior, useful persistence errors, protected local input, run identity, and deliberate focus movement to the stored run heading.
- [ ] 6.4 Render polling from stored revisions/events with accessible progress, retry history, timestamped stale-state handling, bounded polling, terminal stop, and no elapsed-time simulation or focus theft.
- [ ] 6.5 Render qualification breakdown/evidence/missing information/versions/non-insurance meaning, integrity holds, distinct failure states, eligible resume, race refresh, and separately labeled non-predictive simulation detail.
- [ ] 6.6 Add deterministic component/integration tests for every declared loading, empty, validation, persistence, in-progress, retrying, partial, retryable-failure, terminal-failure, complete, stale, and long-content state.
- [ ] 6.7 Inspect and fix the running product at desktop and 390px for page top/middle/bottom, keyboard/focus, reduced motion, errors, long content, retry/resume, and complete states; record rendered evidence and remaining limits.

## 7. Evaluation, telemetry, and AI operations

- [ ] 7.1 Freeze Phase 1 normal/edge/adversarial/failure fixtures before tuning for intake provenance, idempotency, persist-before-processing, graph order, recovery, rubric/priority, injection, simulation, telemetry privacy, reset, emulator isolation, and UI states.
- [ ] 7.2 Extend the independent evaluator and canaries to compare subcriteria, totals, priority/hold, transitions, retries/resume, simulator reproducibility/independence, privacy, and metric denominators while retaining all Phase 0 cases.
- [ ] 7.3 Implement privacy-aware lifecycle-event validation and reporting with explicit denominators/statuses, null usage reasons, bundle identity, and synthetic/local/emulator/rendered/not-run evidence separation.
- [ ] 7.4 Update `AI_OPS.md` with enabled persistent workflow state, deferred provider/tool boundaries, system/evaluation evidence pointers, recovery behavior, prototype limits, and capability recheck triggers.

## 8. Architecture and source evidence

- [ ] 8.1 Resolve the first-diagram style profile from the accepted product tokens, create the architecture component/flow inventory, and define the split context, container, persist-before-processing, recovery, and ERD views within the diagram complexity budgets.
- [ ] 8.2 Implement and validate `docs/architecture/workspace.dsl` with stable C4 context/container/dynamic identifiers, trust/data boundaries, deferred external systems, and flows that agree with the runtime/storage contracts.
- [ ] 8.3 Author self-contained accessible diagram HTML and checked SVG exports for the publishable architecture/data views, run the diagram self/geometry checks, and inspect the final exports for clipping/overlap/font fallback.
- [ ] 8.4 Add the schema ERD and compact README Mermaid summary, then verify component names, collection paths, local links, and no live/deployed/parity claims across all views.
- [ ] 8.5 Link the dated Military.com source record from the intake/docs, verify ZIP as the only exact field claim, and retain the unanswered downstream-form/parity boundary and recheck trigger.

## 9. Quality gate, review, and handoff

- [ ] 9.1 Extend `pnpm check` with Java/tool preflight, artifact-clean no-emit checks, isolated emulator/LangGraph integration, combined evaluation, diagram/link validation, accessibility-sensitive tests, and built Phase 1 smoke cleanup while keeping it offline and credential-free.
- [ ] 9.2 Run every affected leaf check, the complete offline gate twice, strict OpenSpec validation, frozen offline bootstrap/emulator reuse, and the separate non-mutating connected dependency audit; retain and resolve all failures with exact bundle evidence.
- [ ] 9.3 Perform the required branch-diff code review plus lead-quality, security/state, UI, and architecture review against every requirement/design non-negotiable; fix findings in new commits and rerun affected checks.
- [ ] 9.4 Update PROJECT milestone status only when evidenced, refresh AI_OPS/HANDOFF with revision, checks, limitations, failures, and exact next action, archive/sync the complete OpenSpec change, and rerun validation/gate before requesting owner merge approval.
