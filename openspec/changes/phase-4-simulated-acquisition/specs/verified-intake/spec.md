## MODIFIED Requirements

### Requirement: Versioned validated intake contract
The API SHALL accept only `intake-v3` submissions that satisfy bounded domain-owned validation for
ZIP, fictional identity, an email under `example.com`, `example.org`, or `example.net`, vehicle,
coverage focus, request intent, need timeline, optional request details, explicit email-contact
consent, a consent record that is present exactly when consent is true and names a wording
version and digest from the server-owned consent wording table, and an optional synthetic
`attribution` object labelled as LeadFlow simulated data rather than a Military.com field.

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
- **WHEN** a submission declares `intake-v1` or `intake-v2`
- **THEN** it is rejected with a safe validation error

#### Scenario: Intake form submits
- **WHEN** the operator submits the intake form
- **THEN** the submission carries `attribution: null` and no URL query parameter is captured
