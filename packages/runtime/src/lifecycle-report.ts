import {
  LifecycleEventSchema,
  LifecycleReportSchema,
  type LifecycleEvent,
  type LifecycleReport,
  type RunStatus,
} from '@leadflow-ai/domain';

const reportedStatuses: RunStatus[] = [
  'persisted',
  'running',
  'retrying',
  'partial',
  'failed_retryable',
  'failed_terminal',
  'complete',
];

export function createLifecycleReport(input: {
  events: readonly unknown[];
  generatedAt: string;
  systemBundleId: string;
}): LifecycleReport {
  const events = input.events.map((event) => LifecycleEventSchema.parse(event));
  const latestByRun = new Map<string, LifecycleEvent>();
  const seenSequences = new Set<string>();
  for (const event of events) {
    if (event.systemBundleId !== input.systemBundleId) {
      throw new Error('Lifecycle report cannot mix system bundles.');
    }
    const sequenceKey = `${event.runId}:${event.sequence}`;
    if (seenSequences.has(sequenceKey)) {
      throw new Error('Lifecycle report found a duplicate run sequence.');
    }
    seenSequences.add(sequenceKey);
    const current = latestByRun.get(event.runId);
    if (current === undefined || event.sequence > current.sequence) {
      latestByRun.set(event.runId, event);
    }
  }

  const statusCounts = Object.fromEntries(
    reportedStatuses.map((status) => [status, 0]),
  ) as Record<RunStatus, number>;
  for (const event of latestByRun.values()) statusCounts[event.status] += 1;
  const complete = statusCounts.complete;
  const failures = statusCounts.failed_retryable + statusCounts.failed_terminal;
  const denominator = complete + failures;
  const exclusions = latestByRun.size - denominator;
  const durations = events.flatMap((event) =>
    event.durationMs === null ? [] : [event.durationMs],
  );
  const totalMs = durations.reduce((total, duration) => total + duration, 0);
  const runsWithRetry = new Set(
    events.filter((event) => event.retryCount > 0).map((event) => event.runId),
  ).size;
  const usageAvailableEvents = events.filter(
    (event) => event.usage !== null,
  ).length;

  return LifecycleReportSchema.parse({
    schemaVersion: 'lifecycle-report-v1',
    generatedAt: input.generatedAt,
    systemBundleId: input.systemBundleId,
    eventSchemaVersion: 'event-v1',
    evidenceClass: 'synthetic-local',
    runCount: latestByRun.size,
    eventCount: events.length,
    statusCounts,
    completionRate: {
      name: 'stored_run_completion_rate',
      value: denominator === 0 ? null : complete / denominator,
      numerator: complete,
      denominator,
      exclusions,
      window: 'latest_state_of_all_supplied_runs',
      minimumCount: 1,
      evidenceClass: 'synthetic-local',
      reason: denominator === 0 ? 'insufficient_data' : null,
    },
    runsWithRetry,
    safeErrorEventCount: events.filter((event) => event.safeError !== null)
      .length,
    duration: {
      observedEvents: durations.length,
      unavailableEvents: events.length - durations.length,
      totalMs,
      meanMs: durations.length === 0 ? null : totalMs / durations.length,
      maximumMs: durations.length === 0 ? null : Math.max(...durations),
    },
    usage: {
      availableEvents: usageAvailableEvents,
      unavailableEvents: events.length - usageAvailableEvents,
      unavailableReason:
        usageAvailableEvents === events.length ? null : 'no_model_or_paid_tool',
    },
    privacyBoundary:
      'lifecycle metadata only; excludes lead/contact/request/prompt/credential/raw-error payloads',
    limitations: [
      'Synthetic local run evidence only; no production reliability claim.',
      'Completion rate covers only supplied latest stored states and excludes active runs.',
      'Event duration is reported only when the stored event contains durationMs.',
    ],
  });
}
