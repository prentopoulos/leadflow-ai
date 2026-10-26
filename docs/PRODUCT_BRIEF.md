# LeadFlow AI MVP brief

Recorded from Peter's setup request on 2026-10-23. PROJECT.md is the decision record and overrides
this source brief when they differ.

## Product outcome

LeadFlow AI is a GCP-hosted proof of concept for a Military.com-style auto-insurance lead funnel.
It saves a submitted lead, evaluates marketing readiness, enriches vehicle and location details,
drafts personalized follow-up only when contact consent exists, verifies outputs and security rules,
and presents progress and operational metrics for human review.

The customer identities are simulated. Agent execution, permitted external API enrichment, scoring,
and dashboard behavior should be functional. No email is automatically sent.

## Intended architecture

1. A Military.com-style React intake validates a submission.
2. Firestore stores the lead before downstream processing.
3. LangGraph.js coordinates qualification, enrichment, outreach, retries, failures, and structured
   JSON handoffs.
4. Qualification interprets intent, urgency, and completeness, then deterministic code calculates
   a 100-point marketing-readiness score: need timeline 40, request clarity 30, completeness 30.
5. Enrichment uses NHTSA for supplied VIN details, Zippopotam.us for ZIP-derived city/state, and
   bounded email syntax/domain validation without claiming mailbox ownership.
6. Outreach uses qualified, enriched data to produce a draft and recommended follow-up action only
   when consent exists.
7. Verification checks source evidence, structured outputs, security rules, and approval state.
8. A live dashboard shows leads, agent status/logs, evidence, draft approval state, and calculated
   operational KPIs.

## Dashboard measures

- total submitted leads;
- high/medium/low marketing-readiness distribution;
- average end-to-end processing time;
- enrichment success among attempted enrichments;
- failed agent runs among attempted runs;
- outreach drafts awaiting human approval.

Illustrative values such as Lead #1042, 90/100, New York, a 2023 Toyota Camry, and a draft to Alex
are presentation examples only. The MVP must populate these areas from actual stored runs or clearly
labeled synthetic fixtures.

## Requested stack

- React, Tailwind CSS, shadcn/ui, Recharts;
- Node.js, LangGraph.js, Claude or OpenAI API;
- Google Cloud Run, Firestore, Firebase Auth;
- NHTSA and Zippopotam.us APIs;
- validation, evidence verification, consent controls, run logs, and a human approval queue.

Use Google Cloud's eligible starter tier only after availability and cost are checked. Model/API
usage may incur separate charges.

## Delivery framing

The MVP should be secure, visually impressive, and demonstrable end to end in roughly one to two
development days. It should explain how agentic automation could reduce manual lead processing and
help marketing/sales prioritize opportunities without claiming insurance decisioning.

Do not add a Bayesian engine, fully autonomous self-hosted agents, or extra services without an
observed MVP need. Build this with the same spec-first, phase-gated, visual-review discipline used
for the owner's earlier `financial_research_agent` project, and prepare it for a later public GitHub
repository.

## Evidence still required

- Verify the current Military.com intake questions before finalizing the form or completeness rubric.
- ZIP and vehicle questions are described as confirmed by the owner.
- VIN and insurance-renewal timeline are not yet confirmed.
- Without insurer integrations, the MVP cannot produce genuine insurance quotes.
