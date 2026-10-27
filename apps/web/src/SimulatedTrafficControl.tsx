import {
  DEFAULT_TRAFFIC_INTERVAL_MS,
  PLANNED_TRAFFIC_LEADS,
} from '@leadflow-ai/domain';
import { useSyncExternalStore } from 'react';
import { submitIntake as defaultSubmit } from './intake-client.js';
import type { IntakeClient } from './intake-client.js';
import { runClient as defaultRunClient, type RunClient } from './run-client.js';
import { trafficFlight, type TrafficFlight } from './simulated-traffic.js';

// Hosted only. Runs traffic-plan-v1 from the owner's signed-in tab through
// the same intake and held execution requests as a manual lead; nothing runs
// server-side or without this page. Hidden tabs pause; Stop takes effect
// before the next lead; switching tabs inside the app does not stop it.
export function SimulatedTrafficControl({
  systemBundleId,
  submit = defaultSubmit,
  client = defaultRunClient,
  intervalMs = DEFAULT_TRAFFIC_INTERVAL_MS,
  flight = trafficFlight,
}: {
  systemBundleId: string;
  submit?: IntakeClient;
  client?: RunClient;
  intervalMs?: number;
  flight?: TrafficFlight;
}) {
  const state = useSyncExternalStore(flight.subscribe, flight.getState);
  const running = state.status === 'running';
  return (
    <section
      className="synthetic-panel traffic-control"
      aria-labelledby="traffic-control-title"
    >
      <h2 id="traffic-control-title">Simulated traffic</h2>
      <p>
        Sends {PLANNED_TRAFFIC_LEADS} fictional leads with simulated channels
        and campaigns, one every {intervalMs / 1_000} s (about{' '}
        {Math.round((PLANNED_TRAFFIC_LEADS * intervalMs) / 60_000)} minutes)
        from this page only. Keep the tab visible: a hidden tab pauses. Drafts
        still wait for your approval.
      </p>
      <div className="traffic-control-actions">
        {running ? (
          <button
            type="button"
            className="secondary-action"
            onClick={flight.stop}
            disabled={state.stopping}
          >
            {state.stopping ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button
            type="button"
            className="secondary-action"
            onClick={() =>
              void flight.start({ systemBundleId, submit, client, intervalMs })
            }
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
                ? `Stopped after ${state.done} leads: ${state.message} Run again: stored leads are skipped.`
                : null}
        </p>
      </div>
    </section>
  );
}
