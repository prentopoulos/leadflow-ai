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
      screen.getByText('Synthetic leads and outcomes'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Prepare a lead for qualification.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No stored run/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No Military\.com intake-parity claim/i),
    ).toBeInTheDocument();
  });

  it('separates the verified ZIP field from LeadFlow demo fields', () => {
    render(<App />);

    expect(
      screen.getByRole('group', { name: /verified source field/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /LeadFlow demo fields/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/ZIP Code/i)).toHaveValue('22150');
    expect(screen.getByText(/only exact field verified/i)).toBeInTheDocument();
    expect(
      screen.getByText(/not verified Military\.com questions/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Test email/i)).toHaveValue(
      'avery.jordan@example.com',
    );
    expect(
      screen.getByLabelText(/operator may prepare an email/i),
    ).not.toBeChecked();
    expect(screen.getByText(/Consent adds no score/i)).toBeInTheDocument();
  });

  it('validates through the shared intake contract and focuses the linked summary', () => {
    render(<App />);

    const email = screen.getByLabelText(/Test email/i);
    const zip = screen.getByLabelText(/ZIP Code/i);
    fireEvent.change(email, { target: { value: 'real.person@gmail.com' } });
    fireEvent.change(zip, { target: { value: '12' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Store synthetic lead' }),
    );

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

    fireEvent.click(
      screen.getByRole('button', { name: 'Store synthetic lead' }),
    );

    const runHeading = screen.getByRole('heading', { name: 'Run dossier' });
    await waitFor(() => expect(runHeading).toHaveFocus());
    expect(intakeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 'intake-v2',
        identityClass: 'fictional',
        email: 'avery.jordan@example.com',
      }),
      'intake-key-001',
    );
    expect(
      screen.getByText('The lead is stored before processing.'),
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
      name: 'Store synthetic lead',
    });
    fireEvent.click(submit);
    const error = await screen.findByRole('alert');
    expect(error).toHaveFocus();
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
