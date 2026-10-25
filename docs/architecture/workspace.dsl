workspace "LeadFlow AI" "Phase 1 local intake-to-qualification prototype. Unrendered source of truth for component names; rendered views live in docs/diagrams." {

    !identifiers hierarchical

    model {
        operator = person "Operator" "Submits fictional intake and reviews stored runs."

        leadflow = softwareSystem "LeadFlow AI" "Local synthetic intake, durable qualification workflow and run dossier." {
            web = container "Operator dossier" "Intake form, run state, score, evidence and simulation views." "React, Vite" "Web"
            api = container "API process" "Loopback Node process that persists intake before any workflow step." "Node 24" {
                routes = component "Fastify API" "Health, intake, run detail, resume and guarded reset routes." "Fastify"
                runtime = component "Qualification runtime" "Fixed LangGraph workflow with leases, bounded retry, explicit resume and a Firestore checkpointer." "LangGraph.js"
                domain = component "Domain contracts" "Strict schemas, rubric-v1, the deterministic interpreter stub and simulator-v1." "Zod"
            }
            firestore = container "Firestore Emulator" "Sole durable store for leads, runs, events, checkpoints, idempotency, bundles, results and simulation records." "Firestore Emulator 1.22.0, 127.0.0.1:8080" "Database"
            evaluator = container "Offline evaluator" "Runs the fixed synthetic case corpus against the system bundle." "Node CLI" "Tool"
        }

        deferred = softwareSystem "Deferred services" "Model provider, live enrichment, cloud Firestore and Auth. Not enabled in Phase 1." "Deferred"

        operator -> leadflow.web "Submits synthetic intake and reviews runs"
        leadflow.web -> leadflow.api.routes "Calls /v1 routes" "HTTP, loopback"
        leadflow.api.routes -> leadflow.firestore "Commits intake, claims runs and reads run detail" "Admin SDK, emulator"
        leadflow.api.routes -> leadflow.api.runtime "Starts or resumes the workflow after commit"
        leadflow.api.runtime -> leadflow.firestore "Writes checkpoints, events, results and simulation records" "Admin SDK, emulator"
        leadflow.api.runtime -> leadflow.api.domain "Interprets, scores and simulates with"
        leadflow.evaluator -> leadflow.api.domain "Checks fixed synthetic cases against"
        leadflow.api.runtime -> deferred "Not enabled; gated by PROJECT.md" "" "Deferred"
    }

    views {
        systemContext leadflow "context" "Who uses LeadFlow AI and which services stay deferred." {
            include *
            autoLayout lr
        }

        container leadflow "containers" "What runs on the local workstation." {
            include *
            autoLayout lr
        }

        component leadflow.api "api-components" "Inside the loopback API process." {
            include *
            autoLayout lr
        }

        dynamic leadflow.api "persist-before-processing" "The intake commit precedes every workflow step." {
            1: leadflow.web -> leadflow.api.routes "POST /v1/intake with an Idempotency-Key"
            2: leadflow.api.routes -> leadflow.firestore "Commits idempotency, lead, run and first event in one transaction"
            3: leadflow.api.routes -> leadflow.firestore "Claims the run lease at the expected revision"
            4: leadflow.api.routes -> leadflow.api.runtime "Invokes the qualification graph for the run"
            5: leadflow.api.runtime -> leadflow.api.domain "Interprets, scores and simulates"
            6: leadflow.api.runtime -> leadflow.firestore "Writes a checkpoint and lifecycle event per step"
            7: leadflow.api.runtime -> leadflow.firestore "Writes the result, simulation record and completion"
            autoLayout lr
        }

        dynamic leadflow.api "recovery" "Bounded retry, durable failure and explicit operator resume." {
            1: leadflow.api.runtime -> leadflow.firestore "Records one retry after the first transient fault"
            2: leadflow.api.runtime -> leadflow.firestore "Records failed_retryable when the fault persists"
            3: leadflow.web -> leadflow.api.routes "POST /v1/runs/{runId}/resume"
            4: leadflow.api.routes -> leadflow.firestore "Checks revision, lease and checkpoint compatibility"
            5: leadflow.api.routes -> leadflow.api.runtime "Resumes from the stored checkpoint"
            autoLayout lr
        }

        styles {
            element "Database" {
                shape cylinder
            }
            element "Deferred" {
                border dashed
                opacity 60
            }
            relationship "Deferred" {
                style dashed
            }
        }
    }

}
