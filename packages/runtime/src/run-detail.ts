import { isDeepStrictEqual } from 'node:util';
import {
  RunDetailResponseSchema,
  type LifecycleEvent,
  type RunDocument,
  type DraftView,
  type RunDetailResponse,
} from '@leadflow-ai/domain';
import type { Firestore } from 'firebase-admin/firestore';
import {
  createFirestoreRepositories,
  type FirestoreRepositories,
} from './repositories.js';
import { RunNotFoundError } from './lifecycle.js';
import { withoutRetention } from './retention.js';

export const RUN_DETAIL_EVENT_LIMIT = 200;

export class RunDetailSnapshotUnavailableError extends Error {
  readonly code = 'snapshot_unavailable' as const;

  constructor(message = 'A consistent stored run snapshot is unavailable.') {
    super(message);
    this.name = 'RunDetailSnapshotUnavailableError';
  }
}

export class RunDetailIntegrityError extends Error {
  readonly code = 'run_detail_integrity_failed' as const;

  constructor(message = 'Stored run detail is internally inconsistent.') {
    super(message);
    this.name = 'RunDetailIntegrityError';
  }
}

export interface RunEventReader {
  list(runId: string, limit: number): Promise<unknown[]>;
}

export class AdminRunEventReader implements RunEventReader {
  constructor(private readonly database: Firestore) {}

  async list(runId: string, limit: number): Promise<unknown[]> {
    const snapshot = await this.database
      .collection(`runs/${runId}/events`)
      .orderBy('sequence', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map((document) => withoutRetention(document.data()));
  }
}

export interface RunDetailDependencies {
  repositories: FirestoreRepositories;
  events: RunEventReader;
  // Builds the draft view; absent only for callers that never read drafts.
  drafts?: {
    history(draftId: string): Promise<{ view: DraftView } | null>;
  };
  now?: () => string;
}

function validateEventHistory(
  events: readonly LifecycleEvent[],
  run: RunDocument,
): void {
  const expectedCount = run.nextEventSequence - 1;
  if (expectedCount > RUN_DETAIL_EVENT_LIMIT) {
    throw new RunDetailIntegrityError(
      'Stored event history exceeds the API limit.',
    );
  }
  if (events.length !== expectedCount) {
    throw new RunDetailSnapshotUnavailableError();
  }
  for (const [index, event] of events.entries()) {
    if (
      event.runId !== run.runId ||
      event.systemBundleId !== run.systemBundleId ||
      event.sequence !== index + 1 ||
      event.runRevision > run.revision
    ) {
      throw new RunDetailIntegrityError();
    }
  }
  if (events.at(-1)?.runRevision !== run.revision) {
    throw new RunDetailSnapshotUnavailableError();
  }
}

export class RunDetailService {
  private readonly now: () => string;

