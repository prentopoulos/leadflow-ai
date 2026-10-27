import { describe, expect, it } from 'vitest';
import {
  currentConsentRecord,
  scoreQualification,
  verifyOutputs,
  type LeadDocument,
  type RunDocument,
} from '@leadflow-ai/domain';
import {
  DraftConflictError,
  DraftIntegrityError,
  DraftService,
  reviewIdFor,
  sha256Hex,
  templateRevision,
} from './drafts.js';
import {
  FixtureEnrichmentTransport,
  RECORDED_ENRICHMENT_FIXTURE_PATH,
  loadEnrichmentFixtureFile,
  lookupVehicle,
  lookupZip,
} from './enrichment.js';
import {
  DeterministicQualificationInterpreter,
  qualificationProjectionFromLead,
} from './interpreter.js';
import { LifecyclePersistenceService } from './lifecycle.js';
import { MemoryFirestore } from './memory-store.test-support.js';
import { createFirestoreRepositories } from './repositories.js';

const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  bundle: '66666666-6666-4666-8666-666666666666',
  vehicle: '33333333-3333-4333-8333-333333333333',
  zip: '44444444-4444-4444-8444-444444444444',
  trace: '55555555-5555-4555-8555-555555555555',
  request: '77777777-7777-4777-8777-777777777777',
};
const timestamp = '2026-10-25T20:00:00.000Z';

const lead: LeadDocument = {
  schemaVersion: 'lead-v3',
  leadId: ids.lead,
  createdAt: timestamp,
  intake: {
    schemaVersion: 'intake-v3',
    attribution: null,
    identityClass: 'fictional',
    givenName: 'Avery',
    familyName: 'Jordan',
    email: 'avery.jordan@example.com',
    zipCode: '22150',
    vehicleYear: 2022,
    vehicleMake: 'Toyota',
    vehicleModel: 'Camry',
    coverageFocus: 'balanced',
    requestIntent: 'compare_options',
    needTimeline: 'within_30_days',
    requestDetails: 'Looking for help before my renewal next month.',
    emailContactConsent: true,
    consentRecord: currentConsentRecord(),
  },
  provenance: {
    sourceId: 'military-com-auto-landing',
    sourceUrl: 'https://auto.military.com/',
    retrievedAt: '2026-10-24',
    exactSourceFields: ['zipCode'],
    demoFields: ['givenName', 'familyName', 'email', 'emailContactConsent'],
    simulatedFields: ['attribution'],
    parityVerified: false,
  },
  evidenceClass: 'synthetic',
};

async function seededDraft() {
  const store = new MemoryFirestore();
  const repositories = createFirestoreRepositories(store);
  const lifecycle = new LifecyclePersistenceService({
    atomicStore: store,
    repositories,
    now: () => timestamp,
  });
  const transport = new FixtureEnrichmentTransport(
    await loadEnrichmentFixtureFile(RECORDED_ENRICHMENT_FIXTURE_PATH),
  );
  const lookup = (evidenceId: string) => ({
    transport,
    runId: ids.run,
    leadId: ids.lead,
    evidenceId,
    now: () => timestamp,
  });
  const vehicle = await lookupVehicle(lead.intake, lookup(ids.vehicle));
  const zip = await lookupZip(lead.intake.zipCode, lookup(ids.zip));
  const evidence = [vehicle.evidence, zip.evidence];
  const interpretation = await new DeterministicQualificationInterpreter(
    () => timestamp,
  ).interpret(qualificationProjectionFromLead(lead));
  const qualification = scoreQualification(interpretation, {
    resultId: ids.run,
    runId: ids.run,
    leadId: ids.lead,
    generatedAt: timestamp,
  });
  const run: RunDocument = {
    schemaVersion: 'run-v2',
    runId: ids.run,
    leadId: ids.lead,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'complete',
    revision: 0,
    nextEventSequence: 1,
    attempt: 1,
    retryCount: 0,
    currentStep: null,
    completedSteps: [],
    lease: null,
    qualificationResultId: ids.run,
    simulationRecordId: null,
    enrichmentMode: 'recorded',
    enrichmentEvidenceIds: [ids.vehicle, ids.zip],
    emailCheckId: null,
    evidenceCompleteness: 'complete',
    draftId: null,
    draftSkipReason: null,
    verificationResultId: null,
    holds: [],
    safeError: null,
    systemBundleId: ids.bundle,
  };
  const revision = templateRevision({
    run,
    lead,
    qualification,
    evidence,
    createdAt: timestamp,
  });
  const verification = verifyOutputs({
    verificationResultId: revision.verificationResultId,
    runId: ids.run,
    leadId: ids.lead,
    verifiedAt: timestamp,
    intake: lead.intake,
    priority: qualification.priority,
    evidence,
    sha256: sha256Hex,
    events: [],
    draft: revision,
    scope: 'run',
  });
  await repositories.leads.create(lead);
  await repositories.runs.create({ ...run, draftId: revision.draftId });
  for (const record of evidence)
    await repositories.enrichmentEvidence.create(record);
  await repositories.draftRevisions.create(revision);
  await repositories.verificationResults.create(verification);
  const service = new DraftService({
    repositories,
    reader: store.draftReader(),
    lifecycle,
    events: store.eventReader(),
    now: () => timestamp,
  });
  return { store, repositories, service, revision, verification };
}

const context = { traceId: ids.trace, requestId: ids.request };

