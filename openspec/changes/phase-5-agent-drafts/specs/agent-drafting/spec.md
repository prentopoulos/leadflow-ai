## ADDED Requirements

### Requirement: Opt-in agent team
The agent team SHALL run only in a local process started with `--agents=claude`, only inside the
`compose_draft` step, and only for a lead with recorded consent whose qualification is not held.
Hosted mode SHALL refuse the switch, and without it drafts SHALL come from the template alone.

#### Scenario: Default demo
- **WHEN** `pnpm demo` runs without `--agents`
- **THEN** no model call is made and every draft is a template draft

#### Scenario: Hosted refuses agents
- **WHEN** the hosted configuration requests agents
- **THEN** startup fails before serving requests

### Requirement: Models see the lead's situation, never the person
Every model request SHALL be built only from the vehicle year, make and model, the area place and
state from a verified single-place ZIP record, and the coded need, focus and intent answers. The
name, email, ZIP code and request details SHALL never appear in any model request.

#### Scenario: Request contents are checked
- **WHEN** a fixture lead with distinctive name, email and request text runs through the team
- **THEN** none of those values appears in any recorded model request

### Requirement: Research team with verified claims
The lead model SHALL plan one to three questions for each of the vehicle, area and coverage
workers; the workers SHALL run in parallel with web search; and a code claim verifier SHALL keep
only claims whose https URL and quote came back as a web-search citation on that response and whose
numbers and at least half of whose content words appear in the quote. The lead SHALL merge only
kept claims into the brief.

#### Scenario: Unsupported number
- **WHEN** a claim states a number that its quote does not contain
- **THEN** the claim is rejected and counted, and cannot be cited

#### Scenario: Nothing survives
- **WHEN** no claim is kept
- **THEN** the team stops with `no_verified_claims` and the template draft is used

### Requirement: Bounded draft loop
A writer SHALL draft one paragraph citing kept claim IDs; a code rule checker and a critic SHALL
review it; the writer SHALL get at most two rewrites. The paragraph SHALL be used only when the
final attempt passes the rule checker and the critic approves; otherwise the fallback reason SHALL
be recorded and the template draft used.

#### Scenario: Rewrite fixes a rule failure
- **WHEN** the first paragraph contains decision language and the rewrite does not
- **THEN** the rewrite is used and both attempts are recorded

#### Scenario: Critic never approves
- **WHEN** the critic rejects all three attempts
- **THEN** the fallback reason is `critic_unresolved` and the draft has no agent paragraph

### Requirement: Spend reserved before every call
The process SHALL reserve each call's worst-case cost against a $0.30 per-lead and an $8 per-process
cap before calling, and SHALL settle it from reported usage after. A reservation that would exceed
a cap SHALL stop the team with `budget_exceeded` without making the call.

#### Scenario: Lead cap reached
- **WHEN** the next reservation would take the lead above $0.30
- **THEN** no call is made, the brief records `budget_exceeded` and the template draft is used

### Requirement: Stored brief and visible sources
Each agent run SHALL store an `agent-brief-v1` record with its status, fallback reason, kept claims
(URL, title, quote), brief points, paragraph, critic notes, and every call's role, model, usage and
cost. The dossier draft panel SHALL show the agent status, total cost, and each cited source with
its URL and quote, or the fallback reason.

#### Scenario: Operator opens an agent draft
- **WHEN** the dossier shows a draft with an agent paragraph
- **THEN** it lists the cited sources with their quotes and the run's cost, and states that nothing is sent

### Requirement: System bundle names the provider
When agents run, the system bundle SHALL record provider `anthropic`, the models per role and the
prompt-set digest; otherwise it SHALL keep the unavailable boundary. A cloud bundle SHALL have no
agent team.

#### Scenario: Agents enabled locally
- **WHEN** `api:local -- --agents=claude` records its bundle
- **THEN** provider, model and prompt are present and differ from the template-only bundle id
