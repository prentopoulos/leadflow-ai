workspace "LeadFlow AI" "Phase 5 local prototype and private hosted proof of concept with simulated acquisition and an opt-in agent team. Unrendered source of truth for component names; rendered views live in docs/diagrams." {

    !identifiers hierarchical

    model {
        operator = person "Operator" "Submits fictional intake, reviews drafts and reads stored metrics."

        leadflow = softwareSystem "LeadFlow AI" "Local synthetic intake, durable workflow, consent-gated drafts, human review and metrics." {
            web = container "Operator dossier" "Intake, runs and approval queue, run dossier with evidence, draft review and simulated attribution, and metrics with a SIMULATED acquisition section plus local agent-key setup; hosted, an owner-triggered simulated-traffic control." "React, Vite, Recharts" "Web"
            api = container "API process" "Node process that persists intake before any workflow step; loopback locally, one Cloud Run container when hosted." "Node 24" {
                routes = component "Fastify API" "Host/Origin-checked locally, IAP-assertion and allowlist-checked when hosted: intake, execution, runs, metrics, draft review and resume routes; local-only write-only key setup creates or updates the fixed gitignored .env; serves the web build when hosted." "Fastify"
                runtime = component "Workflow runtime" "Seven-node LangGraph workflow: qualify, enrich, compose, verify, simulate, finalize. Background executor locally; held inside the execution request (45 s deadline) when hosted. The normal local process is agent-capable but requires a backend key and the operator switch before the compose step can run the capped research and drafting team." "LangGraph.js"
                domain = component "Domain contracts" "Strict schemas, rubric-v1, the deterministic interpreter, the draft template, verification rules, metric definitions, channel-rules-v1, the synthetic-spend-v1 fixture, traffic-plan-v1, the agent claim verifier and paragraph rule checker." "Zod"
            }
            firestore = container "Firestore" "Sole durable store for leads, runs, events, checkpoints, evidence, drafts, reviews, verification and results. Emulator locally; the Toronto Standard database with seven-day TTL when hosted." "Firestore Emulator 1.22.0 locally; Firestore Standard, Native, northamerica-northeast2 hosted" "Database"
            evaluator = container "Offline evaluator" "Runs the fixed synthetic case corpus against the system bundle." "Node CLI" "Tool"
            simulator = container "Traffic simulator" "Feeds the fixed fictional traffic-plan-v1 through the real intake API at a steady pace with recorded enrichment; every channel, campaign, click ID and spend value is simulated." "Node CLI" "Tool"
        }

        vpic = softwareSystem "NHTSA vPIC" "Public vehicle API; GetModelsForMakeYear only." "External"
        zippopotam = softwareSystem "Zippopotam.us" "Public ZIP lookup (GeoNames data); /us/{zip} only." "External"
        anthropic = softwareSystem "Anthropic API" "Claude Sonnet 5.5 and Haiku 5.5 with web search for the opt-in agent team; owner-authorized, capped at $0.30 per lead and $8 per process." "External"
        deferred = softwareSystem "Deferred services" "Hosted model calls, outreach sending and real personal data. Not enabled." "Deferred"

        operator -> leadflow.web "Submits synthetic intake and reviews runs"
        leadflow.web -> leadflow.api.routes "Calls /v1 routes" "HTTP, loopback"
        leadflow.api.routes -> leadflow.firestore "Commits intake, claims runs and reads run detail" "Admin SDK, emulator"
        leadflow.api.routes -> leadflow.api.runtime "Starts or resumes the workflow after commit"
        leadflow.api.runtime -> leadflow.firestore "Writes checkpoints, events, results and simulation records" "Admin SDK, emulator"
        leadflow.api.runtime -> leadflow.api.domain "Scores, composes, verifies and simulates with"
        leadflow.api.runtime -> vpic "Reads model listings for make and year" "HTTPS GET, owner-authorized"
        leadflow.api.runtime -> zippopotam "Reads places for a ZIP Code" "HTTPS GET, owner-authorized"
        leadflow.api.runtime -> anthropic "Researches and drafts one cited paragraph from the vehicle, area and coded answers only" "HTTPS, opt-in, capped"
        leadflow.evaluator -> leadflow.api.domain "Checks fixed synthetic cases against"
        leadflow.simulator -> leadflow.api.routes "Submits simulated intake with synthetic attribution" "HTTP, loopback"
        leadflow.api.runtime -> deferred "Not enabled; gated by PROJECT.md" "" "Deferred"

        local = deploymentEnvironment "Local" {
            workstation = deploymentNode "Owner workstation" "Loopback only; synthetic data." "Windows 11" {
                vite = deploymentNode "Vite dev server" "127.0.0.1:5173" "Vite" {
                    containerInstance leadflow.web
                }
                node = deploymentNode "Node process" "127.0.0.1:3001" "Node 24" {
                    containerInstance leadflow.api
                }
                emulator = deploymentNode "Firestore Emulator" "127.0.0.1:8080" "Java 21" {
                    containerInstance leadflow.firestore
                }
            }
        }

        cloud = deploymentEnvironment "Private cloud" {
            project = deploymentNode "Google Cloud project" "Owner-only; no public principal; CA$10 Cloud Run cap and project alert budget." "Google Cloud" {
                region = deploymentNode "northamerica-northeast2" "Toronto." "Region" {
                    iap = infrastructureNode "Identity-Aware Proxy" "Direct IAP on the service; signs x-goog-iap-jwt-assertion; the IAP service agent is the only invoker." "Google IAP"
                    service = deploymentNode "Cloud Run service leadflow-ai-demo" "1 vCPU, 512 MiB, min 0, max 1, concurrency 8, 60 s, request-based billing; runtime identity leadflow-ai-runtime." "Cloud Run" {
                        containerInstance leadflow.web
                        containerInstance leadflow.api
                    }
                    database = deploymentNode "Firestore (default)" "Standard, Native; deny-all client rules; seven-day TTL; no backup or PITR." "Firestore" {
                        containerInstance leadflow.firestore
                    }
                    registry = infrastructureNode "Artifact Registry" "Repository leadflow-ai-demo; image app pinned by digest." "Artifact Registry"
                    build = infrastructureNode "Cloud Build" "Source-less build of one verified public commit; Cloud Logging only." "Cloud Build"
                    logs = infrastructureNode "Logging and Monitoring" "Platform request logs and metrics; no contact values or identities." "Google Cloud"

                    iap -> service "Forwards owner requests with a signed assertion" "HTTPS"
                    build -> registry "Pushes the image and records its digest"
                    registry -> service "Supplies the deployed digest"
                    service -> logs "Writes request status and latency"
                }
            }
        }
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

        deployment leadflow cloud "private-cloud" "The private hosted proof of concept in Toronto." {
            include *
            autoLayout lr
        }

        deployment leadflow local "local-deployment" "The credential-free local topology." {
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

        dynamic leadflow.api "enrichment-review" "Enrichment, drafting, verification and human review." {
            1: leadflow.api.runtime -> vpic "GET models for the lead's make and year"
            2: leadflow.api.runtime -> zippopotam "GET places for the lead's ZIP Code"
            3: leadflow.api.runtime -> leadflow.firestore "Stores evidence, the consent-gated draft and its verification"
            4: leadflow.web -> leadflow.api.routes "POST a review bound to the revision digest"
            5: leadflow.api.routes -> leadflow.firestore "Stores the review and its run event in one transaction"
            autoLayout lr
        }

        dynamic leadflow.api "agent-drafting" "The opt-in agent team inside the compose step." {
            1: leadflow.api.runtime -> anthropic "Lead plans; three workers search; lead merges kept claims"
            2: leadflow.api.runtime -> leadflow.api.domain "Verifies claims and checks the paragraph"
            3: leadflow.api.runtime -> leadflow.firestore "Stores the agent brief before paid calls, then links the drafted or fallback revision and verification"
            autoLayout lr
        }

        styles {
            element "Database" {
                shape cylinder
            }
            element "External" {
                border solid
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
