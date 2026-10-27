import {
  CONTRACT_VERSIONS,
  METRICS_DEFINITIONS,
  METRICS_WINDOW_LIMIT,
  MetricsReportSchema,
  RunListResponseSchema,
  acquisitionReport,
  isResumeEligible,
  type EnrichmentEvidence,
  type EnrichmentMetric,
  type MetricsReport,
  type RateValue,
  type RunDocument,
  type RunListFilter,
  type RunListResponse,
  type RunSummary,
  type WorkflowStep,
} from '@leadflow-ai/domain';
import type { Firestore } from 'firebase-admin/firestore';
import type { DraftHistory } from './drafts.js';
import type { FirestoreRepositories } from './repositories.js';
import type { RunEventReader } from './run-detail.js';
import { withoutRetention } from './retention.js';

export interface RunReader {
  list(limit: number): Promise<unknown[]>;
}

export class AdminRunReader implements RunReader {
  constructor(private readonly database: Firestore) {}

  async list(limit: number): Promise<unknown[]> {
    const snapshot = await this.database
      .collection('runs')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((document) => withoutRetention(document.data()));
  }
}

export class OperationsIntegrityError extends Error {
  readonly code = 'operations_integrity_failed' as const;

  constructor(message = 'Stored operations records are inconsistent.') {
    super(message);
    this.name = 'OperationsIntegrityError';
  }
}

export class MetricsWindowExceededError extends Error {
  readonly code = 'window_exceeded' as const;

  constructor() {
    super('The retained metrics window exceeds 2,000 runs.');
    this.name = 'MetricsWindowExceededError';
  }
}

export interface OperationsDependencies {
  repositories: FirestoreRepositories;
  runs: RunReader;
  events: RunEventReader;
  drafts: { history(draftId: string): Promise<DraftHistory | null> };
  now?: () => string;
}

const workflowSteps: WorkflowStep[] = [
  'interpret_qualification',
  'score_qualification',
  'enrich_lead',
  'compose_draft',
  'verify_outputs',
  'simulate_outcome',
  'finalize_run',
];
const finishedStatuses = new Set<RunDocument['status']>([
  'complete',
  'failed_retryable',
  'failed_terminal',
]);

function rate(numerator: number, denominator: number, excluded = 0): RateValue {
  return {
    value: denominator === 0 ? null : numerator / denominator,
    numerator,
    denominator,
    excluded,
    reason: denominator === 0 ? 'insufficient_data' : null,
  };
}

