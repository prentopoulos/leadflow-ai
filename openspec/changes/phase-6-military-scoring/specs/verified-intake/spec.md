## MODIFIED Requirements

### Requirement: Source-honest intake fields
The system SHALL present the questions of the Military.com auto quote flow in the flow's order and
wording, name auto.military.com and the 2026-10-27 retrieval date as their source, and SHALL make no
claim of complete form, visual, routing, submission, insurer-matching or quote parity.

#### Scenario: Copied questions are shown
- **WHEN** the operator views the intake
- **THEN** every Military.com question appears in the flow's order and wording under a Military.com heading

#### Scenario: Provenance is recorded
- **WHEN** a lead is stored
- **THEN** its provenance names the Military.com flow, the retrieval date and the copied fields, and records parity as unverified

#### Scenario: Parity wording is inspected
- **WHEN** the intake and its documentation are reviewed
- **THEN** they make no claim of complete form, visual, routing, scoring, insurer-matching or quote parity

### Requirement: Versioned validated intake contract
The API SHALL accept only `intake-v4` submissions that satisfy bounded domain-owned validation for
ZIP, fictional identity, an email under `example.com`, `example.org` or `example.net`, the
Military.com answers (with phones only in the fictional 555-0100 to 555-0199 range and at most five
vehicles), explicit email-contact consent, and a consent record that is present exactly when
consent is true and names a wording version and digest from the server-owned consent wording table.

#### Scenario: Valid synthetic intake is submitted
- **WHEN** a schema-valid fixture uses a fictional identity, an allowed example domain and a fictional phone
- **THEN** the API accepts its normalized value for persistence

#### Scenario: Unexpected or malformed input is submitted
- **WHEN** an intake has an unknown property, invalid enum, malformed ZIP/email/year/phone/date, or overlong text
- **THEN** validation fails before any lead, run, event, checkpoint or idempotency record is created

#### Scenario: Contact-shaped real data is submitted locally
- **WHEN** local-synthetic mode receives an email outside the documented test domains or a phone outside the fictional range
- **THEN** the API rejects it with a safe validation error and stores no submission data

#### Scenario: Consent record does not match the wording table
- **WHEN** consent is true with a missing, unknown or mismatched wording version or digest, or consent is false with a consent record
- **THEN** validation fails and nothing is stored

#### Scenario: Earlier intake version is submitted
- **WHEN** a submission declares `intake-v3` or earlier
- **THEN** it is rejected with a safe validation error