  constructor(private readonly dependencies: RunDetailDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async get(runId: string): Promise<RunDetailResponse> {
    const run = await this.dependencies.repositories.runs.get(runId);
    if (run === null) throw new RunNotFoundError();
    const [lead, rawEvents, qualification, simulation] = await Promise.all([
      this.dependencies.repositories.leads.get(run.leadId),
      this.dependencies.events.list(run.runId, RUN_DETAIL_EVENT_LIMIT + 1),
      run.qualificationResultId === null
        ? Promise.resolve(null)
        : this.dependencies.repositories.qualificationResults.get(
            run.qualificationResultId,
          ),
      run.simulationRecordId === null
        ? Promise.resolve(null)
        : this.dependencies.repositories.simulationRecords.get(
            run.simulationRecordId,
          ),
    ]);
    if (lead === null)
      throw new RunDetailIntegrityError('Stored lead is missing.');
    if (rawEvents.length > RUN_DETAIL_EVENT_LIMIT) {
      throw new RunDetailIntegrityError(
        'Stored event history exceeds the API limit.',
      );
    }
    const events = rawEvents.map((event) =>
      this.dependencies.repositories.events.parseStored(event),
    );
    validateEventHistory(events, run);
    if (
      (run.qualificationResultId !== null && qualification === null) ||
      (qualification !== null &&
        (qualification.resultId !== run.qualificationResultId ||
          qualification.runId !== run.runId ||
          qualification.leadId !== run.leadId))
    ) {
      throw new RunDetailIntegrityError(
        'Stored qualification is incompatible.',
      );
    }
    if (
      (run.simulationRecordId !== null && simulation === null) ||
      (simulation !== null &&
        (simulation.simulationRecordId !== run.simulationRecordId ||
          simulation.runId !== run.runId))
    ) {
      throw new RunDetailIntegrityError('Stored simulation is incompatible.');
    }
    if (
      run.status === 'complete' &&
      (qualification === null || simulation === null)
    ) {
      throw new RunDetailIntegrityError(
        'Completed run results are incomplete.',
      );
    }
    const phaseTwo = await this.phaseTwoRecords(run);
    const confirmedRun = await this.dependencies.repositories.runs.get(runId);
    if (confirmedRun === null || !isDeepStrictEqual(confirmedRun, run)) {
      throw new RunDetailSnapshotUnavailableError();
    }

    return RunDetailResponseSchema.parse({
      schemaVersion: 'run-detail-response-v2',
      lead,
      run,
      events,
      qualification,
      ...phaseTwo,
      simulation,
      retrievedAt: this.now(),
      evidenceClass: 'synthetic-local',
    });
  }

  private async phaseTwoRecords(run: RunDocument) {
    const { repositories } = this.dependencies;
    const [enrichment, emailCheck, verification] = await Promise.all([
      Promise.all(
        run.enrichmentEvidenceIds.map((id) =>
          repositories.enrichmentEvidence.get(id),
        ),
      ),
      run.emailCheckId === null
        ? Promise.resolve(null)
        : repositories.emailChecks.get(run.emailCheckId),
      run.verificationResultId === null
        ? Promise.resolve(null)
        : repositories.verificationResults.get(run.verificationResultId),
    ]);
    if (
      enrichment.some(
        (record) =>
          record === null ||
          record.runId !== run.runId ||
          record.leadId !== run.leadId,
      )
    ) {
      throw new RunDetailIntegrityError(
        'Linked enrichment evidence is incompatible.',
      );
    }
    if (
      (run.emailCheckId !== null &&
        (emailCheck?.runId !== run.runId ||
          emailCheck.leadId !== run.leadId)) ||
      (run.verificationResultId !== null &&
        (verification?.runId !== run.runId ||
          verification.leadId !== run.leadId))
    ) {
      throw new RunDetailIntegrityError(
        'Linked Phase 2 records are incompatible.',
      );
    }
    if (run.status === 'complete' && verification === null) {
      throw new RunDetailIntegrityError(
        'A completed run lacks its verification.',
      );
    }
    let draft: DraftView | null = null;
    if (run.draftId !== null) {
      const history = await this.dependencies.drafts?.history(run.draftId);
      if (history === null || history === undefined) {
        throw new RunDetailIntegrityError('The linked draft is unavailable.');
      }
      if (
        history.view.revisions.length === 0 ||
        history.view.revisions.some(
          ({ revision, verification: draftVerification }) =>
            revision.draftId !== run.draftId ||
            revision.runId !== run.runId ||
            revision.leadId !== run.leadId ||
            draftVerification.runId !== run.runId ||
            draftVerification.leadId !== run.leadId ||
            draftVerification.verificationResultId !==
              revision.verificationResultId ||
            (draftVerification.scope === 'operator_revision' &&
              draftVerification.revisionId !== revision.revisionId),
        ) ||
        history.view.reviews.some(
          (review) =>
            review.draftId !== run.draftId ||
            review.runId !== run.runId ||
            review.leadId !== run.leadId,
        )
      ) {
        throw new RunDetailIntegrityError(
          'The linked draft history is incompatible.',
        );
      }
      draft = history.view;
    }
    return {
      enrichment: enrichment.filter((record) => record !== null),
      emailCheck,
      draft,
      verification,
    };
  }
}

export function createRunDetailService(
  database: Firestore,
  drafts?: RunDetailDependencies['drafts'],
): RunDetailService {
  return new RunDetailService({
    repositories: createFirestoreRepositories(database),
    events: new AdminRunEventReader(database),
    ...(drafts === undefined ? {} : { drafts }),
  });
}
