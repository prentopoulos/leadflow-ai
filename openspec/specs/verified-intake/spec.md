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
The API SHALL accept only `intake-v2` submissions that satisfy bounded domain-owned validation for
ZIP, fictional identity, an email under `example.com`, `example.org`, or `example.net`, vehicle,
coverage focus, request intent, need timeline, optional request details, explicit email-contact
consent, and a consent record that is present exactly when consent is true and names a wording
version and digest from the server-owned consent wording table.

#### Scenario: Valid synthetic intake is submitted
- **WHEN** a schema-valid fixture uses a fictional identity and one of the three allowed example domains
- **THEN** the API accepts its normalized value for persistence

#### Scenario: Unexpected or malformed input is submitted
- **WHEN** an intake has an unknown property, invalid enum, malformed ZIP/email/year, or overlong text
- **THEN** validation fails before any lead, run, event, checkpoint, or idempotency record is created

#### Scenario: Contact-shaped real data is submitted locally
- **WHEN** local-synthetic mode receives an email outside the documented test domains
- **THEN** the API rejects it with a safe validation error and stores no submission data

#### Scenario: Consent record does not match the wording table
- **WHEN** consent is true with a missing, unknown, or mismatched wording version or digest, or consent is false with a consent record
- **THEN** validation fails and nothing is stored

#### Scenario: Phase 1 intake version is submitted
- **WHEN** a submission declares `intake-v1`
- **THEN** it is rejected with a safe validation error

### Requirement: Consent remains explicit and outside qualification
Email-contact consent SHALL default to false, SHALL never be inferred from another field, SHALL
contribute no qualification points, and SHALL enable only the composition of a draft awaiting human
review, never any outbound action.

#### Scenario: Consent is omitted
- **WHEN** a submission omits consent
- **THEN** the normalized lead records consent as false with no consent record and no outreach draft is created

#### Scenario: Consent is true
- **WHEN** a submission explicitly records consent as true with a valid consent record
- **THEN** score and priority are unchanged and the workflow may compose a draft that awaits human review and is never sent

#### Scenario: Consent wording is displayed
- **WHEN** the operator views the consent control
- **THEN** the exact current wording is shown and the submitted record names its version and digest

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

