## 1. Record the posted Phase 3 cost

- [ ] 1.1 Read the billing reports and both project budgets at least 24 hours after the last hosted activity (after about 22:45 Toronto on 2026-10-27) and record `deployed-cost-status` in `docs/evidence/phase-3/index.json` with the observed amounts and time, including the 09:45 2026-10-27 interim reading of CA$0.00; record pending with a reason if billing still has not posted, never zero by default, and note whether spend is below the 50% inspection point.

## 2. Attribution contract

- [x] 2.1 Add `intake-v3`/`lead-v3` with the strict optional attribution object and synthetic click-ID rule, `channel-rules-v1`, server-side channel derivation, provenance labels, `intake-v2` rejection, the form's `attribution: null`, the new system bundle, and the attribution isolation from rubric, drafts, verification, events and logs; freeze the `phase-4.0` cases before implementation and prove them with affected unit tests and the emulator probe.

## 3. Traffic plan and simulator

- [x] 3.1 Add the pure seeded `traffic-plan-v1`, replace `pnpm seed:local` with `pnpm simulate:traffic` (recorded-only guard, paced interval, count cap, per-bundle idempotency keys, created/replayed counts), and add the hosted-only "Run simulated traffic" browser control with Stop and hidden-tab pause; prove determinism, idempotent rerun and content-independent attribution.

## 4. Spend fixture and acquisition metrics

- [x] 4.1 Add `synthetic-spend-v1` with its integrity check and `metrics-definitions-v2`/`metrics-report-v2` with blended, per-channel and per-campaign CPL and CPQL, `no_spend`, `insufficient_data`, planned/stored counts and the synthetic evidence class; prove the known-answer arithmetic cases.

## 5. Acquisition section and dossier block

- [x] 5.1 Build the "Acquisition — SIMULATED" metrics section (tiles, per-channel table, CPL bar chart, campaign disclosure, definitions and notes) and the dossier attribution block at WCAG 2.2 AA for desktop and 390 px, verified in the running local app after a reset and a simulated flight.

## 6. Documentation and diagrams

- [x] 6.1 Update the Structurizr model and ERD (`pnpm docs:diagrams`), AI_OPS, the runbook (simulation step, Phase 4 redeploy, purge-after-rollback note), the README "Simulated acquisition" subsection and `docs/walkthrough.md` with the acquisition scenes and intake-first opening.

## 7. Verify the exact local candidate

- [ ] 7.1 On one clean commit, pass the full `pnpm check`, strict OpenSpec validation, rendered desktop/390 px review, design-eval, code review with the lead-quality review of the new metrics, and the publication scans; fix findings in new commits and record the candidate identity.

## 8. Hosted demonstration and walkthrough

- [ ] 8.1 Only if task 1 shows spend below the 50% inspection point and after one enumerated owner approval: purge hosted synthetic data, build the exact candidate once, deploy its digest to the existing private service, rerun smokes 5–6 and the rollback section, run the hosted simulated traffic, record `docs/evidence/phase-4/index.json` with pre- and post-demo cost including Firestore reads, and record the private walkthrough preview; otherwise fall back to a local demonstration and recording.

## 9. Close the phase

- [ ] 9.1 Record the owner's evidence approval date as the start of the seven-day teardown clock, update HANDOFF, archive the change, sync specs, set Phase 4 Done, rerun validation and the gate, push and mark the PR ready; merge only on the owner's go-ahead.
