// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';

afterEach(cleanup);

describe('Phase 0 web shell', () => {
  it('uses semantic content and honest local-synthetic labels', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'LeadFlow AI' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/local and synthetic/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no Military\.com intake-parity claim/i),
    ).toBeInTheDocument();
  });

  it('exposes boundaries through a keyboard-focusable native button', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: 'Review boundaries' });
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(screen.getByText('No automatic outreach')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('declares 390px and reduced-motion safeguards', () => {
    const stylesheet = readFileSync(
      path.join(process.cwd(), 'apps/web/src/styles.css'),
      'utf8',
    );
    expect(stylesheet).toContain('@media (max-width: 390px)');
    expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesheet).toContain('button:focus-visible');
  });
});
