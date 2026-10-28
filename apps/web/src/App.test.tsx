// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(cleanup);

const accepted = {
  status: 'accepted',
  value: {
    schemaVersion: 'intake-response-v1',
    leadId: '11111111-1111-4111-8111-111111111111',
    runId: '22222222-2222-4222-8222-222222222222',
    runRevision: 0,
    replayed: false,
    committedAt: '2026-10-25T18:00:00.000Z',
    evidenceClass: 'synthetic-local',
  },
} as const;

describe('Phase 1 intake workspace', () => {
  it('renders the persistent synthetic context and honest operating boundary', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByText(/SIMULATION/i, { selector: 'strong' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'New lead',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No stored run/i)).toBeInTheDocument();
    expect(
      screen.getByText('LeadFlow AI · local prototype'),
    ).toBeInTheDocument();
  });

  it('copies the Military.com flow and separates the LeadFlow scoring step', () => {
    render(<App />);

    expect(
      screen.getByRole('group', { name: /Military.com auto quote/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Are you currently insured?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /LeadFlow scoring questions/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toHaveValue('703-555-0100');
    expect(screen.getByLabelText(/ZIP Code/i)).toHaveValue('22150');
    expect(screen.getByLabelText(/Test email/i)).toHaveValue(
      'avery.jordan@example.com',
    );
    expect(
      screen.getByLabelText(/operator may prepare an email/i),
    ).not.toBeChecked();
  });

  it('validates through the shared intake contract and focuses the linked summary', () => {
    render(<App />);

    const email = screen.getByLabelText(/Test email/i);
    const zip = screen.getByLabelText(/ZIP Code/i);
    fireEvent.change(email, { target: { value: 'real.person@gmail.com' } });
    fireEvent.change(zip, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Store lead' }));

    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(zip).toHaveAttribute('aria-invalid', 'true');
    const emailLink = screen.getByRole('link', { name: /Test email:/i });
    fireEvent.click(emailLink);
    expect(email).toHaveFocus();
  });

  it('renders the committed identity and moves focus only after persistence', async () => {
    const intakeClient = vi.fn(async () => accepted);
    render(
      <App
        intakeClient={intakeClient}
        idempotencyKeyFactory={() => 'intake-key-001'}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Store lead' }));

    const runHeading = screen.getByRole('heading', { name: 'Dossier' });
    await waitFor(() => expect(runHeading).toHaveFocus());
    expect(intakeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 'intake-v3',
        attribution: null,
        identityClass: 'fictional',
        email: 'avery.jordan@example.com',
      }),
      'intake-key-001',
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Stored' }),
    ).toBeInTheDocument();
    expect(screen.getByText(accepted.value.runId)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lead stored' })).toBeDisabled();
  });

  it('keeps safe local input and the same request key for an unchanged retry', async () => {
    const intakeClient = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'rejected',
        error: {
          code: 'storage_unavailable',
          category: 'storage',
          retryable: true,
          message: 'The intake could not be persisted.',
        },
      })
      .mockResolvedValueOnce(accepted);
    const idempotencyKeyFactory = vi.fn(() => 'stable-retry-key');
    render(
      <App
        intakeClient={intakeClient}
        idempotencyKeyFactory={idempotencyKeyFactory}
      />,
    );

    const submit = screen.getByRole('button', {
      name: 'Store lead',
    });
    fireEvent.click(submit);
    const error = await screen.findByRole('alert');
    await waitFor(() => expect(error).toHaveFocus());
    expect(error).toHaveTextContent('The intake could not be persisted.');
    expect(screen.getByLabelText(/Test email/i)).toHaveValue(
      'avery.jordan@example.com',
    );

    fireEvent.click(submit);
    await waitFor(() => expect(intakeClient).toHaveBeenCalledTimes(2));
    expect(idempotencyKeyFactory).toHaveBeenCalledOnce();
    expect(intakeClient.mock.calls[0]?.[1]).toBe('stable-retry-key');
    expect(intakeClient.mock.calls[1]?.[1]).toBe('stable-retry-key');
  });

  it('declares 390px and reduced-motion safeguards', () => {
    const stylesheet = readFileSync(
      path.join(process.cwd(), 'apps/web/src/styles.css'),
      'utf8',
    );
    expect(stylesheet).toContain('@media (max-width: 390px)');
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesheet).toContain(':focus-visible');
    expect(stylesheet).not.toContain('linear-gradient');
    expect(stylesheet).not.toContain('box-shadow');
  });
});
