## Context

Phase 3 is merged: one private Cloud Run service behind direct IAP serves the web app and API,
Firestore in Toronto holds seven-day synthetic data, and hosted demonstrations use recorded
enrichment. The local path is unchanged: the Firestore Emulator, a loopback Fastify API and
`pnpm seed:local`, which submits 40 fixed fictional `intake-v2` leads with fixed idempotency keys.
Metrics are computed from stored runs under `metrics-definitions-v1`, scoped to the current system
bundle, with `insufficient_data` for empty denominators and simulator outcomes kept in a separate
SYNTHETIC panel.

Peter set the Phase 4 direction on 2026-10-27 and accepted all nine round-1 owner calls and ten
settled answers the same day (PROJECT.md § Phase 4 decisions). Hosting was extended through
Phase 4 under the same CA$10 Cloud Run cap and project alert budget. The 09:45 reading on
2026-10-27 showed CA$0.00 everywhere, but under 24 hours after the last hosted activity, so the
cost stays pending until it is rechecked.

## Goals / Non-Goals

**Goals:**

- Store a validated, strictly synthetic attribution on each simulated lead without a new
  collection, TTL policy or cloud mutation.
- Map attribution to channels by a fixed, testable rule table and report cost per lead and cost per
  qualified lead from stored leads and a reviewed spend fixture, with every definition stated.
- Feed fictional leads at a steady pace locally and on the hosted service without new credentials
  or unattended execution.
- Demonstrate the result on the hosted service under the existing cost controls and record the
  walkthrough.

**Non-Goals:** as listed in the proposal. In short: no real advertising data, no URL capture, no
revenue or funnel-stage costing, no methodology change to scoring, drafts or consent, no unattended
run, no fourth view.

## Decisions

### 1. Attribution lives on the lead (`intake-v3`, `lead-v3`)

`attribution` is an optional strict object on the intake: `source`, `medium` and `campaign`
match `^[a-z0-9()][a-z0-9._()-]{0,63}$`; `clickId` is null or `sim-` plus 20 lowercase hex
characters, with the literal `clickIdClass: "synthetic"` whenever a click ID is present. Unknown
keys are rejected. The stored lead carries the normalized object; the channel is derived on read
from `channel-rules-v1`, so a rules change never rewrites stored data. The intake form sends
`attribution: null`. Attribution fields join the provenance `demoFields` list as LeadFlow simulated
data, never Military.com fields.

Alternatives: a separate `attributionRecords` collection needs a 16th collection group, a hosted
TTL policy and index exemption (a cloud mutation) and a second transactional write; script-only
metadata hides the contract from validation. Both lose.

Compatibility: `intake-v2` is rejected and strict `lead-v3` reads reject `lead-v2`. Local emulator
data is cleared (Phase 2 precedent). Hosted synthetic data is purged with the existing guarded
purge before the Phase 4 deploy; it would expire by about 2026-11-02 anyway, and Phase 3 evidence
lives in the repository. A dual-schema reader was rejected as code kept for data that expires
within a week.

### 2. `channel-rules-v1`

Evaluated in order, first match wins:

| Channel | Rule |
|---|---|
| Direct | source `(direct)` and medium `(none)` (GA4's `(not set)` contains a space, which the slug rule refuses) |
| Paid Search | source in the search list (`google`, `bing`) and a paid medium |
| Paid Social | source in the social list (`facebook`, `instagram`, `linkedin`) and a paid medium |
| Email | source or medium `email`, or medium `newsletter` |
| Affiliates | medium `affiliate` |
| Organic Search | medium `organic` |
| Unassigned | attribution present, no rule matched |
| Unattributed | no attribution object (LeadFlow label, not a GA4 channel) |

A paid medium is `cpc`, `ppc`, `paid_social`, `retargeting`, or any medium starting with `paid`.
The table adapts GA4's published default channel-group rules (retrieved 2026-10-26) without its
site lists; the dashboard says "rules adapted from GA4's default channel group; not GA4 data".

### 3. Simulated campaigns and `synthetic-spend-v1`

The fixture is a checked-in, versioned domain constant labelled "simulated, illustrative, not a
benchmark", in integer simulated-USD cents:

| Source / medium | Campaign | Channel | Flight spend |
|---|---|---|---|
| google / cpc | `sim-search-auto-insurance-q4` | Paid Search | 120000 |
| facebook / paid_social | `sim-social-pcs-move` | Paid Social | 80000 |
| milspouse-blog / affiliate | `sim-affiliate-partner-guide` | Affiliates | 40000 |
| newsletter / email | `sim-email-veterans-day` | Email | 15000 |
| google / organic | `(organic)` | Organic Search | 0 |
| (direct) / (none) | `(direct)` | Direct | 0 |

A test proves each campaign's channel under `channel-rules-v1`, non-negative integer cents and
unique campaigns. Spend is a flight total for the fixed traffic plan, not daily spend.

Alternatives: cost-per-click times simulated clicks adds a click model and conversion rate; spend
written at run time adds a write API and makes spend runtime-mutable; daily spend is meaningless
for a ten-minute flight; pro-rating spend by stored leads makes CPL constant by construction.

### 4. `metrics-definitions-v2` acquisition block

All values are computed in integer cents from stored leads of the current system bundle (the
existing window) and the fixture, and each names numerator, denominator, exclusions and window:

- Blended CPL = total fixture spend ÷ all persisted leads in the window, including unattributed
  leads and failed runs; both counts are reported.
- Per-channel and per-campaign CPL = that group's spend ÷ its leads.
- A qualified lead is one whose latest qualification priority is `high` or `standard`; held,
  nurture and not-scored leads are excluded. Label: "marketing-qualified (high or standard
  readiness)". CPQL = spend ÷ qualified leads, blended and per channel.
