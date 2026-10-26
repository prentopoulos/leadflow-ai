import {
  Phase0EnrichmentEvidenceSchema,
  EvidenceClassSchema,
  IntakeSubmissionSchema,
  MarketingReadinessScoreSchema,
  OutreachExpectationSchema,
  RunStateSchema,
  priorityForTotal,
  simulateOutcome,
  simulatedResponseRate,
} from '@leadflow-ai/domain';
import {
  DATASET_VERSION,
  EVALUATOR_VERSION,
  EvalCaseSchema,
  type EvalCase,
  type EvalResult,
} from './schemas.js';

function demand(condition: unknown, message: string, assertions: string[]) {
  if (!condition) throw new Error(message);
  assertions.push(message);
}

export function evaluateCase(evaluationCase: EvalCase): EvalResult {
  const parsedCase = EvalCaseSchema.parse(evaluationCase);
  const evidenceScope =
    parsedCase.applicability === 'future'
      ? ('not-run' as const)
      : (parsedCase.evidenceScope ?? 'pure-synthetic');
  if (parsedCase.applicability === 'future') {
    return {
      caseId: parsedCase.id,
      status: 'not_run',
      evidenceClass: 'synthetic-local',
      evidenceScope,
      datasetVersion: DATASET_VERSION,
      evaluatorVersion: EVALUATOR_VERSION,
      assertions: [],
      reason: parsedCase.requirement,
    };
  }

  const assertions: string[] = [];
  try {
    switch (parsedCase.kind) {
      case 'score-valid': {
        const value = MarketingReadinessScoreSchema.parse(parsedCase.candidate);
        demand(
          value.total === parsedCase.expected.total,
          'score total matches expected value',
          assertions,
        );
        break;
      }
      case 'score-invalid':
        demand(
          !MarketingReadinessScoreSchema.safeParse(parsedCase.candidate)
            .success,
          'invalid score is rejected',
          assertions,
        );
        break;
      case 'schema-invalid': {
        const schema =
          parsedCase.expected.schema === 'run-state'
            ? RunStateSchema
            : Phase0EnrichmentEvidenceSchema;
        demand(
          !schema.safeParse(parsedCase.candidate).success,
          'invalid structured output is rejected',
          assertions,
        );
        break;
      }
      case 'consent-contract': {
        const value = OutreachExpectationSchema.parse(parsedCase.candidate);
        demand(
          value.sent === false,
          'automatic sending remains disabled',
          assertions,
        );
        if ('draft' in parsedCase.expected) {
          demand(
            value.draft === parsedCase.expected.draft,
            'draft presence matches consent contract',
            assertions,
          );
        }
        if (parsedCase.expected.draftStatus) {
          demand(
            value.draft?.status === parsedCase.expected.draftStatus,
            'draft awaits human approval',
            assertions,
          );
        }
        break;
      }
      case 'injection-contract': {
        const value = parsedCase.candidate as Record<string, unknown>;
        demand(
          JSON.stringify(value.appliedWeights) === JSON.stringify([40, 30, 30]),
          'rubric weights remain fixed',
          assertions,
        );
        demand(
          value.consent === false,
          'untrusted text cannot create consent',
          assertions,
        );
        demand(
          value.sent === false,
          'untrusted text cannot authorize sending',
          assertions,
        );
        demand(
          value.evidenceClass === 'synthetic',
          'untrusted text cannot relabel evidence',
          assertions,
        );
        break;
      }
      case 'enrichment-contract': {
        const value = Phase0EnrichmentEvidenceSchema.parse(
          parsedCase.candidate,
        );
        demand(
          value.status === parsedCase.expected.status,
          'unavailable or failed evidence remains explicit',
          assertions,
        );
        demand(
          value.retrievedAt === null,
          'unavailable evidence has no fabricated retrieval time',
          assertions,
        );
        break;
      }
      case 'run-state-contract': {
        const value = RunStateSchema.parse(parsedCase.candidate);
        demand(
          value.status === parsedCase.expected.status,
          'run state remains visible',
          assertions,
        );
        demand(
          value.failures.length === parsedCase.expected.failureCount,
          'run failures remain recorded',
          assertions,
        );
        break;
      }
      case 'event-sequence-contract': {
        const events = parsedCase.candidate as Array<{
          id: string;
          state: string;
        }>;
        const ids = new Set(events.map((event) => event.id));
        const unique = ids.size === events.length;
        const persistedFirst = events[0]?.state === 'persisted';
        demand(
          !(unique && persistedFirst),
          'invalid or duplicate event sequence is rejected',
          assertions,
        );
        break;
      }
      case 'evidence-label-contract':
        demand(
          EvidenceClassSchema.safeParse(parsedCase.candidate).success,
          'evidence label is valid',
          assertions,
        );
        demand(
          parsedCase.candidate === 'synthetic',
          'fixture remains labeled synthetic',
          assertions,
        );
        break;
      case 'phase1-intake-contract': {
        const value = parsedCase.candidate as {
          valid: Record<string, unknown>;
          rejected: Array<Record<string, unknown>>;
          provenance: {
            exactSourceFields: string[];
            parityVerified: boolean;
          };
        };
        const accepted = IntakeSubmissionSchema.parse(value.valid);
        demand(
          accepted.identityClass === 'fictional' &&
            accepted.email.endsWith('@example.com'),
          'intake accepts only the declared fictional test-contact fixture',
          assertions,
        );
        demand(
          value.rejected.every(
            (override) =>
              !IntakeSubmissionSchema.safeParse({
                ...value.valid,
                ...override,
              }).success,
          ),
          'real contact, real identity, and unknown fields are rejected',
          assertions,
        );
        demand(
          JSON.stringify(value.provenance.exactSourceFields) ===
            JSON.stringify(['zipCode']) &&
            value.provenance.parityVerified === false,
          'ZIP remains the only exact source field and parity remains unverified',
          assertions,
        );
        break;
      }
      case 'phase1-persistence-contract': {
        const value = parsedCase.candidate as {
          beforeCommit: { records: string[]; processingStarted: boolean };
          afterCommit: { records: string[]; processingStarted: boolean };
          sameRequestReplay: {
            sameLead: boolean;
            sameRun: boolean;
            duplicateWork: boolean;
          };
          conflictingReplayRejected: boolean;
          duplicateEventRejected: boolean;
          pendingWriteReconciled: boolean;
          simulationIdentityStable: boolean;
        };
        demand(
          value.beforeCommit.records.length === 0 &&
            value.beforeCommit.processingStarted === false,
          'pre-commit failure leaves no records and starts no processing',
          assertions,
        );
        demand(
          JSON.stringify(value.afterCommit.records) ===
            JSON.stringify(['idempotency', 'lead', 'run', 'lead.persisted']) &&
            value.afterCommit.processingStarted === false,
          'intake commits the complete persistence set before processing',
          assertions,
        );
        demand(
          value.sameRequestReplay.sameLead &&
            value.sameRequestReplay.sameRun &&
            !value.sameRequestReplay.duplicateWork &&
            value.conflictingReplayRejected &&
            value.duplicateEventRejected &&
            value.pendingWriteReconciled &&
            value.simulationIdentityStable,
          'replays reconcile stable identities without duplicate logical effects',
          assertions,
        );
        break;
      }
      case 'phase1-rubric-contract': {
        const value = parsedCase.candidate as {
          thresholds: Array<[number, string]>;
          timelinePoints: number[];
          clarityWeights: number[];
          completenessWeights: number[];
          consentPair: { withoutConsent: number; withConsent: number };
          invalidEvidence: {
            priority: null;
            total: null;
            held: boolean;
          };
          meaning: string;
        };
        demand(
          value.thresholds.every(
            ([total, priority]) => priorityForTotal(total) === priority,
          ),
          'priority thresholds match rubric-v1 at 49, 50, 79, and 80',
          assertions,
        );
        demand(
          JSON.stringify(value.timelinePoints) ===
            JSON.stringify([40, 30, 20, 10, 0]) &&
            JSON.stringify(value.clarityWeights) ===
              JSON.stringify([15, 10, 5]) &&
            JSON.stringify(value.completenessWeights) ===
              JSON.stringify([5, 5, 4, 4, 4, 4, 4]),
          'rubric-v1 subcriterion mappings remain fixed at 40/30/30',
          assertions,
        );
        demand(
          value.consentPair.withoutConsent === value.consentPair.withConsent,
          'contact consent does not change qualification points',
          assertions,
        );
        demand(
          value.invalidEvidence.held &&
            value.invalidEvidence.priority === null &&
            value.invalidEvidence.total === null,
          'invalid evidence holds both score and priority',
          assertions,
        );
        demand(
          value.meaning ===
            'marketing readiness only; not an insurance decision',
          'qualification meaning excludes insurance decisions',
          assertions,
        );
        break;
      }
      case 'phase1-recovery-contract': {
        const value = parsedCase.candidate as {
          crashBeforeCommit: {
            recordCount: number;
            processingStarted: boolean;
          };
          crashAfterCommit: { status: string; processingStarted: boolean };
          transientRetry: {
            attempts: number;
            retryCount: number;
            thirdAttempt: boolean;
          };
          retryExhaustion: { status: string; attempts: number };
          nonRetryable: { status: string; attempts: number };
          missingCheckpointRejected: boolean;
          incompatibleCheckpointRejected: boolean;
          staleRevisionRejected: boolean;
          leaseRaceWinnerCount: number;
        };
        demand(
          value.crashBeforeCommit.recordCount === 0 &&
            !value.crashBeforeCommit.processingStarted,
          'crash before commit rolls back without processing',
          assertions,
        );
        demand(
          value.crashAfterCommit.status === 'persisted' &&
            !value.crashAfterCommit.processingStarted,
          'crash after commit retains an explicitly resumable persisted run',
          assertions,
        );
        demand(
          value.transientRetry.attempts === 2 &&
            value.transientRetry.retryCount === 1 &&
            !value.transientRetry.thirdAttempt,
          'the typed transient path has one retry and no third attempt',
          assertions,
        );
        demand(
          value.retryExhaustion.status === 'failed_retryable' &&
            value.retryExhaustion.attempts === 2,
          'exhausted transient retry remains a visible retryable failure',
          assertions,
        );
        demand(
          value.nonRetryable.status === 'failed_terminal' &&
            value.nonRetryable.attempts === 1,
          'non-retryable failure terminates on the first attempt',
          assertions,
        );
        demand(
          value.missingCheckpointRejected &&
            value.incompatibleCheckpointRejected &&
            value.staleRevisionRejected &&
            value.leaseRaceWinnerCount === 1,
          'checkpoint, revision, and lease controls reject unsafe recovery',
          assertions,
        );
        break;
      }
      case 'phase1-simulator-contract': {
        const value = parsedCase.candidate as {
          runId: string;
          generatedAt: string;
          comparedScores: number[];
          idempotentStorage: boolean;
          outboundAction: boolean;
        };
        const first = simulateOutcome(value);
        const repeated = simulateOutcome(value);
        demand(
          JSON.stringify(first) === JSON.stringify(repeated),
          'the same run and simulator version produce the same outcome',
          assertions,
        );
        demand(
          value.comparedScores.length === 2 &&
            !('score' in first) &&
            !('priority' in first),
          'simulation output is independent of qualification score and priority',
          assertions,
        );
        demand(
          value.idempotentStorage && !value.outboundAction,
          'simulation storage is idempotent and has no outbound authority',
          assertions,
        );
        demand(
          first.evidenceClass === 'synthetic' &&
            first.notices.includes('not_live') &&
            first.notices.includes('not_predictive'),
          'simulation remains synthetic, not live, and not predictive',
          assertions,
        );
        const emptyMetric = simulatedResponseRate([]);
        demand(
          emptyMetric.value === null &&
            emptyMetric.reason === 'insufficient_data',
          'empty simulation denominators remain unknown with a reason',
          assertions,
        );
        break;
      }
      case 'phase1-privacy-contract': {
        const value = parsedCase.candidate as {
          eventFields: string[];
          forbiddenFields: string[];
          safeErrorMessage: string;
          rawErrorPresent: boolean;
          invalidEvidenceLabels: string[];
        };
        demand(
          value.forbiddenFields.every(
            (field) => !value.eventFields.includes(field),
          ),
          'routine event fields exclude contact, prompt, secret, and stack data',
          assertions,
        );
        demand(
          !value.rawErrorPresent && value.safeErrorMessage.length <= 240,
          'operator errors are bounded and contain no raw exception',
          assertions,
        );
        demand(
          value.invalidEvidenceLabels.every(
            (label) => !EvidenceClassSchema.safeParse(label).success,
          ),
          'unsupported live, verified, and production evidence labels are rejected',
          assertions,
        );
        break;
      }
      case 'phase1-reset-contract': {
        const value = parsedCase.candidate as {
          denials: Array<{ reason: string; deleteCalled: boolean }>;
          allowed: {
            projectId: string;
            host: string;
            requester: string;
            confirmedDeletion: boolean;
          };
        };
        demand(
          value.denials.length === 4 &&
            value.denials.every((denial) => !denial.deleteCalled),
          'every reset denial makes no delete call',
          assertions,
        );
        demand(
          value.allowed.projectId === 'demo-leadflow-ai-local' &&
            value.allowed.host === '127.0.0.1:8080' &&
            value.allowed.requester === '127.0.0.1' &&
            value.allowed.confirmedDeletion,
          'only the exact loopback synthetic project boundary can reset',
          assertions,
        );
        break;
      }
      case 'phase1-ui-contract': {
        const expectedStates = [
          'loading',
          'empty',
          'validation_error',
          'persistence_error',
          'in_progress',
          'retrying',
          'partial',
          'failed_retryable',
          'failed_terminal',
          'complete',
          'stale',
          'long_content',
        ];
        demand(
          JSON.stringify(parsedCase.candidate) ===
            JSON.stringify(expectedStates),
          'UI fixture manifest contains every required state in fixed order',
          assertions,
        );
        break;
      }
      case 'bundle-freshness-contract': {
        const value = parsedCase.candidate as {
          recordedDigest: string;
          currentDigest: string;
        };
        if (value.recordedDigest !== value.currentDigest) {
          return {
            caseId: parsedCase.id,
            status: 'stale',
            evidenceClass: 'synthetic-local',
            evidenceScope,
            datasetVersion: DATASET_VERSION,
            evaluatorVersion: EVALUATOR_VERSION,
            assertions,
            reason: 'bundle-bearing input changed; evidence must be rerun',
          };
        }
        demand(
          /^[a-f0-9]{64}$/u.test(value.currentDigest),
          'current bundle digest is valid and matches recorded evidence',
          assertions,
        );
        break;
      }
      case 'future-runtime':
        throw new Error('future runtime case was incorrectly marked runnable');
    }

    // Emulator and rendered cases hold declared observations. This offline
    // run can prove them consistent but did not measure them, so it must not
    // report a pass; the measured evidence comes from the named probe.
    const measuredElsewhere =
      evidenceScope === 'local-emulator' || evidenceScope === 'rendered-local';
    return {
      caseId: parsedCase.id,
      status: measuredElsewhere ? 'not_run' : 'pass',
      evidenceClass: 'synthetic-local',
      evidenceScope,
      datasetVersion: DATASET_VERSION,
      evaluatorVersion: EVALUATOR_VERSION,
      assertions,
      reason: measuredElsewhere
        ? evidenceScope === 'local-emulator'
          ? 'Declared observations are consistent; measured by pnpm emulator:runtime, not this offline run.'
          : 'Declared observations are consistent; measured by rendered local review, not this offline run.'
        : null,
    };
  } catch (error) {
    return {
      caseId: parsedCase.id,
      status: 'fail',
      evidenceClass: 'synthetic-local',
      evidenceScope,
      datasetVersion: DATASET_VERSION,
      evaluatorVersion: EVALUATOR_VERSION,
      assertions,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function evaluateAll(cases: EvalCase[]) {
  return cases.map(evaluateCase);
}
