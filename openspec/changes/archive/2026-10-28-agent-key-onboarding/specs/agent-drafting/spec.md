## MODIFIED Requirements

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

## ADDED Requirements

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
