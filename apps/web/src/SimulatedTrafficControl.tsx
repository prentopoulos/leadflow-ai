import {
  DEFAULT_TRAFFIC_INTERVAL_MS,
  PLANNED_TRAFFIC_LEADS,
  runTrafficPlan,
  trafficIdempotencyKey,
} from '@leadflow-ai/domain';
import { useEffect, useRef, useState } from 'react';
import { submitIntake as defaultSubmit } from './intake-client.js';
import type { IntakeClient } from './intake-client.js';
import { runClient as defaultRunClient, type RunClient } from './run-client.js';

type TrafficState =
  | { status: 'idle' }
  | { status: 'running'; done: number; stopping: boolean }
  | { status: 'finished'; created: number; replayed: number; stopped: boolean }
  | { status: 'failed'; done: number; message: string };

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

// Hosted only. Runs traffic-plan-v1 from the owner's signed-in tab through
// the same intake and held execution requests as a manual lead; nothing runs
// server-side or without this tab. Hidden tabs pause; Stop takes effect
// before the next lead.
export function SimulatedTrafficControl({
  systemBundleId,
  submit = defaultSubmit,
  client = defaultRunClient,
  intervalMs = DEFAULT_TRAFFIC_INTERVAL_MS,
}: {
  systemBundleId: string;
  submit?: IntakeClient;
  client?: RunClient;
  intervalMs?: number;
}) {
  const [state, setState] = useState<TrafficState>({ status: 'idle' });
  const stopRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      stopRef.current = true;
      wakeRef.current?.();
    },
    [],
  );

  async function start() {
    stopRef.current = false;
    let done = 0;
    setState({ status: 'running', done, stopping: false });
    try {
      const result = await runTrafficPlan({
        count: PLANNED_TRAFFIC_LEADS,
        intervalMs,
        shouldStop: () => stopRef.current,
        sleep: async (milliseconds) => {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, milliseconds);
            wakeRef.current = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          wakeRef.current = null;
          if (!stopRef.current) await whenVisible();
        },
        async submit(entry) {
          await whenVisible();
          const accepted = await submit(
            entry.intake,
            trafficIdempotencyKey(systemBundleId, entry.index),
          );
          if (accepted.status === 'rejected') {
            throw new Error(accepted.error.message);
          }
          const { runId, runRevision, replayed } = accepted.value;
          if (!replayed && client.execute !== undefined) {
            const executed = await client.execute(runId, runRevision);
            // A deadline leaves a resumable stored run; conflicts mean another
            // request already holds it. Either way the next lead can go.
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
          setState((current) =>
            current.status === 'running' ? { ...current, done } : current,
          );
          return replayed ? 'replayed' : 'created';
        },
      });
      setState({ status: 'finished', ...result });
    } catch (error) {
      setState({
        status: 'failed',
        done,
        message:
          error instanceof Error ? error.message : 'Simulated traffic stopped.',
      });
    }
  }

  function stop() {
    stopRef.current = true;
    wakeRef.current?.();
    setState((current) =>
      current.status === 'running' ? { ...current, stopping: true } : current,
    );
  }

  const running = state.status === 'running';
  return (
    <section
      className="synthetic-panel traffic-control"
      aria-labelledby="traffic-control-title"
    >
      <h2 id="traffic-control-title">Simulated traffic</h2>
      <p>
        Sends {PLANNED_TRAFFIC_LEADS} fictional leads with simulated channels
        and campaigns, one every {intervalMs / 1_000} s, from this tab only.
        Drafts still wait for your approval.
      </p>
      <div className="traffic-control-actions">
        {running ? (
          <button
            type="button"
            className="secondary-action"
            onClick={stop}
            disabled={state.stopping}
          >
            {state.stopping ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button
            type="button"
            className="primary-action"
            onClick={() => void start()}
          >
            Run simulated traffic
          </button>
        )}
        <p role="status" aria-live="polite">
          {state.status === 'running'
            ? `Lead ${state.done} of ${PLANNED_TRAFFIC_LEADS} sent.`
            : state.status === 'finished'
              ? `${state.stopped ? 'Stopped' : 'Finished'}: ${state.created} new, ${state.replayed} already present.`
              : state.status === 'failed'
                ? `Stopped after ${state.done} leads: ${state.message}`
                : null}
        </p>
      </div>
    </section>
  );
}
