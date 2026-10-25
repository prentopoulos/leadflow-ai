# verified-intake Specification

## Purpose
TBD - created by archiving change phase-1-intake-qualification. Update Purpose after archive.
## Requirements
### Requirement: Source-honest intake fields
The system SHALL identify ZIP code as the only exact field verified from the current public
Military.com auto-insurance landing page and SHALL identify every other Phase 1 input as a LeadFlow
demo field.

#### Scenario: Verified ZIP label is shown
- **WHEN** the operator views the intake
- **THEN** ZIP code is marked as verified from the named public source with its retrieval date available

#### Scenario: Demo fields are shown
- **WHEN** the operator views name, email, vehicle, coverage, intent, timeline, request-detail, or consent inputs
- **THEN** those inputs are grouped or individually marked as LeadFlow demo fields rather than Military.com questions

#### Scenario: Parity wording is inspected
- **WHEN** the intake and its documentation are reviewed
- **THEN** they make no claim of complete form, visual, routing, scoring, insurer-matching, or quote parity

### Requirement: Versioned validated intake contract
The API SHALL accept only `intake-v1` submissions that satisfy bounded domain-owned validation for
ZIP, fictional identity, an email under `example.com`, `example.org`, or `example.net`, vehicle,
coverage focus, request intent, need timeline, optional request details, and explicit email-contact
consent.

#### Scenario: Valid synthetic intake is submitted
- **WHEN** a schema-valid fixture uses a fictional identity and one of the three allowed example domains
- **THEN** the API accepts its normalized value for persistence

#### Scenario: Unexpected or malformed input is submitted
- **WHEN** an intake has an unknown property, invalid enum, malformed ZIP/email/year, or overlong text
- **THEN** validation fails before any lead, run, event, checkpoint, or idempotency record is created

#### Scenario: Contact-shaped real data is submitted locally
- **WHEN** local-synthetic mode receives an email outside the documented test domains
- **THEN** the API rejects it with a safe validation error and stores no submission data

### Requirement: Consent remains explicit and outside qualification
Email-contact consent SHALL default to false, SHALL never be inferred from another field, and SHALL
contribute no qualification points or outbound action.

#### Scenario: Consent is omitted
- **WHEN** a submission omits consent
- **THEN** the normalized lead records consent as false and no outreach record or action is created

#### Scenario: Consent is true
- **WHEN** a submission explicitly records consent as true
- **THEN** the value is retained for later phases but does not change score, priority, or create a message

### Requirement: Untrusted request text cannot expand authority
The system SHALL treat request details as bounded data and SHALL enforce rubric, provenance, consent,
evidence class, and runtime authority outside that text.

#### Scenario: Request details contain control instructions
- **WHEN** request text asks the system to change weights, claim consent, relabel evidence, call an external service, or send a message
- **THEN** the stored text grants none of those effects and the fixed contracts remain unchanged

### Requirement: Accessible responsive intake
The intake SHALL use semantic form controls, programmatic labels, grouped source/demo context, an
error summary linked to invalid fields, keyboard operation, visible focus, reduced-motion behavior,
and a readable 390px layout.

#### Scenario: Validation fails with multiple fields
- **WHEN** the operator submits an invalid form
- **THEN** focus moves to an error summary whose links identify and focus the affected controls

#### Scenario: Intake is used at 390px
- **WHEN** the viewport is 390px wide with long labels and errors
- **THEN** all controls, evidence labels, consent text, and actions remain readable without horizontal page scrolling

