# verification-layer Specification

## Purpose
TBD - created by archiving change phase-2-enrichment-outreach-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Deterministic verification rules
The verify step SHALL evaluate the versioned rules `evidence.complete`, `evidence.claim_bounded`,
`draft.slots_grounded`, `draft.no_decision_language`, `draft.no_request_text`,
`draft.consent_present`, `draft.compliance_notice` and `events.private`, and SHALL store a
`verification-result-v1` record giving each rule's outcome `pass`, `fail` or `not_applicable` with a
safe detail code.

#### Scenario: Clean run is verified
- **WHEN** evidence is complete and the draft is grounded, consented and compliant
- **THEN** every applicable rule passes and the draft enters the approval queue

#### Scenario: Draft contains decision language
- **WHEN** a revision contains a deny-listed word such as "quote", "premium", "eligible" or "underwriting" on a word boundary
- **THEN** `draft.no_decision_language` fails and the matched terms are recorded

#### Scenario: Draft echoes request text
- **WHEN** a revision contains a substring of 12 or more characters from the lead's request details
- **THEN** `draft.no_request_text` fails

#### Scenario: Draft states an unverified fact
- **WHEN** a slot claims a location or vehicle listing without matching `found` evidence
- **THEN** `evidence.claim_bounded` and `draft.slots_grounded` fail

### Requirement: Verification failure semantics
An unavailable enrichment source SHALL finish the run with status `complete` and
`evidenceCompleteness` `partial`, with its evidence visible; a draft
failing any draft rule SHALL be stored as `verification_blocked`, kept out of the approval queue and
shown as a hold on a finished run; and a broken stored-state invariant SHALL fail the run
`failed_terminal`.

#### Scenario: One source is unavailable
- **WHEN** Zippopotam.us is unavailable but every other step succeeds
- **THEN** the run is `complete` with partial evidence completeness, the evidence shows `unavailable`, and the run is not counted as an agent failure

#### Scenario: Draft is blocked
- **WHEN** a composed draft fails a draft rule
- **THEN** the revision is `verification_blocked`, the approval queue excludes it, and the dossier shows the failed rule

#### Scenario: Evidence digest mismatch
- **WHEN** a stored evidence body does not match its digest
- **THEN** the run fails `failed_terminal` with a safe integrity error

### Requirement: Operator edits are re-verified
An operator-edited revision SHALL pass `draft.no_decision_language`, `draft.no_request_text` and
`draft.compliance_notice` before entering the approval queue and SHALL be labelled `operator_edited`
because free text cannot be grounding-checked.

#### Scenario: Edit introduces decision language
- **WHEN** an operator edit adds "guaranteed savings"
- **THEN** the new revision is `verification_blocked` and the API reports the failed rule

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