describe('template drafts', () => {
  it('is grounded, verified and pending review after composition', async () => {
    const { service, revision, verification } = await seededDraft();
    expect(verification.draftPassed).toBe(true);
    expect(revision.body).toContain('2022 Toyota Camry');
    expect(revision.body).toContain('Springfield, VA');
    expect(revision.body).not.toContain('renewal next month');
    const history = await service.history(revision.draftId);
    expect(history?.view.revisions.map((entry) => entry.state)).toEqual([
      'pending_review',
    ]);
  });

  it('hides a latest revision still awaiting verification and refuses to review it', async () => {
    const { store, service, revision } = await seededDraft();
    store.documents.delete(
      `verificationResults/${revision.verificationResultId}`,
    );
    const history = await service.history(revision.draftId);
    expect(history?.view.revisions).toEqual([]);
    await expect(
      service.review({
        ...context,
        draftId: revision.draftId,
        revisionId: revision.revisionId,
        contentSha256: revision.contentSha256,
        decision: 'approved',
      }),
    ).rejects.toBeInstanceOf(DraftConflictError);
  });

  it('rejects a history whose superseded revision lost its verification', async () => {
    const { store, service, revision } = await seededDraft();
    await service.revise({
      ...context,
      draftId: revision.draftId,
      baseRevisionId: revision.revisionId,
      baseContentSha256: revision.contentSha256,
      subject: revision.subject,
      body: revision.body.replace('Hi Avery', 'Hello Avery'),
    });
    store.documents.delete(
      `verificationResults/${revision.verificationResultId}`,
    );
    await expect(service.history(revision.draftId)).rejects.toBeInstanceOf(
      DraftIntegrityError,
    );
  });
});

describe('content-bound reviews', () => {
  it('approves the latest revision once and records the run event atomically', async () => {
    const { store, service, revision } = await seededDraft();
    const view = await service.review({
      ...context,
      draftId: revision.draftId,
      revisionId: revision.revisionId,
      contentSha256: revision.contentSha256,
      decision: 'approved',
    });
    expect(view.revisions[0]?.state).toBe('approved');
    expect(view.reviews[0]).toMatchObject({
      reviewId: reviewIdFor(revision.revisionId),
      principal: { id: 'local-operator', authenticated: false },
      meaning: 'approved for manual use only; nothing is sent',
    });
    const events = store.list(`runs/${ids.run}/events`, 'sequence');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: 'draft.reviewed',
      status: 'complete',
    });
    await expect(
      service.review({
        ...context,
        draftId: revision.draftId,
        revisionId: revision.revisionId,
        contentSha256: revision.contentSha256,
        decision: 'rejected',
      }),
    ).rejects.toBeInstanceOf(DraftConflictError);
    expect(store.list(`runs/${ids.run}/events`, 'sequence')).toHaveLength(1);
  });

  it('rejects a mismatched digest without storing anything', async () => {
    const { store, service, revision } = await seededDraft();
    await expect(
      service.review({
        ...context,
        draftId: revision.draftId,
        revisionId: revision.revisionId,
        contentSha256: 'f'.repeat(64),
        decision: 'approved',
      }),
    ).rejects.toBeInstanceOf(DraftConflictError);
    expect(
      store.list(`outreachDrafts/${revision.draftId}/reviews`, 'decidedAt'),
    ).toEqual([]);
  });
});

describe('operator revisions', () => {
  it('supersedes the base and returns a clean edit to pending review', async () => {
    const { service, revision } = await seededDraft();
    const view = await service.revise({
      ...context,
      draftId: revision.draftId,
      baseRevisionId: revision.revisionId,
      baseContentSha256: revision.contentSha256,
      subject: revision.subject,
      body: revision.body.replace('Hi Avery', 'Hello Avery'),
    });
    expect(view.revisions.map((entry) => entry.state)).toEqual([
      'superseded',
      'pending_review',
    ]);
    expect(view.revisions[1]?.revision).toMatchObject({
      origin: 'operator_edit',
      revisionNumber: 2,
      previousRevisionId: revision.revisionId,
    });
  });

  it('blocks an edit that adds decision language and holds the run', async () => {
    const { repositories, service, revision } = await seededDraft();
    const view = await service.revise({
      ...context,
      draftId: revision.draftId,
      baseRevisionId: revision.revisionId,
      baseContentSha256: revision.contentSha256,
      subject: revision.subject,
      body: revision.body.replace(
        'A member of our team',
        'Guaranteed savings await. A member of our team',
      ),
    });
    const latest = view.revisions.at(-1);
    expect(latest?.state).toBe('verification_blocked');
    expect(
      latest?.verification.rules.find(
        (rule) => rule.ruleId === 'draft.no_decision_language',
      )?.matches,
    ).toEqual(['savings', 'guaranteed']);
    await expect(repositories.runs.get(ids.run)).resolves.toMatchObject({
      holds: ['draft_verification_blocked'],
    });
  });

  it('rejects a stale base revision and a review of a superseded revision', async () => {
    const { service, revision } = await seededDraft();
    await service.revise({
      ...context,
      draftId: revision.draftId,
      baseRevisionId: revision.revisionId,
      baseContentSha256: revision.contentSha256,
      subject: revision.subject,
      body: `${revision.body}`.replace('Hi Avery', 'Hello Avery'),
    });
    await expect(
      service.revise({
        ...context,
        draftId: revision.draftId,
        baseRevisionId: revision.revisionId,
        baseContentSha256: revision.contentSha256,
        subject: revision.subject,
        body: revision.body,
      }),
    ).rejects.toBeInstanceOf(DraftConflictError);
    await expect(
      service.review({
        ...context,
        draftId: revision.draftId,
        revisionId: revision.revisionId,
        contentSha256: revision.contentSha256,
        decision: 'approved',
      }),
    ).rejects.toBeInstanceOf(DraftConflictError);
  });
});
