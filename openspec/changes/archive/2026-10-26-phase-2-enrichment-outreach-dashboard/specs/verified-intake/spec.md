## MODIFIED Requirements

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
