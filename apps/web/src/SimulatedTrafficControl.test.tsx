// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IntakeClient } from './intake-client.js';
import type { RunClient } from './run-client.js';
import { SimulatedTrafficControl } from './SimulatedTrafficControl.js';
import { createTrafficFlight } from './simulated-traffic.js';

const BUNDLE = '01234567-0000-4000-8000-000000000000';
const RUN = '11111111-1111-4111-8111-111111111111';
const LEAD = '22222222-2222-4222-8222-222222222222';

afterEach(cleanup);

function clients(replayed: boolean) {
  const submit = vi.fn<IntakeClient>(async () => ({
    status: 'accepted' as const,
    value: {
      schemaVersion: 'intake-response-v1' as const,
      leadId: LEAD,
      runId: RUN,
      runRevision: 0,
      replayed,
      committedAt: '2026-10-27T12:00:00.000Z',
      evidenceClass: 'synthetic-local' as const,
    },
  }));
  const execute = vi.fn<NonNullable<RunClient['execute']>>(async () => ({
    status: 'error' as const,
    error: {
      code: 'revision_conflict' as const,
      category: 'conflict' as const,
      retryable: false,
      message: 'Already executed.',
    },
  }));
  const client: RunClient = {
    get: vi.fn(),
    resume: vi.fn(),
    execute,
  };
  return { submit, execute, client };
}

describe('SimulatedTrafficControl', () => {
  it('executes replayed leads too and counts them as already present', async () => {
    const flight = createTrafficFlight();
    const { submit, execute, client } = clients(true);
    render(
      <SimulatedTrafficControl
        systemBundleId={BUNDLE}
        submit={submit}
        client={client}
        intervalMs={0}
        flight={flight}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run 60 leads' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Finished: 0 new, 60 already present.',
      ),
    );
    expect(execute).toHaveBeenCalledTimes(60);
    expect(submit.mock.calls[0]?.[1]).toBe('traffic-v1-01234567-01');
  });

  it('keeps running across a remount and stops before the next lead', async () => {
    const flight = createTrafficFlight();
    const { submit, client } = clients(false);
    const view = render(
      <SimulatedTrafficControl
        systemBundleId={BUNDLE}
        submit={submit}
        client={client}
        intervalMs={50}
        flight={flight}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run 60 leads' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    view.unmount();
    render(
      <SimulatedTrafficControl
        systemBundleId={BUNDLE}
        submit={submit}
        client={client}
        intervalMs={50}
        flight={flight}
      />,
    );
    expect(flight.getState().status).toBe('running');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/^Stopped: /u),
    );
    expect(submit.mock.calls.length).toBeLessThan(60);
  });
});
