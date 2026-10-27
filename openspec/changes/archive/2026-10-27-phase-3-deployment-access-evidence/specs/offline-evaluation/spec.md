## ADDED Requirements

### Requirement: Frozen Phase 3 boundary cases
The evaluator SHALL add a `phase-3.0` corpus fixed before Phase 3 measurement and retaining every
earlier case ID, covering strict local/cloud configuration, IAP assertion and private-subject
authorization, request-bound execution/idempotency/deadline recovery, Firestore client denial,
TTL/purge guards, log privacy, immutable release identity, cost-control configuration, rollback and
teardown records.

#### Scenario: Offline Phase 3 evaluation runs
- **WHEN** `pnpm eval` runs inside the offline gate
- **THEN** deterministic configuration, authorization, workflow, privacy and evidence-contract cases pass or fail without cloud credentials or network access

#### Scenario: Deployed behavior is not measured offline
- **WHEN** a case depends on actual IAP, Cloud Run, Firestore, IAM, billing, logging or rollback behavior
- **THEN** it reports `not_run` and names the separately authorized deployed probe that can establish it

#### Scenario: Candidate deployment identity changes
- **WHEN** code, container digest, IAP policy, cloud configuration, Firestore retention policy or deployment revision changes
- **THEN** affected Phase 3 evidence becomes `stale` until the declared checks rerun

### Requirement: Phase 3 preserves domain methodology
Phase 3 evaluation SHALL leave `rubric-v1`, priority thresholds, metric definitions, enrichment
claims, consent semantics, human approval, deterministic provider-null behavior and no-send
requirements unchanged.

#### Scenario: Deployment result is evaluated
- **WHEN** a hosted case completes qualification, enrichment, drafting, verification or metrics
- **THEN** its domain assertions use the same accepted versions and denominators as Phase 2 and make no production, conversion or insurance-decision claim
