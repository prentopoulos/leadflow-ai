## ADDED Requirements

### Requirement: Frozen Phase 4 acquisition cases
The `phase-4.0` corpus SHALL keep every earlier case ID, port retained intake fixtures to
`intake-v3` with `attribution: null`, and add cases fixed before implementation measures them for
channel rules, spend fixture integrity, known-answer CPL and CPQL arithmetic, empty denominators,
zero-spend groups, unattributed counting, real-looking click-ID rejection, `intake-v2` rejection,
traffic-plan determinism and idempotent rerun, and score independence from attribution.

#### Scenario: Known-answer cost arithmetic
- **WHEN** a small fixture of stored leads and spend with a hand-calculated answer is evaluated
- **THEN** blended, per-channel and per-campaign CPL and CPQL match the expected integer-cent values exactly

#### Scenario: Attribution must not change a score
- **WHEN** the score-independence case runs
- **THEN** it passes only if score, priority and draft are identical with and without attribution

#### Scenario: Hosted cases before the authorized probe
- **WHEN** the offline evaluation runs
- **THEN** hosted Phase 4 cases are reported `not_run` with a reason, never pass
