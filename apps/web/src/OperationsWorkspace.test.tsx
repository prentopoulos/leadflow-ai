// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { createHash } from 'node:crypto';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  COMPLIANCE_NOTICE,
  acquisitionReport,
  canonicalDraftContent,
  composeDraft,
  composerInputFrom,
  currentConsentRecord,
  verifyOutputs,
  type DraftView,
  type MetricsResponse,
  type RateValue,
  type RunDetailResponse,
  type RunListResponse,
  type RunSummary,
} from '@leadflow-ai/domain';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MetricsDashboard } from './MetricsDashboard.js';
import type { OperationsClient } from './operations-client.js';
import { OperationsWorkspace } from './OperationsWorkspace.js';
import type { RunClient } from './run-client.js';
import { DraftSection } from './RunEvidence.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');
const ids = {
  lead: '11111111-1111-4111-8111-111111111111',
  run: '22222222-2222-4222-8222-222222222222',
  bundle: '66666666-6666-4666-8666-666666666666',
  draft: '55555555-5555-4555-8555-555555555555',
  revision: '88888888-8888-4888-8888-888888888888',
  verification: '77777777-7777-4777-8777-777777777777',
};
const timestamp = '2026-10-25T18:00:00.000Z';

beforeAll(() => {
  // Recharts measures its container; jsdom has no layout engine.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

const summary: RunSummary = {
  runId: ids.run,
  leadId: ids.lead,
  shortLeadId: '11111111',
  status: 'complete',
  priority: 'high',
  createdAt: timestamp,
  updatedAt: timestamp,
  attempt: 1,
  retryCount: 0,
  currentStep: null,
  evidenceCompleteness: 'complete',
  enrichmentMode: 'recorded',
  draftState: 'pending_review',
  draftSkipReason: null,
  holds: [],
  leaseState: 'none',
  resumable: false,
  revision: 30,
};

function listResponse(items: RunSummary[]): RunListResponse {
  return {
    schemaVersion: 'run-list-response-v1',
    filter: 'all',
    items,
    nextCursor: null,
    totalMatching: items.length,
    retrievedAt: timestamp,
    evidenceClass: 'synthetic-local',
  };
}

const rate = (
  numerator: number,
  denominator: number,
  excluded = 0,
): RateValue => ({
  value: denominator === 0 ? null : numerator / denominator,
  numerator,
  denominator,
  excluded,
  reason: denominator === 0 ? 'insufficient_data' : null,
});

function metricsResponse(): MetricsResponse {
  const enrichment = (['recorded_or_mock', 'live'] as const).flatMap(
    (classGroup) =>
      (['all', 'nhtsa_vpic', 'zippopotam_us'] as const).map((source) => ({
        classGroup,
        source,
        success: classGroup === 'live' ? rate(0, 0) : rate(9, 10),
        foundRate: classGroup === 'live' ? rate(0, 0) : rate(7, 10),
        notAttempted: 1,
      })),
  );
  return {
    schemaVersion: 'metrics-response-v1',
    definitions: {},
    retrievedAt: timestamp,
    report: {
      schemaVersion: 'metrics-report-v2',
      definitionsVersion: 'metrics-definitions-v2',
      generatedAt: timestamp,
      systemBundleId: ids.bundle,
      window: { runsInWindow: 10, activeRuns: 0, otherBundleRuns: 2 },
      leadVolume: 10,
      priorityDistribution: {
        high: 4,
        standard: 3,
        nurture: 2,
        held: 1,
        not_scored: 0,
      },
      processingTime: {
        n: 10,
        medianMs: 420,
        p90Ms: 900,
        meanMs: 480,
        excluded: 0,
        reason: null,
      },
      reviewLatency: {
        n: 0,
        medianMs: null,
        p90Ms: null,
        meanMs: null,
        excluded: 6,
        reason: 'insufficient_data',
      },
      enrichment,
      agentFailures: rate(1, 10),
      failuresByStep: {
        interpret_qualification: 1,
        score_qualification: 0,
        enrich_lead: 0,
        compose_draft: 0,
        verify_outputs: 0,
        simulate_outcome: 0,
        finalize_run: 0,
      },
      approvalQueue: 6,
      simulation: {
        label: 'SYNTHETIC',
        runs: 10,
        contacted: 6,
        responded: 3,
        appointment: 1,
      },
      // Ten synthetic leads matching the priority distribution above.
      acquisition: acquisitionReport(
        (
          [
            'high',
            'high',
            'high',
            'high',
            'standard',
            'standard',
            'standard',
            'nurture',
            'nurture',
            'held',
          ] as const
        ).map((priority, index) => ({
          attribution:
            index % 2 === 0
              ? null
              : {
                  source: 'google',
                  medium: 'cpc',
                  campaign: 'sim-search-auto-insurance-q4',
                  clickId: null,
                  clickIdClass: null,
                },
          priority,
          failed: false,
          consented: index !== 3,
        })),
      ),
      evidenceClass: 'synthetic-local',
    },
  };
}

function draftView(): DraftView {
  const intake = {
    schemaVersion: 'intake-v3' as const,
    identityClass: 'fictional' as const,
    givenName: 'Avery',
    familyName: 'Jordan',
    email: 'avery.jordan@example.com',
    zipCode: '22150',
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    coverageFocus: 'balanced' as const,
    requestIntent: 'compare_options' as const,
    needTimeline: 'within_30_days' as const,
    requestDetails: null,
    emailContactConsent: true,
    consentRecord: currentConsentRecord(),
    attribution: null,
  };
  const composed = composeDraft(
    composerInputFrom({ intake, priority: 'high', evidence: [] }),
  );
  const revision = {
    schemaVersion: 'outreach-draft-v1' as const,
    draftId: ids.draft,
    revisionId: ids.revision,
    revisionNumber: 1,
    previousRevisionId: null,
    runId: ids.run,
    leadId: ids.lead,
    createdAt: timestamp,
    origin: 'template' as const,
    composerVersion: 'deterministic-template-v1' as const,
    agentBriefId: null,
    channel: 'email' as const,
    subject: composed.subject,
    body: composed.body,
    slots: composed.slots,
    followUpAction: composed.followUpAction,
    contentSha256: sha256(
      canonicalDraftContent(composed.subject, composed.body),
    ),
    verificationResultId: ids.verification,
  };
  const verification = verifyOutputs({
    verificationResultId: ids.verification,
    runId: ids.run,
    leadId: ids.lead,
    verifiedAt: timestamp,
    intake,
    priority: 'high',
    evidence: [],
    sha256,
    events: [],
    draft: revision,
    scope: 'run',
  });
  return {
    revisions: [{ revision, state: 'pending_review', verification }],
    reviews: [],
    agentBrief: null,
    complianceNotice: COMPLIANCE_NOTICE,
  };
}

function operationsClient(
  overrides: Partial<OperationsClient> = {},
): OperationsClient {
  return {
    list: vi.fn(async () => ({
      status: 'ok' as const,
      value: listResponse([summary]),
    })),
    metrics: vi.fn(async () => ({
      status: 'ok' as const,
      value: metricsResponse(),
    })),
    revise: vi.fn(),
    review: vi.fn(async () => ({
      status: 'ok' as const,
      value: {
        schemaVersion: 'draft-action-response-v1' as const,
        runId: ids.run,
        draft: draftView(),
      },
    })),
    ...overrides,
  };
}

const pendingRunClient: RunClient = {
  get: () => new Promise<never>(() => undefined),
  resume: vi.fn(),
};

describe('operations workspace', () => {
  it('lists privacy-safe summaries and filters to the approval queue', async () => {
    const client = operationsClient();
    render(
      <OperationsWorkspace
        view="runs"
        operationsClient={client}
        runClient={pendingRunClient}
      />,
    );
    const list = await screen.findByRole('list');
    expect(within(list).getByText('Lead 11111111')).toBeInTheDocument();
    expect(screen.queryByText(/avery/iu)).not.toBeInTheDocument();
    expect(screen.getByText('SIMULATION')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Approval queue/u }));
    await waitFor(() =>
      expect(client.list).toHaveBeenCalledWith('approval_queue', undefined, 12),
    );
  });

  it('keeps the last snapshot visible and labelled stale when a refresh fails', async () => {
    let calls = 0;
    const client = operationsClient({
      list: vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? { status: 'ok' as const, value: listResponse([summary]) }
          : {
              status: 'error' as const,
              error: {
                code: 'storage_unavailable' as const,
                category: 'storage' as const,
                retryable: true,
                message: 'Stored operations data is temporarily unavailable.',
              },
            };
      }),
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <OperationsWorkspace
          view="runs"
          operationsClient={client}
          runClient={pendingRunClient}
        />,
      );
      const list = await screen.findByRole('list');
      await vi.advanceTimersByTimeAsync(3_100);
      expect(await screen.findByText('Refresh failed')).toBeInTheDocument();
      expect(within(list).getByText('Lead 11111111')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Phase 3 accessibility refinements', () => {
  it('exposes pressed filters, concise card names and the keyboard guide', async () => {
    render(
      <OperationsWorkspace
        view="runs"
        operationsClient={operationsClient()}
        runClient={pendingRunClient}
      />,
    );
    const filters = await screen.findByRole('group', { name: 'Run filters' });
    expect(
      within(filters).getByRole('button', { name: 'All runs' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(filters).getByRole('button', { name: /Approval queue/u }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      await screen.findByRole('button', {
        name: 'Lead 11111111, Complete, High priority, draft pending review',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
  });

  it('focuses the review confirmation and offers the next pending draft', async () => {
    const open = vi.fn();
    render(
      <DraftSection
        draft={draftView()}
        skipReason={null}
        client={operationsClient()}
        onChanged={async () => undefined}
        nextPending={{ label: 'Lead 99999999', open }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reject/u }));
    const confirmation = await screen.findByText(
      'Rejected. The draft stays stored.',
    );
    await waitFor(() => expect(confirmation).toHaveFocus());
    fireEvent.click(
      screen.getByRole('button', { name: 'Next pending: Lead 99999999' }),
    );
    expect(open).toHaveBeenCalled();
  });

  it('says when no other draft is waiting', async () => {
    render(
      <DraftSection
        draft={draftView()}
        skipReason={null}
        client={operationsClient()}
        onChanged={async () => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Approve for manual use/u }),
    );
    expect(
      await screen.findByText('No other drafts are waiting.'),
    ).toBeInTheDocument();
  });

  it('frames the chart with a caption that names its table', async () => {
    render(<MetricsDashboard client={operationsClient()} section="pipeline" />);
    expect(
      await screen.findByRole('figure', { name: /Stored runs by priority/u }),
    ).toBeInTheDocument();
  });
});

describe('metrics dashboard', () => {
  it('names denominators, shows insufficient data and keeps synthetic outcomes apart', async () => {
    const view = render(
      <MetricsDashboard client={operationsClient()} section="pipeline" />,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pipeline' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Priority distribution' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Insufficient data|Not reviewed yet/u).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('1 of 10').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', { name: 'Outcomes' }),
    ).toBeInTheDocument();
    view.unmount();

    render(
      <MetricsDashboard client={operationsClient()} section="enrichment" />,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Enrichment' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row', { name: /Live/u })).toHaveLength(3);
  });
});

describe('draft review', () => {
  it('approves the exact revision digest and confirms nothing is sent', async () => {
    const client = operationsClient();
    const onChanged = vi.fn(async () => undefined);
    const view = draftView();
    render(
      <DraftSection
        draft={view}
        skipReason={null}
        client={client}
        onChanged={onChanged}
      />,
    );
    expect(screen.getByText(/Nothing is sent/u)).toBeInTheDocument();
    expect(screen.getByText(/Not sendable as written/u)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Copy/u }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Approve for manual use/u }),
    );
    await waitFor(() =>
      expect(client.review).toHaveBeenCalledWith(ids.draft, {
        revisionId: ids.revision,
        contentSha256: view.revisions[0]!.revision.contentSha256,
        decision: 'approved',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Nothing was sent.',
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('explains a skipped draft without offering actions', () => {
    render(
      <DraftSection
        draft={null}
        skipReason="no_consent"
        client={operationsClient()}
        onChanged={async () => undefined}
      />,
    );
    expect(screen.getByText('No consent')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

export type { RunDetailResponse };