function durationSummary(values: number[], excluded: number) {
  if (values.length === 0) {
    return {
      n: 0,
      medianMs: null,
      p90Ms: null,
      meanMs: null,
      excluded,
      reason: 'insufficient_data' as const,
    };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const medianMs =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  const p90Ms = sorted[Math.max(0, Math.ceil(sorted.length * 0.9) - 1)] ?? 0;
  return {
    n: sorted.length,
    medianMs,
    p90Ms,
    meanMs: sorted.reduce((total, value) => total + value, 0) / sorted.length,
    excluded,
    reason: null,
  };
}

function latestDraftState(
  history: DraftHistory | null,
): RunSummary['draftState'] {
  if (history === null) return 'none';
  // A revision still awaiting its verdict is not presentable yet.
  if (!history.verifications.has(history.latest.verificationResultId)) {
    return 'none';
  }
  const state = history.view.revisions.find(
    ({ revision }) => revision.revisionId === history.latest.revisionId,
  )?.state;
  if (state === undefined || state === 'superseded') {
    throw new OperationsIntegrityError(
      'The latest draft state is unavailable.',
    );
  }
  return state;
}

export class OperationsService {
  private readonly now: () => string;

  constructor(private readonly dependencies: OperationsDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  private async allRuns(): Promise<RunDocument[]> {
    const raw = await this.dependencies.runs.list(METRICS_WINDOW_LIMIT + 1);
    if (raw.length > METRICS_WINDOW_LIMIT)
      throw new MetricsWindowExceededError();
    return raw.map((value) =>
      this.dependencies.repositories.runs.parseStored(value),
    );
  }

  private async draftHistory(run: RunDocument): Promise<DraftHistory | null> {
    if (run.draftId === null) return null;
    const history = await this.dependencies.drafts.history(run.draftId);
    if (
      history === null ||
      history.latest.runId !== run.runId ||
      history.latest.leadId !== run.leadId
    ) {
      throw new OperationsIntegrityError('A linked draft is incompatible.');
    }
    return history;
  }

  private async summary(run: RunDocument, at: string): Promise<RunSummary> {
    const [qualification, history] = await Promise.all([
      run.qualificationResultId === null
        ? Promise.resolve(null)
        : this.dependencies.repositories.qualificationResults.get(
            run.qualificationResultId,
          ),
      this.draftHistory(run),
    ]);
    if (
      run.qualificationResultId !== null &&
      (qualification?.runId !== run.runId ||
        qualification.leadId !== run.leadId)
    ) {
      throw new OperationsIntegrityError('A qualification is incompatible.');
    }
    const leaseState =
      run.lease === null
        ? ('none' as const)
        : Date.parse(run.lease.expiresAt) <= Date.parse(at)
          ? ('expired' as const)
          : ('active' as const);
    const draftState =
      run.draftId === null && run.draftSkipReason !== null
        ? ('skipped' as const)
        : latestDraftState(history);
    return {
      runId: run.runId,
      leadId: run.leadId,
      shortLeadId: run.leadId.replaceAll('-', '').slice(0, 8),
      status: run.status,
      priority:
        qualification === null
          ? 'not_scored'
          : (qualification.priority ?? 'held'),
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      attempt: run.attempt,
      retryCount: run.retryCount,
      currentStep: run.currentStep,
      evidenceCompleteness: run.evidenceCompleteness,
      enrichmentMode: run.enrichmentMode,
      draftState,
      draftSkipReason: run.draftSkipReason,
      holds: run.holds,
      leaseState,
      resumable:
        isResumeEligible(run.status) ||
        (run.status === 'running' && leaseState === 'expired'),
      revision: run.revision,
    };
  }

  async list(input: {
    filter: RunListFilter;
    cursor: string | null;
    limit: number;
  }): Promise<RunListResponse> {
    const at = this.now();
    const summaries = await Promise.all(
      (await this.allRuns()).map((run) => this.summary(run, at)),
    );
    const matching = summaries.filter((summary) => {
      if (input.filter === 'approval_queue') {
        return summary.draftState === 'pending_review';
      }
      if (input.filter === 'attention') {
        return (
          summary.status === 'failed_retryable' ||
          summary.status === 'failed_terminal' ||
          summary.priority === 'held' ||
          summary.leaseState === 'expired' ||
          summary.draftState === 'verification_blocked'
        );
      }
      return true;
    });
    const cursorIndex =
      input.cursor === null
        ? -1
        : matching.findIndex((item) => item.runId === input.cursor);
    if (input.cursor !== null && cursorIndex < 0) {
      throw new OperationsIntegrityError('The run-list cursor is unavailable.');
    }
    const start = cursorIndex + 1;
    const items = matching.slice(start, start + input.limit);
    const more = start + items.length < matching.length;
    return RunListResponseSchema.parse({
      schemaVersion: 'run-list-response-v1',
      filter: input.filter,
      items,
      nextCursor: more ? (items.at(-1)?.runId ?? null) : null,
      totalMatching: matching.length,
      retrievedAt: at,
      evidenceClass: 'synthetic-local',
    });
  }

  async metrics(systemBundleId: string): Promise<MetricsReport> {
    const generatedAt = this.now();
    const runs = await this.allRuns();
    const current = runs.filter((run) => run.systemBundleId === systemBundleId);
    const contexts = await Promise.all(
      current.map(async (run) => {
        const [lead, qualification, evidence, events, history, simulation] =
          await Promise.all([
            this.dependencies.repositories.leads.get(run.leadId),
            run.qualificationResultId === null
              ? Promise.resolve(null)
              : this.dependencies.repositories.qualificationResults.get(
                  run.qualificationResultId,
                ),
            Promise.all(
              run.enrichmentEvidenceIds.map((id) =>
                this.dependencies.repositories.enrichmentEvidence.get(id),
              ),
            ),
            this.dependencies.events.list(run.runId, 1_000),
            this.draftHistory(run),
            run.simulationRecordId === null
              ? Promise.resolve(null)
              : this.dependencies.repositories.simulationRecords.get(
                  run.simulationRecordId,
                ),
          ]);
        const parsedEvents = events.map((value) =>
          this.dependencies.repositories.events.parseStored(value),
        );
        if (
          lead === null ||
          lead.leadId !== run.leadId ||
          evidence.some(
            (record, index) =>
              record === null ||
              record.evidenceId !== run.enrichmentEvidenceIds[index] ||
              record.runId !== run.runId ||
              record.leadId !== run.leadId,
          ) ||
          (run.qualificationResultId !== null &&
            (qualification === null ||
              qualification.resultId !== run.qualificationResultId ||
              qualification.runId !== run.runId ||
              qualification.leadId !== run.leadId)) ||
          (run.simulationRecordId !== null &&
            (simulation === null ||
              simulation.simulationRecordId !== run.simulationRecordId ||
              simulation.runId !== run.runId)) ||
          parsedEvents.some(
            (event) =>
              event.runId !== run.runId ||
              event.systemBundleId !== run.systemBundleId,
          )
        ) {
          throw new OperationsIntegrityError();
        }
        return {
          run,
          lead,
          qualification,
          evidence: evidence.filter(
            (record): record is EnrichmentEvidence => record !== null,
          ),
          events: parsedEvents,
          history,
          simulation,
        };
      }),
    );

    const priorityDistribution = {
      high: 0,
      standard: 0,
      nurture: 0,
      held: 0,
      not_scored: 0,
    };
    const processingDurations: number[] = [];
    const reviewDurations: number[] = [];
    const failuresByStep = Object.fromEntries(
      workflowSteps.map((step) => [step, 0]),
    ) as Record<WorkflowStep, number>;
    const evidenceRecords: EnrichmentEvidence[] = [];
    let failedRuns = 0;
    let approvalQueue = 0;
    let simulationRuns = 0;
    let contacted = 0;
    let responded = 0;
    let appointment = 0;

    for (const context of contexts) {
      const priority =
        context.qualification === null
          ? 'not_scored'
          : (context.qualification.priority ?? 'held');
      priorityDistribution[priority] += 1;
      evidenceRecords.push(...context.evidence);
      const start = context.events.find(
        (event) => event.name === 'lead.persisted',
      );
      const finish = [...context.events]
        .reverse()
        .find(
          (event) =>
            event.name === 'run.completed' || event.name === 'run.failed',
        );
      if (finishedStatuses.has(context.run.status)) {
        if (start === undefined || finish === undefined) {
          throw new OperationsIntegrityError(
            'A finished run lacks timing events.',
          );
        }
        processingDurations.push(
          Math.max(
            0,
            Date.parse(finish.occurredAt) - Date.parse(start.occurredAt),
          ),
        );
      }
      if (
        context.run.status === 'failed_retryable' ||
        context.run.status === 'failed_terminal'
      ) {
        failedRuns += 1;
        if (context.run.currentStep !== null)
          failuresByStep[context.run.currentStep] += 1;
      }
      if (context.history !== null) {
        const state = latestDraftState(context.history);
        if (state === 'pending_review') approvalQueue += 1;
        const firstReview = [...context.history.reviews].sort((left, right) =>
          left.decidedAt.localeCompare(right.decidedAt),
        )[0];
        if (firstReview !== undefined && finish !== undefined) {
          reviewDurations.push(
            Math.max(
              0,
              Date.parse(firstReview.decidedAt) - Date.parse(finish.occurredAt),
            ),
          );
        }
      }
      if (context.simulation !== null) {
        simulationRuns += 1;
        if (context.simulation.outcome.contacted) contacted += 1;
        if (context.simulation.outcome.responded) responded += 1;
        if (context.simulation.outcome.appointment) appointment += 1;
      }
    }

    const enrichment: EnrichmentMetric[] = [];
    for (const classGroup of ['live', 'recorded_or_mock'] as const) {
      for (const source of ['all', 'nhtsa_vpic', 'zippopotam_us'] as const) {
        const selected = evidenceRecords.filter(
          (record) =>
            (classGroup === 'live'
              ? record.evidenceClass === 'live'
              : record.evidenceClass !== 'live') &&
            (source === 'all' || record.source === source),
        );
        const attempted = selected.filter(
          (record) => record.outcome !== 'not_attempted',
        );
        enrichment.push({
          classGroup,
          source,
          success: rate(
            attempted.filter(
              (record) =>
                record.outcome === 'found' || record.outcome === 'not_found',
            ).length,
            attempted.length,
            selected.length - attempted.length,
          ),
          foundRate: rate(
            attempted.filter((record) => record.outcome === 'found').length,
            attempted.length,
            selected.length - attempted.length,
          ),
          notAttempted: selected.length - attempted.length,
        });
      }
    }
    const finished = contexts.filter(({ run }) =>
      finishedStatuses.has(run.status),
    );
    return MetricsReportSchema.parse({
      schemaVersion: CONTRACT_VERSIONS.metricsReport,
      definitionsVersion: CONTRACT_VERSIONS.metricsDefinitions,
      generatedAt,
      systemBundleId,
      window: {
        runsInWindow: current.length,
        activeRuns: current.length - finished.length,
        otherBundleRuns: runs.length - current.length,
      },
      leadVolume: current.length,
      priorityDistribution,
      processingTime: durationSummary(
        processingDurations,
        current.length - processingDurations.length,
      ),
      reviewLatency: durationSummary(
        reviewDurations,
        contexts.filter(({ history }) => history !== null).length -
          reviewDurations.length,
      ),
      enrichment,
      agentFailures: rate(
        failedRuns,
        finished.length,
        current.length - finished.length,
      ),
      failuresByStep,
      approvalQueue,
      simulation: {
        label: 'SYNTHETIC',
        runs: simulationRuns,
        contacted,
        responded,
        appointment,
      },
      acquisition: acquisitionReport(
        contexts.map(({ run, lead, qualification }) => ({
          attribution: lead.intake.attribution,
          consented: lead.intake.emailContactConsent,
          priority:
            qualification === null
              ? 'not_scored'
              : (qualification.priority ?? 'held'),
          failed:
            run.status === 'failed_retryable' ||
            run.status === 'failed_terminal',
        })),
      ),
      evidenceClass: 'synthetic-local',
    });
  }
}

export { METRICS_DEFINITIONS };
