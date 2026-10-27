// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import type { AgentBriefRecord } from '@leadflow-ai/domain';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentResearch } from './RunEvidence.js';

const brief: AgentBriefRecord = {
  schemaVersion: 'agent-brief-v1',
  briefId: '88888888-8888-4888-8888-888888888888',
  runId: '22222222-2222-4222-8222-222222222222',
  leadId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-10-27T20:00:00.000Z',
  teamVersion: 'agent-team-v1',
  rulesVersion: 'agent-rules-v1',
  promptsSha256: 'a'.repeat(64),
  projectionSha256: 'b'.repeat(64),
  status: 'drafted',
  fallbackReason: null,
  questions: { vehicle: [], area: [], coverage: ['What is comprehensive?'] },
  candidateClaims: 2,
  rejectedClaims: 1,
  claims: [
    {
      claimId: 'c1',
      topic: 'coverage',
      text: 'Comprehensive coverage helps pay for theft and weather damage.',
      url: 'https://content.naic.org/consumer/auto-insurance',
      title: null,
      quote: 'Comprehensive coverage helps pay for theft and weather damage.',
    },
  ],
  points: [],
  paragraph:
    'Comprehensive coverage helps pay for theft and weather damage. We can walk you through it.',
  paragraphClaimIds: ['c1'],
  attempts: 1,
  criticNotes: [],
  calls: [
    {
      role: 'worker',
      topic: 'coverage',
      attempt: 1,
      model: 'claude-haiku-5-5',
      outcome: 'ok',
      errorCode: null,
      inputTokens: 10_000,
      outputTokens: 200,
      webSearchRequests: 1,
      reservedMicros: 50_000,
      costMicros: 11_100,
      durationMs: 900,
    },
  ],
  totalCostMicros: 11_100,
};

describe('agent research panel', () => {
  afterEach(cleanup);

  it('shows cited sources with their quotes, links and cost', () => {
    render(<AgentResearch brief={brief} />);
    const panel = screen.getByRole('region', { name: 'Agent research' });
    expect(panel).toHaveTextContent('from 1 cited source');
    expect(panel).toHaveTextContent('1 of 2 found claims passed');
    expect(panel).toHaveTextContent('Cost $0.0111');
    const link = within(panel).getByRole('link', { name: 'content.naic.org' });
    expect(link).toHaveAttribute(
      'href',
      'https://content.naic.org/consumer/auto-insurance',
    );
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(panel.querySelector('blockquote')).toHaveTextContent(
      'theft and weather damage',
    );
  });

  it('names the fallback reason when the template was used', () => {
    render(
      <AgentResearch
        brief={{
          ...brief,
          status: 'fallback',
          fallbackReason: 'critic_unresolved',
          paragraph: null,
          paragraphClaimIds: [],
        }}
      />,
    );
    expect(
      screen.getByText(/Template draft used: the critic did not approve it/u),
    ).toBeInTheDocument();
  });
});
