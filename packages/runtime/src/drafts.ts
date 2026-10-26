import { createHash } from 'node:crypto';
import {
  canonicalDraftContent,
  COMPLIANCE_NOTICE,
  composeDraft,
  composerInputFrom,
  CONTRACT_VERSIONS,
  deriveRevisionStates,
  DraftViewSchema,
  LOCAL_OPERATOR_PRINCIPAL,
  MAX_DRAFT_REVISIONS,
  OutreachDraftRevisionSchema,
  verifyOutputs,
  type DraftReview,
  type DraftView,
  type EnrichmentEvidence,
  type LeadDocument,
  type LifecycleEvent,
  type OutreachDraftRevision,
  type QualificationResult,
  type RunDocument,
  type VerificationResult,
} from '@leadflow-ai/domain';
import type { Firestore } from 'firebase-admin/firestore';
import {
  RunRevisionConflictError,
  type LifecyclePersistenceService,
} from './lifecycle.js';
import type { FirestoreRepositories } from './repositories.js';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

// Stable UUIDv4-shaped identifiers derived from their logical identity, so a
// replayed create collides with its earlier write instead of duplicating it.
export function deterministicUuid(...parts: string[]): string {
  const characters = sha256Hex(parts.join('\u0000')).slice(0, 32).split('');
  characters[12] = '4';
  characters[16] = (
    (Number.parseInt(characters[16] ?? '0', 16) & 0x3) |
    0x8
  ).toString(16);
  const value = characters.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export const draftIdFor = (runId: string, evidenceIds: readonly string[]) =>
  deterministicUuid('outreach-draft', runId, ...[...evidenceIds].sort());
export const revisionIdFor = (draftId: string, revisionNumber: number) =>
  deterministicUuid('outreach-draft-revision', draftId, String(revisionNumber));
export const revisionVerificationIdFor = (revisionId: string) =>
  deterministicUuid('verification-result', revisionId);
export const reviewIdFor = (revisionId: string) =>
  deterministicUuid('draft-review', revisionId);

export function templateRevision(input: {
  run: RunDocument;
  lead: LeadDocument;
  qualification: QualificationResult;
  evidence: readonly EnrichmentEvidence[];
  createdAt: string;
}): OutreachDraftRevision {
  if (input.qualification.priority === null) {
    throw new Error('A held qualification cannot receive a draft.');
  }
  const composed = composeDraft(
    composerInputFrom({
      intake: input.lead.intake,
      priority: input.qualification.priority,
      evidence: input.evidence,
    }),
  );
  const draftId = draftIdFor(
    input.run.runId,
    input.evidence.map((record) => record.evidenceId),
  );
  const revisionId = revisionIdFor(draftId, 1);
  return OutreachDraftRevisionSchema.parse({
    schemaVersion: CONTRACT_VERSIONS.outreachDraft,
    draftId,
    revisionId,
    revisionNumber: 1,
    previousRevisionId: null,
    runId: input.run.runId,
    leadId: input.lead.leadId,
    createdAt: input.createdAt,
    origin: 'template',
    composerVersion: CONTRACT_VERSIONS.composer,
    channel: 'email',
    subject: composed.subject,
    body: composed.body,
    slots: composed.slots,
    followUpAction: composed.followUpAction,
    contentSha256: sha256Hex(
      canonicalDraftContent(composed.subject, composed.body),
    ),
    verificationResultId: revisionVerificationIdFor(revisionId),
  });
}

export interface DraftReader {
  revisions(draftId: string): Promise<unknown[]>;
  reviews(draftId: string): Promise<unknown[]>;
}

export const DRAFT_REVISION_LIMIT = 50;

export class AdminDraftReader implements DraftReader {
  constructor(private readonly database: Firestore) {}

  async revisions(draftId: string): Promise<unknown[]> {
    const snapshot = await this.database
      .collection(`outreachDrafts/${draftId}/revisions`)
      .orderBy('revisionNumber', 'asc')
      .limit(DRAFT_REVISION_LIMIT + 1)
      .get();
    return snapshot.docs.map((document) => document.data());
  }

  async reviews(draftId: string): Promise<unknown[]> {
    const snapshot = await this.database
      .collection(`outreachDrafts/${draftId}/reviews`)
      .orderBy('decidedAt', 'asc')
      .limit(DRAFT_REVISION_LIMIT + 1)
      .get();
    return snapshot.docs.map((document) => document.data());
  }
}

export class DraftNotFoundError extends Error {
  readonly code = 'draft_not_found' as const;

  constructor() {
    super('The requested draft does not exist.');
    this.name = 'DraftNotFoundError';
  }
}

export class DraftConflictError extends Error {
  readonly code = 'draft_conflict' as const;

  constructor(message = 'The draft changed or was already decided.') {
    super(message);
    this.name = 'DraftConflictError';
  }
}

export class DraftIntegrityError extends Error {
  readonly code = 'draft_integrity_failed' as const;

  constructor(message = 'Stored draft records are inconsistent.') {
    super(message);
    this.name = 'DraftIntegrityError';
  }
}

export interface DraftServiceDependencies {
  repositories: FirestoreRepositories;
  reader: DraftReader;
  lifecycle: LifecyclePersistenceService;
  events: { list(runId: string, limit: number): Promise<unknown[]> };
  now?: () => string;
}

export interface DraftHistory {
  revisions: OutreachDraftRevision[];
  reviews: DraftReview[];
  verifications: Map<string, VerificationResult>;
  view: DraftView;
  latest: OutreachDraftRevision;
}

export interface DraftActionRequest {
  draftId: string;
  traceId: string;
  requestId: string;
}

const MAX_EVENT_RETRIES = 3;

export class DraftService {
  private readonly now: () => string;

  constructor(private readonly dependencies: DraftServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async history(draftId: string): Promise<DraftHistory | null> {
    const { repositories, reader } = this.dependencies;
    const [rawRevisions, rawReviews] = await Promise.all([
      reader.revisions(draftId),
      reader.reviews(draftId),
    ]);
    if (rawRevisions.length === 0) return null;
    if (
      rawRevisions.length > DRAFT_REVISION_LIMIT ||
      rawReviews.length > DRAFT_REVISION_LIMIT
    ) {
      throw new DraftIntegrityError('Draft history exceeds its limit.');
    }
    const revisions = rawRevisions.map((value) =>
      repositories.draftRevisions.parseStored(value),
    );
    const reviews = rawReviews.map((value) =>
      repositories.draftReviews.parseStored(value),
    );
    revisions.forEach((revision, index) => {
      if (
        revision.draftId !== draftId ||
        revision.revisionNumber !== index + 1 ||
        revision.runId !== revisions[0]?.runId ||
        revision.leadId !== revisions[0]?.leadId ||
        (index > 0 &&
          revision.previousRevisionId !== revisions[index - 1]?.revisionId)
      ) {
        throw new DraftIntegrityError();
      }
    });
    const byRevision = new Map(
      revisions.map((revision) => [revision.revisionId, revision]),
    );
    for (const review of reviews) {
      const revision = byRevision.get(review.revisionId);
      if (
        revision === undefined ||
        review.draftId !== draftId ||
        review.runId !== revision.runId ||
        review.leadId !== revision.leadId ||
        review.contentSha256 !== revision.contentSha256
      ) {
        throw new DraftIntegrityError('A review does not match its revision.');
      }
    }
    const verifications = new Map<string, VerificationResult>();
    await Promise.all(
      revisions.map(async (revision) => {
        const result = await repositories.verificationResults.get(
          revision.verificationResultId,
        );
        // Only the latest revision may still be awaiting its verdict.
        if (result === null) {
          if (revision.revisionNumber === revisions.length) return;
          throw new DraftIntegrityError(
            'A superseded revision has no verification.',
          );
        }
        if (
          result.runId !== revision.runId ||
          result.leadId !== revision.leadId ||
          result.verificationResultId !== revision.verificationResultId ||
          (result.scope === 'operator_revision' &&
            result.revisionId !== revision.revisionId)
        ) {
          throw new DraftIntegrityError(
            'A verification does not match its revision.',
          );
        }
        verifications.set(result.verificationResultId, result);
      }),
    );
    const states = deriveRevisionStates({ revisions, reviews, verifications });
    const latest = revisions.at(-1);
    if (latest === undefined) throw new DraftIntegrityError();
    // A revision whose verification is not yet stored is still being
    // verified; it is shown only once its verdict exists.
    const view = DraftViewSchema.parse({
      revisions: revisions
        .filter((revision) => verifications.has(revision.verificationResultId))
        .map((revision) => ({
          revision,
          state: states.get(revision.revisionId),
          verification: verifications.get(revision.verificationResultId),
        })),
      reviews,
      complianceNotice: COMPLIANCE_NOTICE,
    });
    return { revisions, reviews, verifications, view, latest };
  }

  private async loadForAction(
    request: DraftActionRequest,
    expected: { revisionId: string; contentSha256: string },
  ) {
    const history = await this.history(request.draftId);
    if (history === null) throw new DraftNotFoundError();
    const run = await this.dependencies.repositories.runs.get(
      history.latest.runId,
    );
    if (run === null || run.draftId !== request.draftId) {
      throw new DraftNotFoundError();
    }
    if (run.status !== 'complete') {
      throw new DraftConflictError('The run must finish before review.');
    }
    if (
      history.latest.revisionId !== expected.revisionId ||
      history.latest.contentSha256 !== expected.contentSha256
    ) {
      throw new DraftConflictError();
    }
    return { history, run };
  }

  // Runs inside a commit attempt, after the run is read: a concurrent draft
  // change also bumps the run revision, so a retry must see it here.
  private async assertLatest(
    draftId: string,
    revisionId: string,
    state?: 'pending_review',
  ): Promise<void> {
    const history = await this.history(draftId);
    const entry = history?.view.revisions.find(
      ({ revision }) => revision.revisionId === revisionId,
    );
    if (
      history === null ||
      history.latest.revisionId !== revisionId ||
      (state !== undefined && entry?.state !== state)
    ) {
      throw new DraftConflictError();
    }
  }

  private async commitWithRetry(
    runId: string,
    commit: (run: RunDocument) => Promise<unknown>,
  ): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const run = await this.dependencies.repositories.runs.get(runId);
      if (run === null) throw new DraftNotFoundError();
      try {
        await commit(run);
        return;
      } catch (error) {
        if (
          error instanceof RunRevisionConflictError &&
          attempt < MAX_EVENT_RETRIES
        ) {
          continue;
        }
        if (error instanceof RunRevisionConflictError)
          throw new DraftConflictError();
        // A create collision means the same decision or revision already
        // landed: report it as a conflict, never a second write.
        if (error instanceof Error && /already exists/iu.test(error.message)) {
          throw new DraftConflictError();
        }
        throw error;
      }
    }
  }

  async review(
    request: DraftActionRequest & {
      revisionId: string;
      contentSha256: string;
      decision: 'approved' | 'rejected';
    },
  ): Promise<DraftView> {
    const { history, run } = await this.loadForAction(request, request);
    const state = history.view.revisions.find(
      (entry) => entry.revision.revisionId === request.revisionId,
    )?.state;
    if (state !== 'pending_review') {
      throw new DraftConflictError(
        'Only a pending, verified revision can be reviewed.',
      );
    }
    const review = this.dependencies.repositories.draftReviews.prepareCreate({
      schemaVersion: CONTRACT_VERSIONS.draftReview,
      reviewId: reviewIdFor(request.revisionId),
      draftId: request.draftId,
      revisionId: request.revisionId,
      runId: run.runId,
      leadId: run.leadId,
      contentSha256: request.contentSha256,
      decision: request.decision,
      principal: LOCAL_OPERATOR_PRINCIPAL,
      decidedAt: this.now(),
      meaning: 'approved for manual use only; nothing is sent',
    });
    await this.commitWithRetry(run.runId, async (current) => {
      await this.assertLatest(
        request.draftId,
        request.revisionId,
        'pending_review',
      );
      return this.dependencies.lifecycle.commitRunEvent({
        runId: current.runId,
        expectedRevision: current.revision,
        next: { ...current },
        eventName: 'draft.reviewed',
        step: null,
        durationMs: null,
        traceId: request.traceId,
        requestId: request.requestId,
        authorization: 'allowed',
        creates: [review],
      });
    });
    const updated = await this.history(request.draftId);
    if (updated === null) throw new DraftNotFoundError();
    return updated.view;
  }

  async revise(
    request: DraftActionRequest & {
      baseRevisionId: string;
      baseContentSha256: string;
      subject: string;
      body: string;
    },
  ): Promise<DraftView> {
    const { history, run } = await this.loadForAction(request, {
      revisionId: request.baseRevisionId,
      contentSha256: request.baseContentSha256,
    });
    const lead = await this.dependencies.repositories.leads.get(run.leadId);
    if (lead === null) throw new DraftIntegrityError('Stored lead is missing.');
    const evidence = await Promise.all(
      run.enrichmentEvidenceIds.map((id) =>
        this.dependencies.repositories.enrichmentEvidence.get(id),
      ),
    );
    if (evidence.some((record) => record === null)) {
      throw new DraftIntegrityError('Linked evidence is missing.');
    }
    const events: LifecycleEvent[] = (
      await this.dependencies.events.list(run.runId, 201)
    ).map((value) => this.dependencies.repositories.events.parseStored(value));
    const revisionNumber = history.latest.revisionNumber + 1;
    if (revisionNumber > MAX_DRAFT_REVISIONS) {
      throw new DraftConflictError(
        'This draft has reached its revision limit.',
      );
    }
    const revisionId = revisionIdFor(request.draftId, revisionNumber);
    const createdAt = this.now();
    const revision =
      this.dependencies.repositories.draftRevisions.prepareCreate({
        schemaVersion: CONTRACT_VERSIONS.outreachDraft,
        draftId: request.draftId,
        revisionId,
        revisionNumber,
        previousRevisionId: history.latest.revisionId,
        runId: run.runId,
        leadId: run.leadId,
        createdAt,
        origin: 'operator_edit',
        composerVersion: null,
        channel: 'email',
        subject: request.subject,
        body: request.body,
        slots: [],
        followUpAction: history.latest.followUpAction,
        contentSha256: sha256Hex(
          canonicalDraftContent(request.subject, request.body),
        ),
        verificationResultId: revisionVerificationIdFor(revisionId),
      });
    const verification =
      this.dependencies.repositories.verificationResults.prepareCreate(
        verifyOutputs({
          verificationResultId: revision.data.verificationResultId,
          runId: run.runId,
          leadId: run.leadId,
          verifiedAt: createdAt,
          intake: lead.intake,
          priority: null,
          evidence: evidence.filter(
            (record): record is EnrichmentEvidence => record !== null,
          ),
          sha256: sha256Hex,
          events,
          draft: revision.data,
          scope: 'operator_revision',
        }),
      );
    const blocked = verification.data.draftPassed !== true;
    await this.commitWithRetry(run.runId, async (current) => {
      await this.assertLatest(request.draftId, request.baseRevisionId);
      return this.dependencies.lifecycle.commitRunEvent({
        runId: current.runId,
        expectedRevision: current.revision,
        next: {
          ...current,
          holds: blocked ? ['draft_verification_blocked'] : [],
        },
        eventName: 'draft.revised',
        step: null,
        durationMs: null,
        traceId: request.traceId,
        requestId: request.requestId,
        authorization: 'allowed',
        creates: [revision, verification],
      });
    });
    const updated = await this.history(request.draftId);
    if (updated === null) throw new DraftNotFoundError();
    return updated.view;
  }
}
