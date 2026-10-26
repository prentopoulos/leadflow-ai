# consent-gated-outreach Specification

## Purpose
TBD - created by archiving change phase-2-enrichment-outreach-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Drafts exist only with recorded consent
The workflow SHALL compose an email draft only when the lead carries a valid consent record and
qualification is not held, for every priority, and SHALL otherwise record `draft.skipped` with its
reason.

#### Scenario: Consent is absent
- **WHEN** a lead has consent false
- **THEN** no draft, review or queue entry exists and the run records `draft.skipped` with reason `no_consent`

#### Scenario: Qualification is held
- **WHEN** consent is true but qualification is held for invalid evidence
- **THEN** no draft is composed and the reason is `qualification_held`

#### Scenario: Nurture lead with consent
- **WHEN** a nurture-priority lead has consent
- **THEN** a draft is composed with the follow-up action "Add to nurture list"

### Requirement: Deterministic grounded template composer
Drafts SHALL be produced by `deterministic-template-v1` behind a provider-neutral composer port from a
minimum projection of given name, priority, need timeline, coverage focus, request intent and
verified enrichment claims, with every slot carrying provenance `intake`, `verified_evidence` or
`fixed_copy`.

#### Scenario: Same input composes the same draft
- **WHEN** the composer runs twice on the same projection
- **THEN** it returns byte-identical content and the same content digest

#### Scenario: Request details contain text
- **WHEN** the lead has request details
- **THEN** the projection excludes them and no part of them appears in the draft

#### Scenario: Enrichment is unavailable
- **WHEN** a source is unavailable or not found
- **THEN** the draft omits that claim rather than stating or guessing it

### Requirement: Fixed follow-up action and compliance notice
Each draft SHALL include the follow-up action for its priority — high "Review today", standard
"Review this week", nurture "Add to nurture list" — and the fixed notice that CAN-SPAM requires an
advertisement disclosure, a valid physical postal address and a working opt-out before any send,
without filling in any address.

#### Scenario: Draft is displayed
- **WHEN** an operator views a draft
- **THEN** the follow-up action and unaltered notice are visible and no postal address appears

### Requirement: Immutable revisions and content-bound reviews
Each draft revision SHALL be immutable with a SHA-256 content digest; an operator edit SHALL create a
new `operator_edited` revision that supersedes the previous one and returns to `pending_review`; and
each approve or reject decision SHALL be an append-only `draft-review-v1` record naming the latest
revision, its digest, the operator principal and the time.

#### Scenario: Latest revision is approved
- **WHEN** the operator approves the latest pending revision with its current digest
- **THEN** a review record is stored and the revision state becomes `approved`

#### Scenario: Review names a stale revision or digest
- **WHEN** a review names a superseded revision, an already-decided revision or a mismatched digest
- **THEN** the API returns a fixed 409 and stores nothing

#### Scenario: Approved draft is edited
- **WHEN** the operator edits an approved revision
- **THEN** a new pending revision is created and the earlier approval stays attached only to the earlier digest

### Requirement: Approval never sends
Approval SHALL mean approved for manual use only; the product SHALL contain no send route, SMTP
client, email SDK, outbound queue or scheduled delivery.

#### Scenario: Draft is approved
- **WHEN** a draft is approved
- **THEN** the only available actions are copy and export, and no outbound network activity occurs

#### Scenario: A send capability is introduced
- **WHEN** source or dependencies add a send route, SMTP or email-delivery package
- **THEN** the governance check fails the gate

### Requirement: Labelled local operator principal
Until authentication exists, every review SHALL record the fixed principal `local-operator` with
the label "Local operator (unauthenticated)", and the interface SHALL show that label.

#### Scenario: Review is inspected
- **WHEN** a review record is read
- **THEN** it names the fixed local principal and never claims an authenticated identity
