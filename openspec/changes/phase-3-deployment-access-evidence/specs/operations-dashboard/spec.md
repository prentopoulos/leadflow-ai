## ADDED Requirements

### Requirement: Authenticated operator and session states
The hosted interface SHALL render signing-in/loading, signed-in operator, access-denied,
session-expired and retry states without exposing private identity values, while local mode SHALL
retain its explicit unauthenticated local-operator label.

#### Scenario: Hosted session expires
- **WHEN** a previously authorized request receives an authentication denial
- **THEN** the interface stops state-changing polling/actions, preserves no invented fresh state, and presents the fixed re-authentication path

#### Scenario: Operator is signed in
- **WHEN** the hosted session is valid
- **THEN** the interface indicates authenticated private access without rendering the owner email, stable subject, audience or raw token

### Requirement: Deferred accessibility refinements
The operator interface SHALL add success focus and next-pending guidance, `aria-pressed` filter
semantics, accessible run-card names, quieter polling announcements, keyboard focus within each
chart's explanatory frame, disclosure markers, and documented keyboard shortcuts while preserving
the existing visual direction.

#### Scenario: Keyboard operator uses the hosted flow
- **WHEN** the operator signs in, submits intake, starts execution, polls progress and opens a run at desktop or 390 px
- **THEN** focus order and accessible names expose the next action, filtering, cards, disclosures, charts and shortcuts without hidden or duplicate announcements

#### Scenario: Poll returns unchanged state
- **WHEN** a polling response contains no new material revision or event
- **THEN** the live region makes no repetitive progress announcement
