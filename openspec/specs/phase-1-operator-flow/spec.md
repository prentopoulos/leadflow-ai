# phase-1-operator-flow Specification

## Purpose
TBD - created by archiving change phase-1-intake-qualification. Update Purpose after archive.
## Requirements
### Requirement: One intake-to-run-detail workflow
The web application SHALL let one local operator submit a synthetic intake, receive the persisted
lead/run identifiers, and inspect the same stored run's progress and result without fabricated
client-side completion.

#### Scenario: Submission persists successfully
- **WHEN** the API returns the committed run identity
- **THEN** the interface moves focus to an identified run heading and renders state obtained from the run API

#### Scenario: Persistence fails
- **WHEN** the intake API rejects or cannot commit the submission
- **THEN** the interface shows a useful error, keeps the operator's safe local input available for correction, and displays no run as started

### Requirement: Persistent synthetic context
The operator flow SHALL display `SIMULATION · Synthetic leads and outcomes` persistently and SHALL
keep source/demo field labels and local-only scope visible wherever a result could be mistaken for
live operations.

#### Scenario: Operator scrolls through a long run
- **WHEN** result evidence extends beyond one viewport
- **THEN** the synthetic context remains available without relying on a dismissed toast or initial page copy

### Requirement: Stored lifecycle progress
Run progress SHALL be rendered from stored status and append-only events, including persistence,
claims, step completion, retries, failures, resume requests, simulation, and terminal state.

#### Scenario: Run is in progress
- **WHEN** polling returns a new stored revision
- **THEN** the visible progress updates to that revision without inventing time-based steps

#### Scenario: Polling fails temporarily
- **WHEN** a run-detail request is unavailable or times out
- **THEN** the last confirmed state remains labeled with its timestamp and the UI reports that newer state is unavailable

#### Scenario: Run terminates
- **WHEN** the stored run becomes complete or terminally failed
- **THEN** polling stops and the terminal state remains inspectable

### Requirement: Explainable result presentation
Completed run detail SHALL show total marketing-readiness score, non-insurance meaning, priority,
criterion breakdown, evidence, missing information, rubric/interpreter/bundle versions, and the
separately labeled simulation summary.

#### Scenario: Evidence is long
- **WHEN** criterion reasons or missing-information lists exceed the compact summary
- **THEN** the operator can reveal the full semantic content without losing the score's source and scope context

#### Scenario: Qualification is held
- **WHEN** the run has an integrity hold or missing qualification result
- **THEN** the UI shows no priority and explains the stored failure rather than rendering a partial score as final

### Requirement: Honest failure and resume experience
Persisted, retrying, retryable-failed, terminal-failed, and incompatible-checkpoint states SHALL have
distinct language and actions; only an eligible retryable run SHALL expose resume.

#### Scenario: Retryable failure is shown
- **WHEN** the stored run is `failed_retryable`
- **THEN** the operator sees prior attempts, the safe error, expected revision, and a single explicit resume action

#### Scenario: Resume loses a race
- **WHEN** another execution changes the revision before resume commits
- **THEN** the UI refreshes from stored state and does not claim the stale resume succeeded

### Requirement: Complete state coverage
The interface SHALL include and test loading, no-run, validation error, persistence error, in-progress,
retrying, partial, retryable failure, terminal failure, complete, stale-data, and long-content states.

#### Scenario: Component states are exercised
- **WHEN** the fixed UI fixtures are rendered
- **THEN** every declared state has content, semantics, and available actions consistent with the underlying contract

### Requirement: Operations-led visual direction
The interface SHALL implement the accepted calm operations-dossier thesis with a continuous
workspace, warm neutral surfaces, near-black ink, one accessible teal accent, thin borders, minimal
motion, and no Military.com visual imitation.

#### Scenario: Desktop workflow is rendered
- **WHEN** the operator uses the primary viewport
- **THEN** intake and stored run evidence form one coherent reading order rather than a wall of interchangeable cards

#### Scenario: Reduced motion is requested
- **WHEN** the operating system requests reduced motion
- **THEN** progress and state remain understandable without animation or motion-dependent meaning

### Requirement: Keyboard and mobile continuity
All controls and disclosures SHALL be keyboard operable with visible focus, SHALL preserve logical
focus after async updates, and SHALL remain readable in the same semantic order at 390px without
horizontal page scrolling.

#### Scenario: Polling updates while a control has focus
- **WHEN** a new run revision arrives
- **THEN** focus remains on the operator's control and no live region repeats unchanged history

#### Scenario: Flow is inspected at 390px
- **WHEN** loading, error, long evidence, and complete fixtures render at 390px
- **THEN** fields, timeline, score, evidence, simulation label, and actions remain readable and operable