- Zero-spend groups report `no_spend` and display "n/a, no spend", never 0.00.
- An empty denominator returns `null` with `insufficient_data`.
- The report includes `plannedLeads` (60) and `storedLeads` so the view shows "k of 60 planned
  leads stored"; CPL falls as a flight fills, and the view says so.
- The block carries `evidenceClass: "synthetic"` and the fixture and rules versions.
- Added by the owner during implementation (2026-10-27): qualified-lead rate (qualified ÷
  leads), cost per contactable lead (spend ÷ leads with recorded email consent) and, per channel,
  spend share (channel spend ÷ total spend) against lead share (channel leads ÷ all leads). Shares
  and rates are `insufficient_data` on an empty denominator. Click-, revenue- and
  appointment-based measures are excluded because no clicks or revenue exist and `simulator-v1`
  outcomes are score-independent.

The existing v1 metrics keep their definitions under the new version name; only the acquisition
block is new. Arithmetic rounds half up to whole cents at display only.

### 5. `traffic-plan-v1` and the simulator

A pure domain generator returns 60 planned leads in fixed order. Lead content reuses the existing
seed generator (only recorded vehicle and ZIP subjects; fictional identities under `example.org`).
Attribution is assigned by a seeded permutation over the campaign mix, independent of lead content,
so channel differences reflect spend and assignment, not lead quality; the view states this. The
mix is fixed in the plan (for example 18 paid search, 12 paid social, 9 affiliate, 6 email,
9 organic, 6 direct). Click IDs exist only for paid-search and paid-social leads and are derived as
`sim-` + the first 20 hex of SHA-256 over plan version and index.

`pnpm simulate:traffic` (replacing `pnpm seed:local`) posts to `127.0.0.1:3001`, refuses unless the
running bundle is `recorded`, uses a default interval of 10 s (0–60 s allowed) and `--count` up to
60, and uses idempotency keys `traffic-v1-<bundle8>-<nn>`, so a rerun adds nothing. It prints
created and replayed counts.

Hosted mode: a Node script cannot reach direct IAP without allowlisting an OAuth client for
programmatic access or adding a service-account subject; both were declined. The hosted app
therefore gets an owner-triggered "Run simulated traffic" control that runs the same plan in the
signed-in tab: intake, then the existing held execution request, then wait for the interval, then
the next lead. It is sequential, labelled SIMULATED, has Stop, pauses while the tab is hidden and
never runs without the open tab. The control appears only in hosted mode and uses the same
idempotency keys.

### 6. Presentation

The metrics view gains an "Acquisition — SIMULATED" section below the operational metrics, with a
persistent label "synthetic spend fixture · fictional leads":

- two headline tiles: blended CPL and cost per qualified lead, each with n, spend and the
  planned-lead progress;
- a per-channel table (leads, qualified, spend, CPL, CPQL, including Unattributed) as the chart's
  text equivalent;
- a horizontal Recharts bar chart of CPL by channel with direct value labels, no colour-only
  encoding, 3:1 marks and no animation under reduced motion;
- a campaign table behind a disclosure;
- the definitions text beside the values and the channel-rules and independence notes.

The run dossier gets an "Acquisition (simulated)" block with channel, source/medium, campaign and
click ID. Click IDs appear nowhere else: not in summaries, metrics, events or logs.

### 7. Attribution isolation

Attribution is read only by metrics and the dossier. It never enters `rubric-v1`, the interpreter,
draft composer slots, verification text, `event-v1`, lifecycle reports, logs or a model input. A
`phase-4.0` case proves a lead scores identically with and without attribution.

### 8. Evaluation, bundle and documentation

