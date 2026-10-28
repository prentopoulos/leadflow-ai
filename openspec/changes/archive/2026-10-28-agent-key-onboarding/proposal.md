## Why

The local agent team currently has to discover its Anthropic key at process startup, which makes a
normal first run stop at setup instructions instead of letting the operator enable research from
the dashboard. This Phase 5 refinement gives the local operator one clear, in-product setup path
while preserving the existing opt-in, spend, privacy, hosted-refusal and draft-only boundaries.

## What Changes

- Start the normal local demo with the agent capability available but off, without an `--agents`
  startup argument.
- When no Anthropic key is available, let the operator open a compact key-entry form from the
  existing AI research panel, submit the key to the loopback backend, save it as
  `ANTHROPIC_API_KEY` in the gitignored repository-root `.env`, and turn the agent switch on.
- Create `.env` when it is absent and replace only the Anthropic key when it already exists.
- Keep the key out of responses, logs, model context, Firestore, tests, documentation and system
  bundle records; keep the hosted route absent.
- Update the agent-drafting contract, local architecture description, operator documentation and
  AI-operations record for the new setup path.

### Non-goals

- Validating a key with a paid provider request during setup, showing or retrieving a stored key,
  adding hosted secret entry, changing models or spend caps, or enabling automatic outreach.
- Changing qualification, enrichment, verification, scoring, metrics or model-visible lead data.
- Amending any PROJECT.md section 5 constitution rule or section 6 gate.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-drafting`: Replace startup-flag/key-discovery requirements with normal local startup and a
  backend-only, loopback key-onboarding path that creates or updates the gitignored `.env` before
  enabling the existing agent team.

## Impact

Affected areas are the local launch scripts, the Fastify agent-settings boundary, the mutable local
model adapter, React agent controls, the `agent-drafting` spec, AI_OPS/README/HANDOFF guidance and
the local C4 component description. No dependency, provider, model, price, hosted runtime or data
schema changes.
