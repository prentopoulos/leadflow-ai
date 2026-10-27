## Why

Phase 3 proved the private hosted service, but every stored lead looks alike: the dashboard cannot
say where a lead came from or what it cost. Phase 4 implements PROJECT.md Phase 4 (Simulated
acquisition): fictional leads arrive at a steady pace from labelled synthetic channels and
campaigns, and the dashboard reports attribution, cost per lead and cost per qualified lead from
stored leads and a checked-in synthetic spend fixture. It also closes the items Phase 3 carried
forward: the posted hosted cost, a hosted demonstration of the new behaviour, and the walkthrough
recording. Peter set the direction on 2026-10-27 ("keep it simple") and accepted every round-1
recommendation the same day.

## What Changes

- **BREAKING** Intake moves to `intake-v3` and leads to `lead-v3`. Intake gains an optional,
  strictly validated `attribution` object (source, medium, campaign as lowercase slugs, and an
  optional synthetic click ID). The server derives the channel; clients never submit one. The
  intake form keeps sending no attribution. `intake-v2` is rejected; local emulator data is
  cleared, not migrated, and hosted synthetic data is purged before the Phase 4 deploy.
- Add `channel-rules-v1`, a short versioned subset of GA4's default channel-group rules (Paid
  Search, Paid Social, Email, Affiliates, Organic Search, Direct, Unassigned, plus LeadFlow's own
  Unattributed), stated as adapted rules, not GA4 data.
- Add `synthetic-spend-v1`, a checked-in, labelled fixture of flight spend per simulated campaign in
  integer simulated-USD cents, and `metrics-definitions-v2` / `metrics-report-v2` with blended,
  per-channel and per-campaign cost per lead and cost per marketing-qualified lead (high or
  standard readiness).
- Replace `pnpm seed:local` with `pnpm simulate:traffic`: a seeded, fixed `traffic-plan-v1` of 60
  fictional leads at a steady pace through the real local API with recorded enrichment, channels
  assigned independently of lead content. In hosted mode the same plan runs from an
  owner-triggered "Run simulated traffic" control in the signed-in browser; no new credential,
  IAP setting or unattended run is added.
- Add an "Acquisition — SIMULATED" section to the existing metrics view and an attribution block to
  the run dossier. Drafts still wait for human approval; nothing is sent.
- Record the posted Phase 3 hosted cost, then, under one enumerated owner approval, purge hosted
  synthetic data, build and deploy the exact Phase 4 commit, rerun the stale deployed probes, run
  the simulated traffic, record Phase 4 deployed evidence and the walkthrough.

## Non-goals

- Real Google Ads, GA4, Search Console or other advertising/analytics data, APIs or tags, and real
  click IDs. Connecting such data would need the real-personal-information gate, the paid-API gate
  and a new scoped phase (owner decision, 2026-10-27).
- Capturing UTM parameters from the intake page URL.
- ROAS, revenue, LTV, cost per contact/response/appointment from `simulator-v1`, multi-touch or
  data-driven attribution, attribution windows, budget optimisation, bidding or forecasting.
- Channel filters on the leads list, a fourth view, or a visual redesign.
- Any change to `rubric-v1`, priority thresholds, drafts, verification, consent, human approval or
  the no-send boundary; attribution never reaches scoring, drafts, events, logs or model inputs.
- Live enrichment in the simulation, a scheduled or unattended run, a model/provider, or paid AI.
- Teardown inside the phase: its seven-day clock starts at the owner's approval of the Phase 4
  demonstration evidence and runs after the archive as an owner action.
- A constitution amendment. No PROJECT.md section 5 rule or section 6 gate changes; the hosted
  actions remain behind the existing deployment gate and need a separate enumerated approval.

## Capabilities

### New Capabilities

- `simulated-acquisition`: The attribution contract on the lead, `channel-rules-v1`, synthetic
  click IDs, the `synthetic-spend-v1` fixture, cost-per-lead and cost-per-qualified-lead
  definitions, the seeded `traffic-plan-v1` with its local CLI and hosted browser control, and the
  isolation of attribution from scoring, drafts and telemetry.

### Modified Capabilities

- `verified-intake`: The accepted intake version becomes `intake-v3` with optional attribution;
  `intake-v2` is rejected.
- `operations-dashboard`: Metric definitions move to v2 with an acquisition block; the seed-data
  requirement is replaced by the paced traffic simulator; the metrics view gains the simulated
  acquisition section and the dossier an attribution block.
- `offline-evaluation`: Freeze `phase-4.0` cases for channel rules, spend fixture integrity, cost
  arithmetic, empty and zero-spend handling, click-ID rejection, plan determinism and score
  independence.
- `architecture-evidence`: Container view, ERD, README and walkthrough script cover the simulator,
  spend fixture and attribution fields.
- `deployment-evidence`: Phase 4 records the posted hosted cost, the redeployed revision's
  evidence, the hosted simulated-traffic demonstration and the walkthrough recording.

## Impact

- **Packages:** `packages/domain` gains the v3 intake/lead contracts, channel rules, spend fixture,
  traffic plan and v2 metrics; `packages/runtime` reads attribution for metrics and the dossier;
  `packages/evals` gains `phase-4.0`.
- **Applications:** `apps/api` accepts `intake-v3` and serves `metrics-report-v2`; `apps/web` gains
  the acquisition section, dossier attribution block and the hosted traffic control.
- **Scripts:** `scripts/seed-local.mjs` is replaced by the traffic simulator CLI.
- **Data:** a new system bundle and metrics window; local emulator data cleared; hosted synthetic
  data purged under the enumerated approval. No new collection, TTL policy or index.
- **Dependencies:** none; recharts 3.10.1 and zod 4.6.7 are already pinned.
- **Cloud:** one owner-approved build and deploy to the existing private service under the same
  CA$10 Cloud Run cap and project alert budget, only after the posted cost is recorded below the
  50% inspection point.
