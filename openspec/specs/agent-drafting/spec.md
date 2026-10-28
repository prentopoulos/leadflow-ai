# agent-drafting Specification

## Purpose

Define the opt-in, privacy-bounded and spend-capped agent team that researches verified claims and
drafts a review-only outreach paragraph without changing qualification or sending communication.

## Requirements

### Requirement: Opt-in agent team
The normal local demo and local API launcher SHALL compile the agent capability without an
`--agents` startup argument, but the agent team SHALL start disabled and SHALL run only inside the
`compose_draft` step for a lead with recorded consent whose qualification is not held. A provider
call SHALL require both a configured backend key and the operator's enabled dashboard switch.
Hosted mode SHALL refuse the capability, and while the switch is off drafts SHALL come from the
template alone.

#### Scenario: Default demo without a key
- **WHEN** `pnpm demo` runs with no repository-root `.env`
- **THEN** the app starts normally, no model call is made, template drafts remain available, and the
  Metrics view offers local key setup

#### Scenario: Default demo with a key
- **WHEN** `pnpm demo` loads a valid `ANTHROPIC_API_KEY` from the repository-root `.env`
- **THEN** the agent team is available but disabled until the operator turns it on

#### Scenario: Hosted refuses agents
- **WHEN** the hosted configuration requests agents or a caller requests the local agent routes
- **THEN** startup or the route fails before any key is accepted or model call is made

### Requirement: Backend-only local key onboarding
The local agent panel SHALL let the operator submit a bounded Anthropic API key to a write-only
loopback backend route. The backend MUST create or update `ANTHROPIC_API_KEY` in the fixed,
gitignored repository-root `.env`, preserve unrelated entries, install the provider adapter in
memory and enable the agent switch only after the file write succeeds. The key MUST NOT appear in a
response, log, error, system bundle, Firestore record, model input or browser storage.

#### Scenario: First-run key setup
- **WHEN** a local operator opens the agent setup form, submits a valid key and no `.env` exists
- **THEN** the backend creates `.env`, returns only public agent settings, marks the team available
  and enabled, and the form clears its key value

#### Scenario: Existing dotenv file
- **WHEN** a local operator submits a valid key and `.env` already contains unrelated settings or a
  previous Anthropic assignment
- **THEN** the backend preserves the unrelated settings and writes exactly one canonical
  `ANTHROPIC_API_KEY` assignment

#### Scenario: Invalid key payload
- **WHEN** the key is empty, oversized, has an unexpected prefix, or contains whitespace, quotes,
  backslashes or newline characters
- **THEN** validation fails without writing a file, changing availability or echoing the submitted
  value

#### Scenario: Dotenv write fails
- **WHEN** the fixed `.env` path cannot be written
- **THEN** the API returns a safe error, the team remains unavailable and disabled, and no provider
  call occurs

#### Scenario: Hosted key route
- **WHEN** a caller requests the key-onboarding route in hosted mode
- **THEN** the route is absent and no secret can be stored through the application

### Requirement: Accessible agent setup control
When the local agent key is absent, the Metrics view SHALL show a primary agent-research button that
opens an inline password-entry form using the existing product button and panel styles. The form
MUST provide a programmatic label, visible focus, submit and cancel actions, safe pending and error
states, and a readable layout at 390px. The copy SHALL disclose local `.env` storage, direct
Anthropic billing and the existing per-lead/process caps.

#### Scenario: Keyboard setup
- **WHEN** a keyboard user activates `Turn on agent research`
- **THEN** focus moves to the labeled API-key field and the user can submit or cancel without a
  pointer

#### Scenario: Successful setup
- **WHEN** the key endpoint returns available and enabled settings
- **THEN** the setup form closes, its value is cleared, and the ordinary enabled switch plus session
  spend replaces it

#### Scenario: Safe setup failure
- **WHEN** validation or persistence fails
- **THEN** the form stays open, its error is announced without including the key, and no enabled
  state is shown

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
The process SHALL durably record each call's worst-case cost against a $0.30 per-lead and an $8
per-process cap before calling, and SHALL settle it from reported usage after. Unknown usage SHALL
remain null and keep the full reservation; replay SHALL fall back instead of making the call again.
A reservation that would exceed a cap SHALL stop the team with `budget_exceeded` without making the
call.

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
- **WHEN** the normal local API launcher records its agent-capable bundle
- **THEN** provider, model and prompt are present and differ from the template-only bundle id
