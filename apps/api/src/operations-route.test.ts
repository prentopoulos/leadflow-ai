import { acquisitionReport } from '@leadflow-ai/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import type { PhaseOneStartup } from './startup.js';

const bundleId = '66666666-6666-4666-8666-666666666666';
const runId = '22222222-2222-4222-8222-222222222222';
const leadId = '11111111-1111-4111-8111-111111111111';
const timestamp = '2026-10-25T20:00:00.000Z';
const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map(async (app) => app.close()));
  apps.clear();
});

function startup(): PhaseOneStartup {
  return {
    status: 'ready',
    configuration: {
      mode: 'local',
      configurationVersion: 'phase-2-local-v1',
      projectId: 'demo-leadflow-ai-local',
      firestoreHost: '127.0.0.1:8080',
      apiHost: 'localhost',
      localResetEnabled: false,
      enrichmentMode: 'recorded',
      webOrigin: 'http://127.0.0.1:5173',
    },
    firestore: {
      app: {} as never,
      database: {} as never,
      configuration: {
        projectId: 'demo-leadflow-ai-local',
        host: '127.0.0.1:8080',
      },
      close: async () => undefined,
    },
  };
}

const emptyDuration = {
  n: 0,
  medianMs: null,
  p90Ms: null,
  meanMs: null,
  excluded: 0,
  reason: 'insufficient_data' as const,
};
const emptyRate = {
  value: null,
  numerator: 0,
  denominator: 0,
  excluded: 0,
  reason: 'insufficient_data' as const,
};

function buildApp() {
  const list = vi.fn(async () => ({
    schemaVersion: 'run-list-response-v1' as const,
    filter: 'approval_queue' as const,
    items: [
      {
        runId,
        leadId,
        shortLeadId: '11111111',
        status: 'complete' as const,
        priority: 'high' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
        attempt: 1,
        retryCount: 0,
        currentStep: null,
        evidenceCompleteness: 'complete' as const,
        enrichmentMode: 'recorded' as const,
        draftState: 'pending_review' as const,
        draftSkipReason: null,
        holds: [],
        leaseState: 'none' as const,
        resumable: false,
        revision: 20,
      },
    ],
    nextCursor: null,
    totalMatching: 1,
    retrievedAt: timestamp,
    evidenceClass: 'synthetic-local' as const,
  }));
  const metrics = vi.fn(async () => ({
    schemaVersion: 'metrics-report-v2' as const,
    definitionsVersion: 'metrics-definitions-v2' as const,
    generatedAt: timestamp,
    systemBundleId: bundleId,
    window: { runsInWindow: 0, activeRuns: 0, otherBundleRuns: 0 },
    leadVolume: 0,
    priorityDistribution: {
      high: 0,
      standard: 0,
      nurture: 0,
      held: 0,
      not_scored: 0,
    },
    processingTime: emptyDuration,
    reviewLatency: emptyDuration,
    enrichment: (['live', 'recorded_or_mock'] as const).flatMap((classGroup) =>
      (['all', 'nhtsa_vpic', 'zippopotam_us'] as const).map((source) => ({
        classGroup,
        source,
        success: emptyRate,
        foundRate: emptyRate,
        notAttempted: 0,
      })),
    ),
    agentFailures: emptyRate,
    failuresByStep: {
      interpret_qualification: 0,
      score_qualification: 0,
      enrich_lead: 0,
      compose_draft: 0,
      verify_outputs: 0,
      simulate_outcome: 0,
      finalize_run: 0,
    },
    approvalQueue: 0,
    simulation: {
      label: 'SYNTHETIC' as const,
      runs: 0,
      contacted: 0,
      responded: 0,
      appointment: 0,
    },
    acquisition: acquisitionReport([]),
    evidenceClass: 'synthetic-local' as const,
  }));
  const app = createApp({
    phaseOne: startup(),
    operations: { operations: { list, metrics }, systemBundleId: bundleId },
  });
  apps.add(app);
  return { app, list, metrics };
}

describe('Phase 2 operations routes', () => {
  it('passes bounded list filters and returns contact-free summaries', async () => {
    const { app, list } = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/runs?filter=approval_queue&limit=10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      filter: 'approval_queue',
      totalMatching: 1,
    });
    expect(response.body).not.toContain('@example.com');
    expect(list).toHaveBeenCalledWith({
      filter: 'approval_queue',
      cursor: null,
      limit: 10,
    });
  });

  it('serves named definitions beside an empty-denominator metrics report', async () => {
    const { app, metrics } = buildApp();
    const response = await app.inject({ method: 'GET', url: '/v1/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: 'metrics-response-v1',
      definitions: { version: 'metrics-definitions-v2' },
      report: {
        leadVolume: 0,
        agentFailures: { value: null, reason: 'insufficient_data' },
      },
    });
    expect(metrics).toHaveBeenCalledWith(bundleId);
  });

  it('rejects an invalid list filter before calling storage', async () => {
    const { app, list } = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/runs?filter=unknown',
    });
    expect(response.statusCode).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
});
