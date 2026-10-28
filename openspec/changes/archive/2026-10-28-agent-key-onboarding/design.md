## Context

The existing `feat/agent-toggle` branch exposes a local `GET/PUT /v1/agents` switch, but the
workflow is compiled with the agent team only when the launch script sees both an `--agents`
argument and `ANTHROPIC_API_KEY` at startup. When the key is absent, the dashboard can only explain
manual setup and a restart. The key remains a local backend secret and hosted mode refuses every
agent route.

This refinement crosses the launcher, runtime composition, Fastify boundary and React control. It
does not change the Phase 5 agent graph, provider, models, prompt set, claims, spend ledger or
verification behavior.

## Goals / Non-Goals

**Goals:**

- Make `pnpm demo` and the normal local API launcher agent-capable without an `--agents` argument,
  while keeping the agent team off at startup and making no provider call until the operator opts
  in.
- Accept a bounded Anthropic key through the existing loopback-only Fastify boundary, create or
  update the repository-root gitignored `.env`, install the adapter in memory and enable the switch
  without restarting.
- Preserve every existing privacy, consent, draft-only, verification and spend-cap boundary.
- Provide a keyboard-accessible, 390px-readable setup form using the existing shadcn/21st-derived
  button primitive and product tokens.

**Non-Goals:**

- Provider-side key validation during setup, key retrieval/display, hosted secret entry, multi-user
  secret storage, a general settings service, a new model/provider, or changed spend limits.
- Changes to prompts, model-visible fields, qualification, enrichment, drafts, verification,
  metrics, Firestore records or outreach authority.

## Decisions

### Compile the standard local launcher as agent-capable

The local launcher will always create the existing agent-enabled system bundle and set
`LEADFLOW_AGENTS=claude`; `pnpm demo` will stop passing an agent argument. The agent switch still
starts false. A mutable backend model-port holder will contain either no adapter or the current
`AnthropicModelPort`, and its `isEnabled` predicate will require both a configured adapter and the
operator switch.

This keeps the system bundle honest about what the process can produce while separating capability
from paid use. Keeping a template-only default bundle was rejected because runtime key entry cannot
add an agent team to a workflow compiled without that boundary. Restarting after save was rejected
because it preserves the friction the change is meant to remove.

### Add a write-only local secret endpoint

`PUT /v1/agents/key` will accept `{ apiKey }` through a strict bounded schema and return only the
existing public `agent-settings-v1` state. The route exists only when the ready runtime is local and
agent-capable. The existing exact Host/Origin checks protect the state-changing request against
remote browser origins and DNS rebinding; Fastify logging is disabled. No event, Firestore record,
system bundle, response or error will contain the key.

The schema will allow only the expected `sk-ant-` prefix plus environment-safe ASCII key
characters, preventing newline or dotenv injection. It will not call Anthropic to validate the key:
that would be an unexpected paid/external action during setup. Authentication failure on the first
authorized lead remains a safe recorded model fallback.

### Write `.env` through a narrow backend utility

The backend will target one fixed repository-root path, preserve unrelated dotenv entries, remove
duplicate `ANTHROPIC_API_KEY` assignments, and append one canonical assignment. It will create the
file when absent and replace it through a same-directory temporary file; POSIX creation uses mode
`0600`, while Windows inherits the repository directory ACL. A write failure returns the existing
safe error envelope and leaves the in-memory adapter disabled.

The adapter is constructed before the write and installed only after the write succeeds. The secret
value is never interpolated into a message, filename or log. A general filesystem path or filename
in the request was rejected because it would turn secret setup into a file-write primitive.

### Use an inline disclosure instead of a modal dependency

When the key is missing, the existing primary button opens a bordered inline form inside the AI
research panel, focuses a password input, and offers `Save key and turn on` plus `Cancel`. Inline
disclosure preserves context, works at 390px without a focus trap, and reuses the existing button,
input, spacing, border and focus styles. The key is cleared from React state after success and is
never placed in browser storage.

### Evidence and recovery

The system remains `system-bundle-v5`; its agent-capable local identity already binds the provider,
models and prompt digest. Changed evidence consists of deterministic schema, dotenv-store, route and
component cases plus the ordinary offline gate. No provider evaluation is required because the
model call contract and behavior are unchanged; a paid live key-validation probe is explicitly
`not_run` and unnecessary for this slice.

Negative paths cover malformed keys, unavailable routes, file-write failure, disabled state and
safe re-entry. Turning the switch off blocks every subsequent provider call; a request already sent
to Anthropic may still finish. Revocation/rotation remains
the documented local action: turn the switch off, edit/remove `ANTHROPIC_API_KEY` in `.env`, and
restart; the current process otherwise retains its in-memory client until exit.

## Risks / Trade-offs

- **A same-origin script could submit a key** → The app has no third-party scripts; the backend
  remains loopback-only with exact Host/Origin checks, a strict body, no secret response and no
  logging. Recheck if remote or multi-user access is introduced.
- **A syntactically valid but incorrect key is saved** → Setup performs no paid call; the first
  explicitly enabled agent run records a safe authentication fallback, and the operator can turn
  agents off and replace the key.
- **The local process now advertises an agent-capable bundle even without a key** → Availability
  and enabled state remain explicit; no call can occur without both a configured adapter and the
  operator switch.
- **Dotenv replacement could damage unrelated settings** → The utility has focused preservation,
  duplicate-removal, create and write-failure tests, uses one fixed path and performs a same-folder
  replacement.
- **The key exists briefly in browser and server memory** → It is held only for submission and the
  provider client, never persisted in browser storage or application data. This is the minimum path
  compatible with an in-product bring-your-own-key flow.

## Migration Plan

1. Standard local launchers begin producing the existing agent-capable bundle without a flag.
2. Existing `.env` keys are loaded as before and show the ordinary off-at-start switch.
3. Missing `.env` files are created only after an operator submits a key; template-only operation
   still works indefinitely without one.
4. Rollback restores the flag-gated launcher and manual key instructions. `.env` remains ignored and
   can be removed by the operator; no stored application schema needs migration.

## Non-negotiables Check

- **Secret mechanism / backend-only API keys:** kept by fixed-path gitignored `.env`, write-only
  loopback endpoint, no response/log/data record, bounded schema and negative tests.
- **Truthful evidence / operator gates:** no setup-time provider call or claimed validation; paid
  calls still require the operator switch and retain the accepted $0.30-per-lead/$8-process caps.
- **Fictional data / persist before agents / qualification boundary:** unchanged; key setup carries
  no lead data and the existing workflow still persists before model work.
- **Consent, human approval and no sending:** unchanged; the team still runs only in
  `compose_draft` for consented, scored leads and produces a review-only paragraph.
- **Structured outputs / minimized model context / verified evidence:** unchanged; the provider,
  prompts, projection, code claim checker and verification rules do not change.
- **Military.com claims and dashboard metrics:** untouched.
- **Accessible UI:** the disclosure is semantic, keyboard-focused, visibly focused and responsive;
  no motion is added.
- **Paid API gate:** previously resolved for the existing local Anthropic scope; this change adds no
  provider, model, cap or background call. Hosted, real-data and external-communication gates remain
  unresolved and untouched.

## Open Questions

None. The owner selected normal startup, in-product key entry, automatic `.env` creation and the
existing 21st/shadcn visual treatment in the current request.
