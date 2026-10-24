---
name: leadflow-ai-lead-quality-review
description: Design or review LeadFlow AI qualification scores, enrichment claims, verification results and dashboard metrics with reproducible evidence. Use when scoring, evidence, operational measures, or reported results change.
---

# LeadFlow AI lead-quality review

Read [PROJECT.md](../../../PROJECT.md) and the affected OpenSpec requirements. Follow
[leadflow-ai-build-safety](../leadflow-ai-build-safety/SKILL.md) when adapters, logging,
personal-data handling, or paid-call behavior also change. Apply
[leadflow-ai-ai-ops](../leadflow-ai-ai-ops/SKILL.md) to model or agent behavior.

## Define the question before running

Define each comparison before implementation: scored output versus the fixed 40/30/30 rubric;
priority label versus its owner-approved threshold; enrichment claim versus its source response;
verification outcome versus declared rules; and each dashboard value versus its stored-event query.
These are evidence of marketing readiness and workflow operation only, never insurance eligibility,
pricing, mailbox ownership, or sales conversion.

Use the same fixture, rubric version, schema, evidence policy, model bundle, retry budget, and metric
denominator for every candidate. Define meaningful differences and the trial plan before measuring;
select cases by the plan, never by favorable results. Label each case normal, edge, adversarial, or
deliberately failing, and label all synthetic inputs.

## Validate independently

Check schemas, finite values, ranges, enums, timestamps, identifiers, evidence references, and state
transitions before computing. Validate outputs with deterministic code independent of the agent or
query that produced them.

Every reviewed output must satisfy these invariants:

- criterion points are bounded by 40, 30, and 30 and total exactly their sum within 0–100;
- missing or ambiguous information cannot receive unsupported completeness or clarity points;
- priority follows the versioned owner-approved mapping and is not an insurance decision;
- enrichment preserves provider, subject, retrieval time, status, raw-evidence pointer, and failure;
- VIN/ZIP/email claims do not exceed what the named source actually establishes;
- consent false or absent produces no outreach draft, and every draft remains awaiting human approval;
- verification failures and partial/unavailable enrichments remain visible rather than becoming success;
- processing time uses declared start/end events and excludes no failed run without disclosure;
- success/failure rates name numerator, denominator, exclusions, time window, and fixture/live status;
- illustrative or fixture values never appear as unlabeled live operational results.

Establish correctness on tiny fixtures with known answers plus normal, edge, impossible, partial,
timeout, malformed-source, prompt-injection, duplicate-event, missing-consent, and failed-agent cases.
A timeout or empty result is unavailable, not negative evidence; no exception is not correctness.

## Fix evaluation before tuning

Freeze the rubric, priority mapping, evaluator version, held-out cases, budgets, retry policy, and
repetition plan before tuning. Deterministic arithmetic, consent, schema, evidence, and state checks
are hard gates. Model quality is a separate report and cannot override them. Keep every predeclared
case, including regressions. Paid calls stay outside ordinary CI and require the PROJECT gate.

Bind each AI result to code, dependency, prompt, schema, model, tool-contract, configuration, fixture,
and environment versions. Calibrate any model judge against independent human labels and report
per-case results, uncertainty, and missing cases.

## Record and compare honestly

Every result records fixture/lead ID or hash, rubric and metric-definition versions, code/dependency/
prompt/model/tool versions, source and retrieval time, configuration, token/request/retry budgets,
status, independent validation outcome, score/metric, timing, repetition, consent/approval state, and
whether evidence is fixture, mocked, local-live, or deployed-live. Missing values stay null with a
reason; an unrun live result is not zero.

Record failed runs. Statistics that exclude failures state their count and denominator. A small demo
establishes behavior only on tested cases, not production scale, conversion lift, or superiority.

## Interpret and deliver

Distinguish source fact, owner decision, assumption, proposal, fixture, and measured result. Explain
differences from traceable evidence alone, name the exact tested cases, and state remaining unknowns.
Completion is an independently checked finding with limits, even when a candidate regresses or a
provider is unavailable.
