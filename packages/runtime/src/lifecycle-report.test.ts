import type { LifecycleEvent } from '@leadflow-ai/domain';
import { describe, expect, it } from 'vitest';
import { createLifecycleReport } from './lifecycle-report.js';

const bundleId = '66666666-6666-4666-8666-666666666666';
const generatedAt = '2026-10-25T20:00:00.000Z';

function event(input: {
  eventId: string;
  runId: string;
  sequence: number;
  status: LifecycleEvent['status'];
  name: LifecycleEvent['name'];
  durationMs?: number | null;
  retryCount?: number;
  safeError?: LifecycleEvent['safeError'];
  systemBundleId?: string;
}): LifecycleEvent {
  return {
    schemaVersion: 'event-v1',
    eventId: input.eventId,
    runId: input.runId,
    traceId: '44444444-4444-4444-8444-444444444444',
    requestId: '55555555-5555-4555-8555-555555555555',
    sequence: input.sequence,
    runRevision: input.sequence - 1,
    name: input.name,
    occurredAt: generatedAt,
    step: null,
    status: input.status,
    durationMs: input.durationMs ?? null,
    attempt: input.retryCount === 1 ? 2 : 1,
    retryCount: input.retryCount ?? 0,
    authorization: 'not_applicable',
    safeError: input.safeError ?? null,
    systemBundleId: input.systemBundleId ?? bundleId,
    evidenceClass: 'synthetic-local',
    usage: null,
    usageUnavailableReason: 'no_model_or_paid_tool',
  };
}

describe('privacy-aware lifecycle reporting', () => {
  it('reports explicit run, failure, duration, retry, usage, and denominator counts', () => {
    const completeRun = '11111111-1111-4111-8111-111111111111';
    const failedRun = '22222222-2222-4222-8222-222222222222';
    const safeError = {
      code: 'transient_interpreter_fault' as const,
      category: 'runtime' as const,
      retryable: true,
      message: 'The deterministic interpreter fault remained after one retry.',
    };
    const events = [
      event({
        eventId: '00000000-0000-4000-8000-000000000001',
        runId: completeRun,
        sequence: 1,
        status: 'persisted',
        name: 'lead.persisted',
      }),
      event({
        eventId: '00000000-0000-4000-8000-000000000002',
        runId: completeRun,
        sequence: 2,
        status: 'complete',
        name: 'run.completed',
        durationMs: 50,
      }),
      event({
        eventId: '00000000-0000-4000-8000-000000000003',
        runId: failedRun,
        sequence: 1,
        status: 'persisted',
        name: 'lead.persisted',
      }),
      event({
        eventId: '00000000-0000-4000-8000-000000000004',
        runId: failedRun,
        sequence: 2,
        status: 'retrying',
        name: 'step.retry_scheduled',
        durationMs: 10,
        retryCount: 1,
        safeError,
      }),
      event({
        eventId: '00000000-0000-4000-8000-000000000005',
        runId: failedRun,
        sequence: 3,
        status: 'failed_retryable',
        name: 'run.failed',
        durationMs: 20,
        retryCount: 1,
        safeError,
      }),
    ];

    expect(
      createLifecycleReport({ events, generatedAt, systemBundleId: bundleId }),
    ).toMatchObject({
      schemaVersion: 'lifecycle-report-v1',
      evidenceClass: 'synthetic-local',
      runCount: 2,
      eventCount: 5,
      statusCounts: { complete: 1, failed_retryable: 1 },
      completionRate: {
        value: 0.5,
        numerator: 1,
        denominator: 2,
        exclusions: 0,
      },
      runsWithRetry: 1,
      safeErrorEventCount: 2,
      duration: {
        observedEvents: 3,
        unavailableEvents: 2,
        totalMs: 80,
        maximumMs: 50,
      },
      usage: {
        availableEvents: 0,
        unavailableEvents: 5,
        unavailableReason: 'no_model_or_paid_tool',
      },
    });
  });

  it('reports an empty terminal denominator as unknown and names exclusions', () => {
    const report = createLifecycleReport({
      events: [
        event({
          eventId: '00000000-0000-4000-8000-000000000006',
          runId: '11111111-1111-4111-8111-111111111111',
          sequence: 1,
          status: 'persisted',
          name: 'lead.persisted',
        }),
      ],
      generatedAt,
      systemBundleId: bundleId,
    });

    expect(report.completionRate).toMatchObject({
      value: null,
      numerator: 0,
      denominator: 0,
      exclusions: 1,
      reason: 'insufficient_data',
    });
  });

  it('rejects contact-shaped payloads, mixed bundles, and duplicate run sequences', () => {
    const base = event({
      eventId: '00000000-0000-4000-8000-000000000007',
      runId: '11111111-1111-4111-8111-111111111111',
      sequence: 1,
      status: 'persisted',
      name: 'lead.persisted',
    });
    expect(() =>
      createLifecycleReport({
        events: [{ ...base, email: 'avery@example.com' }],
        generatedAt,
        systemBundleId: bundleId,
      }),
    ).toThrow();
    expect(() =>
      createLifecycleReport({
        events: [
          {
            ...base,
            systemBundleId: '77777777-7777-4777-8777-777777777777',
          },
        ],
        generatedAt,
        systemBundleId: bundleId,
      }),
    ).toThrow(/mix system bundles/u);
    expect(() =>
      createLifecycleReport({
        events: [
          base,
          {
            ...base,
            eventId: '00000000-0000-4000-8000-000000000008',
          },
        ],
        generatedAt,
        systemBundleId: bundleId,
      }),
    ).toThrow(/duplicate run sequence/u);
  });
});
