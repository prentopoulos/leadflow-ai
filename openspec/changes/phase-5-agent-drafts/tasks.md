## 1. Agent contracts and verification

- [x] 1.1 Add the domain contracts: `AgentLeadProjection`, `agent-brief-v1`, the claim verifier, the `agent-rules-v1` checker, cost arithmetic, the `agentParagraph` slot with `agent_brief` provenance, `verification-rules-v2`, `system-bundle-v5`, and frozen `phase-5.0` evaluation cases; prove them with unit tests.

## 2. Agent team runtime

- [x] 2.1 Add the model port, the Anthropic adapter, the spend ledger, the research team and draft loop, the `agentBriefs` repository and the `compose_draft` wiring with fallback, plus the `--agents=claude` switch for `api:local` and `demo` and the hosted refusal; prove the flow, fallbacks, budget stop and privacy with a fake model port.

## 3. Dossier sources

- [x] 3.1 Return the brief with the draft view and show the agent status, cost, cited sources and fallback reason in the dossier draft panel at desktop and 390 px.

## 4. Documentation

- [x] 4.1 Update AI_OPS.md, `docs/dependencies/phase-5.md`, the C4 model and diagrams, the README and HANDOFF.

## 5. Verify and close

- [ ] 5.1 Run the full gate, one owner-authorized live probe within the caps, a code review, then archive, sync specs, set Phase 5 Done and prepare the merge.
