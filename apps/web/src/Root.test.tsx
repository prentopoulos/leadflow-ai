// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Root } from './Root.js';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('home cover routing', () => {
  it('opens on the cover, which links into every workspace view', () => {
    render(<Root />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'LeadFlow AI' }),
    ).toBeInTheDocument();
    const entries = screen.getByRole('navigation', {
      name: 'Open the workspace',
    });
    expect(
      [...entries.querySelectorAll('a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['#intake', '#runs', '#metrics']);
    expect(screen.getByRole('note')).toHaveTextContent('SIMULATION');
  });

  it('keeps the intake workspace at #intake and returns home from the brand link', () => {
    window.location.hash = '#intake';
    render(<Root />);
    expect(
      screen.getByRole('link', { name: 'LeadFlow AI home' }),
    ).toHaveAttribute('href', '#home');
    expect(
      screen.queryByRole('navigation', { name: 'Open the workspace' }),
    ).not.toBeInTheDocument();

    act(() => {
      window.location.hash = '#home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(
      screen.getByRole('navigation', { name: 'Open the workspace' }),
    ).toBeInTheDocument();
  });
});
