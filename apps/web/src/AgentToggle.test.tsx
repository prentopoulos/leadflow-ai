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

  it('opens a focused key form and enables agents after a safe save', async () => {
    const apiKey = `sk-ant-${'a'.repeat(24)}`;
    const fetcher = vi.fn(async (input: unknown, init?: RequestInit) =>
      reply(
        String(input).endsWith('/key') && init?.method === 'PUT'
          ? settings(true, true)
          : settings(false, false),
      ),
    );
    render(<AgentToggle fetcher={fetcher as unknown as typeof fetch} />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Turn on agent research',
      }),
    );
    const input = screen.getByLabelText('Anthropic API key');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByText(/gitignored/u)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: apiKey } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save key and turn on' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Agents on · turn off' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByDisplayValue(apiKey)).toBeNull();
    expect(fetcher).toHaveBeenLastCalledWith(
      '/v1/agents/key',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ apiKey }),
      }),
    );
  });

  it('keeps the form open and announces a safe save failure', async () => {
    const fetcher = vi.fn(async (input: unknown) =>
      String(input).endsWith('/key')
        ? new Response('{}', { status: 500 })
        : reply(settings(false, false)),
    );
    render(<AgentToggle fetcher={fetcher as unknown as typeof fetch} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Turn on agent research' }),
    );
    fireEvent.change(screen.getByLabelText('Anthropic API key'), {
      target: { value: `sk-ant-${'a'.repeat(24)}` },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save key and turn on' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'nothing was enabled',
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Anthropic API key')).toBeEnabled(),
    );
    expect(
      screen.queryByRole('button', { name: 'Agents on · turn off' }),
    ).toBeNull();
  });
});
