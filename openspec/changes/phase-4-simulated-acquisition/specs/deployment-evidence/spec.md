## ADDED Requirements

### Requirement: Posted hosted cost is recorded
`deployed-cost-status` SHALL record the posted Phase 3 hosted cost from the billing reports and
both budgets with the observation time, or stay pending with a reason while billing may not have
posted, and SHALL never record zero by default.

#### Scenario: Reading is too early
- **WHEN** the reading is taken less than 24 hours after the last billable activity
- **THEN** the observed amount and time are recorded and the entry stays pending until a later reading

#### Scenario: Cost has posted
- **WHEN** a reading at least 24 hours after the last billable activity is taken
- **THEN** the entry records the amount per budget and whether it is below the 50% inspection point

### Requirement: Phase 4 hosted demonstration evidence
Only after the posted cost is below the 50% inspection point and the owner gives one enumerated
approval SHALL the hosted data be purged, the exact Phase 4 commit be built once and its digest
deployed to the existing private service, smokes 5–6 and the rollback section be rerun for the new
revision, the simulated traffic be run through the hosted control, and
`docs/evidence/phase-4/index.json` record the candidate, revision, probe results and pre- and
post-demo cost including Firestore reads.

#### Scenario: Cost is at or above 50%
- **WHEN** task 1 records spend at or above the 50% inspection point
- **THEN** no hosted build or demo runs and the demonstration and recording fall back to local only

#### Scenario: Evidence is approved
- **WHEN** the owner approves the Phase 4 demonstration evidence
- **THEN** the approval date is recorded and the seven-day teardown clock starts from it

### Requirement: Walkthrough recording
The roughly two-minute captioned walkthrough SHALL be recorded at the end of Phase 4 from fictional,
visibly labelled data following `docs/walkthrough.md`, kept as a private preview, and published as
an MP4 only after a separate owner decision.

#### Scenario: Recording is produced
- **WHEN** the walkthrough is recorded
- **THEN** every acquisition scene shows its SIMULATED label and no private identity, URL or billing value appears
