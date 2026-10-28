// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { SessionResponse } from '@leadflow-ai/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulationStrip } from './Masthead.js';
import { SessionGate } from './session.js';
import {
  apiFetch,
  loadSession,
  type SessionLoader,
  type SessionState,
} from './session-context.js';

const hosted: SessionResponse = {
  schemaVersion: 'session-response-v1',
  mode: 'cloud',
  operator: 'private-owner',
  authentication: 'iap-verified',
  enrichmentMode: 'recorded',
};

function errorBody(code: string, category: string) {
  return {
    schemaVersion: 'error-response-v1',
    error: { code, category, retryable: false, message: 'Denied.' },
    requestId: '55555555-5555-4555-8555-555555555555',
  };
}

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('session gate', () => {
  it('shows signing-in, then the hosted label without identity values', async () => {
    let resolve: (value: SessionState) => void = () => undefined;
    const loader: SessionLoader = () =>
      new Promise((done) => {
        resolve = done;
      });
    render(
      <SessionGate loader={loader}>
        <SimulationStrip />
      </SessionGate>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Checking access…');
    await act(async () => resolve({ status: 'ready', session: hosted }));
    expect(
      screen.getByText('SIMULATION', { selector: 'strong' }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@|accounts\.google/u);
  });

  it.each([
    ['expired', 'Session expired', 'Sign in again'],
    ['denied', 'Access denied', null],
    ['unavailable', 'Service unavailable', 'Retry'],
  ] as const)(
    'renders the %s state and focuses its heading',
    async (status, title, action) => {
      render(
        <SessionGate loader={async () => ({ status })}>
          <p>workspace</p>
        </SessionGate>,
      );
      const heading = await screen.findByRole('heading', { name: title });
      // Focus moves in an effect after the heading commits; under a loaded
      // parallel run the query can resolve between the two.
      await waitFor(() => expect(heading).toHaveFocus());
      expect(screen.queryByText('workspace')).not.toBeInTheDocument();
      if (action !== null) {
        expect(
          screen.getByRole('button', { name: action }),
        ).toBeInTheDocument();
      }
    },
  );

  it('unmounts the workspace when a later request loses its session', async () => {
    vi.stubGlobal(
      'fetch',
      respond(401, errorBody('authentication_required', 'access')),
    );
    render(
      <SessionGate initial={hosted}>
        <p>workspace</p>
      </SessionGate>,
    );
    expect(screen.getByText('workspace')).toBeInTheDocument();
    await act(async () => {
      await apiFetch('/v1/runs');
    });
    expect(
      screen.getByRole('heading', { name: 'Session expired' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('workspace')).not.toBeInTheDocument();
  });

  it('unmounts the workspace when IAP returns a non-JSON denial', async () => {
    vi.stubGlobal('fetch', respond(403, '<html>IAP denial</html>'));
    render(
      <SessionGate initial={hosted}>
        <p>workspace</p>
      </SessionGate>,
    );
    expect(screen.getByText('workspace')).toBeInTheDocument();
    await act(async () => {
      await apiFetch('/v1/runs');
    });
    expect(
      screen.getByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('workspace')).not.toBeInTheDocument();
  });

  it('keeps the local label for the loopback operator', () => {
    render(
      <SessionGate
        initial={{
          schemaVersion: 'session-response-v1',
          mode: 'local',
          operator: 'local-operator',
          authentication: 'none-loopback',
        }}
      >
        <SimulationStrip />
      </SessionGate>,
    );
    expect(
      screen.getByText('SIMULATION', { selector: 'strong' }),
    ).toBeInTheDocument();
  });
});

describe('session loading', () => {
  it('marks every API request as script-originated for IAP', async () => {
    const fetcher = respond(200, hosted);
    vi.stubGlobal('fetch', fetcher);
    await expect(loadSession()).resolves.toEqual({
      status: 'ready',
      session: hosted,
    });
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get('X-Requested-With')).toBe(
      'XMLHttpRequest',
    );
  });

  it.each([
    [401, errorBody('authentication_required', 'access'), 'expired'],
    [403, errorBody('access_denied', 'access'), 'denied'],
    [401, '<html>IAP</html>', 'expired'],
    [403, '<html>IAP denial</html>', 'denied'],
    [503, errorBody('storage_unavailable', 'storage'), 'unavailable'],
  ])('maps HTTP %s to its session state', async (status, body, expected) => {
    vi.stubGlobal('fetch', respond(status, body));
    await expect(loadSession()).resolves.toEqual({ status: expected });
  });
});
