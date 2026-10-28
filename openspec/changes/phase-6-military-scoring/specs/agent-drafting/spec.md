## MODIFIED Requirements

### Requirement: Models see the lead's situation, never the person
Every model request SHALL be built only from the vehicle year, make and model of each vehicle, the
area place and state from a verified single-place ZIP record, and the situation answers: currently
insured, current insurer, bundling interest and homeowner. The name, email, phone, street address,
birthdate, gender, marital status, ZIP code and driving-record answers SHALL never appear in any
model request.

#### Scenario: Request contents are checked
- **WHEN** a fixture lead with a distinctive name, email, phone, address and driving record runs through the team
- **THEN** none of those values appears in any recorded model request

#### Scenario: Situation answers reach the coverage worker
- **WHEN** a lead is insured with a named insurer and wants a bundle
- **THEN** the coverage worker's request contains those answers and no excluded field
