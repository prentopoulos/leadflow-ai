import {
  DEFAULT_TRAFFIC_INTERVAL_MS,
  PLANNED_TRAFFIC_LEADS,
  runTrafficPlan,
  trafficIdempotencyKey,
} from '@leadflow-ai/domain';
import type { IntakeClient } from './intake-client.js';
import type { RunClient } from './run-client.js';

export type TrafficState =
  | { status: 'idle' }
  | { status: 'running'; done: number; stopping: boolean }
  | { status: 'finished'; created: number; replayed: number; stopped: boolean }
  | { status: 'failed'; done: number; message: string };

// One flight per page. The store outlives the control, so switching to the
// Runs tab to approve drafts does not stop it; a reload does.
export function createTrafficFlight() {
  let state: TrafficState = { status: 'idle' };
  let stopRequested = false;
  let wake: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const set = (next: TrafficState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  function whenVisible(): Promise<void> {
    if (document.visibilityState === 'visible') return Promise.resolve();
    return new Promise((resolve) => {
      const listener = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', listener);
        resolve();
      };
      document.addEventListener('visibilitychange', listener);
    });
  }

  async function start(options: {
    systemBundleId: string;
    submit: IntakeClient;
    client: RunClient;
    intervalMs?: number;
  }) {
    if (state.status === 'running') return;
    stopRequested = false;
    let done = 0;
    set({ status: 'running', done, stopping: false });
    try {
      const result = await runTrafficPlan({
        count: PLANNED_TRAFFIC_LEADS,
        intervalMs: options.intervalMs ?? DEFAULT_TRAFFIC_INTERVAL_MS,
        shouldStop: () => stopRequested,
        sleep: async (milliseconds) => {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, milliseconds);
            wake = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          wake = null;
          if (!stopRequested) await whenVisible();
        },
        async submit(entry) {
          await whenVisible();
          const accepted = await options.submit(
            entry.intake,
            trafficIdempotencyKey(options.systemBundleId, entry.index),
          );
          if (accepted.status === 'rejected') {
            throw new Error(accepted.error.message);
          }
          const { runId, runRevision, replayed } = accepted.value;
          // Replayed leads are executed too: a run whose first execution was
          // cut off is still persisted, and one that already ran answers with
          // a harmless conflict.
          if (options.client.execute !== undefined) {
            const executed = await options.client.execute(runId, runRevision);
            if (
              executed.status === 'error' &&
              executed.error.code !== 'execution_deadline' &&
              executed.error.code !== 'revision_conflict' &&
              executed.error.code !== 'run_ineligible'
            ) {
              throw new Error(executed.error.message);
            }
          }
          done += 1;
          if (state.status === 'running') set({ ...state, done });
          return replayed ? 'replayed' : 'created';
        },
      });
      set({ status: 'finished', ...result });
    } catch (error) {
      set({
        status: 'failed',
        done,
        message:
          error instanceof Error ? error.message : 'Simulated traffic stopped.',
      });
    }
  }

  function stop() {
    stopRequested = true;
    wake?.();
    if (state.status === 'running') set({ ...state, stopping: true });
  }

  return {
    start,
    stop,
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type TrafficFlight = ReturnType<typeof createTrafficFlight>;
export const trafficFlight = createTrafficFlight();
