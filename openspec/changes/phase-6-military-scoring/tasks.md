## 1. Constitution and decisions

- [ ] 1.1 Record Peter's D2 weights and D3 gender choice in design.md, then commit the section 5 amendment (2.0.0) with the AGENTS.md and `openspec/config.yaml` copies and the amendment table row as its own `docs:` commit; add Phase 6 to PROJECT.md section 6 and record the 2026-10-27 Military.com evidence under the parity gate

## 2. Domain

- [ ] 2.1 Move to `intake-v4` / `lead-v4`: remove request intent, coverage focus, need timeline and request details; reject `intake-v3`; update fixtures and the traffic plan
- [ ] 2.2 Implement `rubric-v2` (five criteria, evidence per component, bounds 25/25/15/25/10, missing answers, bands) and delete the interpreter contract and stub

## 3. Runtime and agents

- [ ] 3.1 Rewire the workflow to `rubric-v2`, update the system bundle, and move the agent team's inputs to the D4 allow-list with a privacy test over recorded requests
- [ ] 3.2 Update the draft templates and verification rules that referenced need, focus, intent or details

## 4. Evaluation

- [ ] 4.1 Re-baseline the qualification, intake, privacy and traffic eval cases for `rubric-v2` with independently computed expected results, keeping `not_run` where a provider is needed

## 5. Web and docs

- [ ] 5.1 Remove the LeadFlow scoring step from the intake, show `rubric-v2` criteria and missing answers in the dossier, and update the glossary and dashboard labels
- [ ] 5.2 Update README, AI_OPS.md and the diagrams for the new score and agent inputs

## 6. Close

- [ ] 6.1 Clear the local emulator, run `pnpm check`, then Peter runs one live agent probe (`pnpm demo -- --agents`, fictional consented lead, within caps) and the result is recorded in HANDOFF.md
