// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentToggle } from './AgentToggle.js';

const settings = (available: boolean, enabled: boolean) => ({
  schemaVersion: 'agent-settings-v1',
  available,
  enabled,
  leadCapUsd: 0.3,
  processCapUsd: 8,
  spentUsd: 0.1185,
});
const reply = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('agent switch', () => {
  afterEach(cleanup);

  it('turns the team on and shows the session spend', async () => {
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) =>
      reply(settings(true, init?.method === 'PUT')),
    );
    render(<AgentToggle fetcher={fetcher as unknown as typeof fetch} />);
    const button = await screen.findByRole('button', {
      name: 'Turn agents on',
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('$0.1185');
    fireEvent.click(button);
    expect(
      await screen.findByRole('button', { name: 'Agents on · turn off' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(fetcher).toHaveBeenLastCalledWith(
      '/v1/agents',
      expect.objectContaining({ method: 'PUT', body: '{"enabled":true}' }),
    );
  });

  it('explains how to enable it without a key', async () => {
    const fetcher = vi.fn(async () => reply(settings(false, false)));
    render(<AgentToggle fetcher={fetcher as unknown as typeof fetch} />);
    expect(await screen.findByText(/no API key/u)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
