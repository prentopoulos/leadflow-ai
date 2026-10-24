---
name: leadflow-ai-build-safety
description: Apply relevant engineering workflows to LeadFlow AI architecture, dependencies, adapters, personal-data boundaries, cost controls, telemetry and phase readiness. Use for those boundaries, not as a mandatory full audit of every edit.
---

# LeadFlow AI build safety

Read [PROJECT.md](../../../PROJECT.md) and the affected OpenSpec design/tasks. Follow current
scope and existing authorization. This skill grants no spending, publication or data-transfer
permission and adds no per-edit approval ritual.

The full 17-workflow Agent Builder collection is preserved under
[agent-builder](agent-builder/README.md). **First read the project adaptation below**, then the
[shared contract](agent-builder/FOUNDATION_CONTRACT.md), [baseline](agent-builder/SECURITY_BASELINE.md)
and only workflows relevant to the current boundary. Source examples are not project defaults.

## Project adaptation

- PROJECT owns scope, decisions and operator gates; OpenSpec owns requirements/design/tasks.
  Apply source questions to those records and actual code. Do not create a competing YAML
  project spec, mandatory catalog, or 17 separate result envelopes.
- Source frameworks, cloud defaults, inventory examples, sample budgets and evaluation counts
  are illustrative. Use this project's actual stack, lockfile and gate.
- Current target: a local-first proof of concept for one demo operator. GCP exposure, multiple users,
  live models, real personal data, public GitHub, paid quota, and external communication are deferred
  behind PROJECT gates, not silently implemented.
- Here, tools are typed adapters to models, Firestore/Auth, NHTSA, ZIP, and email-domain checks;
  evaluation means deterministic rubric/schema/security cases plus separately budgeted model cases;
  system versions bind code, dependencies, prompts, schemas, model, tool contracts, and environment;
  tracing means lead/workflow/agent/verification events without secrets or unnecessary personal data.
- Lead persistence precedes agent execution. Marketing readiness, evidence verification, consent, and
  human approval are hard boundaries; outreach remains draft-only and no insurer decisioning exists.
- Paid usage, real personal data, deployment/public exposure, public GitHub publication, external
  communication, and Military.com parity claims remain operator-gated. A mock or document closes none.
- Use existing artifacts for small reviews. Substantial reviews go in docs/reviews with
  scope/revision, applicability, findings, evidence, owner, next action and recheck trigger.

Read [leadflow-ai-ai-ops](../leadflow-ai-ai-ops/SKILL.md) for system versioning, evaluation,
agent runtime, provider routing, persistent state, monitoring and recovery.

## Route the work

| LeadFlow boundary | Complete workflows to read in agent-builder |
|---|---|
| Architecture and phase scope | validate_architecture_spec.md, Architecturebuild.md |
| Dependencies and package structure | resolve_stack_dependencies.md, scaffold_repo_tree.md |
| Tools, external APIs and adapters | select_adk_tools.md, generate_tool_schema.md |
| Intake, prompts, credentials, real data, or exposure | assess_threat_vectors.md, design_pii_redaction.md; map_rbac_policies.md when Firebase roles exist |
| Run records, logs and versioned assets | configure_telemetry_schema.md, generate_asset_metadata.md |
| Paid calls, quotas or time budgets | apply_finops_governance.md |
| Evaluation and readiness | generate_eval_metrics.md, define_release_gates.md, orchestrate_ci_cd.md |
| Cloud Run/Firestore/Auth infrastructure (deferred until deployment design) | design_iac_blueprint.md |
| LLM prompts or agent behavior | standardize_system_prompt.md plus relevant tool/data workflows |

Source filenames above resolve in [agent-builder/](agent-builder/README.md).
Read [leadflow-ai-lead-quality-review](../leadflow-ai-lead-quality-review/SKILL.md) for
qualification, enrichment, verification, and dashboard-metric evidence.
For an explicitly comprehensive review account for all 17 workflows; for normal work record
only the relevant scope. Deferred controls must be revisited when their capability is added.

## Completion

Trace each material failure to a control, enforcement point, test and requirement. Separate
proposed, implemented, tested and externally verified. Unknown usage stays null; a mock or
local run is not a live result. Preserve failed evidence and unresolved dependencies.

[Source manifest](references/source-manifest.json) records the exact Agent Builder copies.
