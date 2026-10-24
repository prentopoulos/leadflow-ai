import {
  EnrichmentEvidenceSchema,
  EvidenceClassSchema,
  MarketingReadinessScoreSchema,
  OutreachExpectationSchema,
  RunStateSchema,
} from '@leadflow-ai/domain';
import type { EvalCase, EvalResult } from './schemas.js';

function demand(condition: unknown, message: string, assertions: string[]) {
  if (!condition) throw new Error(message);
  assertions.push(message);
}

export function evaluateCase(evaluationCase: EvalCase): EvalResult {
  if (evaluationCase.applicability === 'future') {
    return {
      caseId: evaluationCase.id,
      status: 'not_run',
      evidenceClass: 'synthetic-local',
      assertions: [],
      reason: evaluationCase.requirement,
    };
  }

  const assertions: string[] = [];
  try {
    switch (evaluationCase.kind) {
      case 'score-valid': {
        const value = MarketingReadinessScoreSchema.parse(
          evaluationCase.candidate,
        );
        demand(
          value.total === evaluationCase.expected.total,
          'score total matches expected value',
          assertions,
        );
        break;
      }
      case 'score-invalid':
        demand(
          !MarketingReadinessScoreSchema.safeParse(evaluationCase.candidate)
            .success,
          'invalid score is rejected',
          assertions,
        );
        break;
      case 'schema-invalid': {
        const schema =
          evaluationCase.expected.schema === 'run-state'
            ? RunStateSchema
            : EnrichmentEvidenceSchema;
        demand(
          !schema.safeParse(evaluationCase.candidate).success,
          'invalid structured output is rejected',
          assertions,
        );
        break;
      }
      case 'consent-contract': {
        const value = OutreachExpectationSchema.parse(evaluationCase.candidate);
        demand(
          value.sent === false,
          'automatic sending remains disabled',
          assertions,
        );
        if ('draft' in evaluationCase.expected) {
          demand(
            value.draft === evaluationCase.expected.draft,
            'draft presence matches consent contract',
            assertions,
          );
        }
        if (evaluationCase.expected.draftStatus) {
          demand(
            value.draft?.status === evaluationCase.expected.draftStatus,
            'draft awaits human approval',
            assertions,
          );
        }
        break;
      }
      case 'injection-contract': {
        const value = evaluationCase.candidate as Record<string, unknown>;
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
        const value = EnrichmentEvidenceSchema.parse(evaluationCase.candidate);
        demand(
          value.status === evaluationCase.expected.status,
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
        const value = RunStateSchema.parse(evaluationCase.candidate);
        demand(
          value.status === evaluationCase.expected.status,
          'run state remains visible',
          assertions,
        );
        demand(
          value.failures.length === evaluationCase.expected.failureCount,
          'run failures remain recorded',
          assertions,
        );
        break;
      }
      case 'event-sequence-contract': {
        const events = evaluationCase.candidate as Array<{
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
          EvidenceClassSchema.safeParse(evaluationCase.candidate).success,
          'evidence label is valid',
          assertions,
        );
        demand(
          evaluationCase.candidate === 'synthetic',
          'fixture remains labeled synthetic',
          assertions,
        );
        break;
      case 'future-runtime':
        throw new Error('future runtime case was incorrectly marked runnable');
    }

    return {
      caseId: evaluationCase.id,
      status: 'pass',
      evidenceClass: 'synthetic-local',
      assertions,
      reason: null,
    };
  } catch (error) {
    return {
      caseId: evaluationCase.id,
      status: 'fail',
      evidenceClass: 'synthetic-local',
      assertions,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function evaluateAll(cases: EvalCase[]) {
  return cases.map(evaluateCase);
}
