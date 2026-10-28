// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Glossary } from './Glossary.js';

describe('Glossary', () => {
  it('filters terms by search and says when nothing matches', () => {
    render(<Glossary />);
    const search = screen.getByRole('searchbox', { name: 'Search terms' });
    fireEvent.change(search, { target: { value: 'CPL' } });
    expect(screen.getByText('CPL (cost per lead)')).toBeInTheDocument();
    expect(screen.queryByText('Zippopotam.us')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText(/No term matches/u)).toBeInTheDocument();
  });
});