The system bundle records `intake-v3`, `lead-v3`, `metrics-definitions-v2`, `metrics-report-v2`,
`channel-rules-v1`, `synthetic-spend-v1` and `traffic-plan-v1`; a new bundle opens a new metrics
window. `phase-4.0` keeps every earlier case ID (retained intake fixtures port to v3 with
`attribution: null`) and adds the cases listed in the offline-evaluation delta, fixed before
implementation measures them. The Structurizr model gains the simulator and spend fixture and the
ERD the lead attribution fields, rendered with `pnpm docs:diagrams`. AI_OPS, the runbook, a README
"Simulated acquisition" subsection and `docs/walkthrough.md` (about 15 s of acquisition scenes,
intake-first opening kept) are updated.

### 9. Hosted demonstration

Task 1 records the posted Phase 3 cost (pending with a reason if not yet posted, never zero by
default). Only if it is below the 50% inspection point does the owner receive one enumerated
approval request covering: the guarded purge of hosted synthetic data; one source-less Cloud Build
of the exact Phase 4 commit; a deploy of its digest to `leadflow-ai-demo` under the same CA$10 cap
and alert budget; reruns of smokes 5–6 and the rollback section for the new revision (runbook § What
makes evidence stale); the hosted simulated traffic; `docs/evidence/phase-4/index.json`; and the
walkthrough recording. The owner's approval of that evidence starts the seven-day teardown clock.
If cost reaches 50%, the demonstration and recording fall back to local only.

The metrics endpoint re-reads every run's records on each 3 s poll, so an open hosted dashboard can
use the 50,000 reads/day Firestore free tier in about a minute (estimated from code, not measured).
The pre- and post-demo cost checks record Firestore reads; if they cost money, the hosted metrics
poll slows to 15 s rather than adding a cache.

## Risks / Trade-offs

- [Blended CPL looks high early in a flight] → The view shows planned-lead progress and states that
  spend is a flight total.
- [Readers take simulated channel differences as findings] → Random, content-independent assignment;
  SIMULATED labels; an explicit "not channel quality" note.
- [Strict v3 reads break on old hosted data] → Guarded purge before deploy, inside the enumerated
  approval; local emulator cleared.
- [Hosted Firestore reads cost money while the dashboard is open] → Measured in the cost checks;
  fallback to a 15 s hosted poll.
- [Billing posts late] → Cost stays pending with a reason; the hosted approval waits for the posted
  amount.
- [A pasted real click ID] → Schema accepts only `sim-` + hex with `clickIdClass: "synthetic"`.

## Migration Plan

1. Local: stop the API, reset the emulator, start the API in recorded mode, run
   `pnpm simulate:traffic`.
2. Hosted (after approval): guarded purge, build the exact commit, deploy its digest, rerun smokes
   5–6 and rollback, run the hosted traffic control, record evidence.
3. Rollback: route traffic back to the Phase 3 revision A. Its strict `lead-v2` reader would reject
   any `lead-v3` records, so a rollback is followed by the guarded purge.

## Open Questions

None. Spend amounts, campaign names and the traffic mix are accepted as listed (2026-10-27).

## Non-negotiables check

| Rule or gate | How the design keeps it |
|---|---|
| Secrets | No new secret or credential; hosted traffic uses the existing IAP browser session. |
| No fabrication; honest labels | Spend is a labelled synthetic fixture; leads are stored run data; every acquisition value says SIMULATED; cost stays pending until posted. |
| Operator resolves gates | The hosted purge, build, deploy and demo need one enumerated owner approval after the cost is recorded. |
| Marketing readiness only | "Qualified" means high or standard marketing readiness; no eligibility, price or risk wording. |
| Fictional data | Fictional identities; `sim-` click IDs enforced by schema; real ad/analytics data out of scope. |
| Persist before execution | Unchanged; the simulator uses the same intake and execution path. |
| Consent and human approval; no sending | Drafts still wait in `pending_review`; no send path is added. |
| Minimise model data; structured outputs | Attribution never reaches a model input; no model is used. |
| Deterministic rubric | Attribution never changes points or priority; a case proves it. |
| Military.com claims | Attribution is labelled LeadFlow simulated data, not a Military.com field. |
| Metrics from stored data or labelled fixtures | CPL numerators come from the labelled fixture and denominators from stored leads. |
| Accessible UI | WCAG 2.2 AA at desktop and 390 px; table equivalents; reduced motion; design review. |
| Paid API gate | Not touched. |
| Deployment gate | Same private service, cap and budget; separate enumerated approval. |
| Real personal data gate | Not touched; real click IDs and ad data stay behind it. |
| External communication gate | Not touched. |
| Intake parity gate | Not touched. |
