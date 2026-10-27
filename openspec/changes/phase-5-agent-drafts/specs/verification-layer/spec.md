## ADDED Requirements

### Requirement: Agent paragraph verification
`verification-rules-v2` SHALL verify an `agent_brief` slot against its stored brief:
`draft.slots_grounded` SHALL recompose the template with the stored paragraph, and
`evidence.claim_bounded` SHALL re-run the claim verifier and the agent rule checker on the stored
brief. `draft.no_request_text` and `draft.no_decision_language` SHALL cover the whole text.

#### Scenario: Paragraph tampered after storage
- **WHEN** the stored draft's agent slot differs from the brief's paragraph
- **THEN** `draft.slots_grounded` fails and the draft is `verification_blocked`

#### Scenario: Quote tampered after storage
- **WHEN** a cited claim's stored quote no longer contains the claim's numbers
- **THEN** `evidence.claim_bounded` fails with the slot key
