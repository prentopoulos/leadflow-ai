// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';

afterEach(cleanup);

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
      screen.getByLabelText(/Record email contact consent/i),
    ).not.toBeChecked();
    expect(
      screen.getByText(/Consent contributes no score/i),
    ).toBeInTheDocument();
  });

  it('validates through the shared intake contract and focuses the linked summary', () => {
    render(<App />);

    const email = screen.getByLabelText(/Test email/i);
    const zip = screen.getByLabelText(/ZIP Code/i);
    fireEvent.change(email, { target: { value: 'real.person@gmail.com' } });
    fireEvent.change(zip, { target: { value: '12' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Validate synthetic intake' }),
    );

    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(zip).toHaveAttribute('aria-invalid', 'true');
    const emailLink = screen.getByRole('link', { name: /Test email:/i });
    fireEvent.click(emailLink);
    expect(email).toHaveFocus();
  });

  it('confirms validation without claiming persistence or processing', () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Validate synthetic intake' }),
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Local validation complete.');
    expect(status).toHaveTextContent(
      'Nothing has been stored or processed yet.',
    );
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
