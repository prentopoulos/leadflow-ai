import { describe, expect, it } from 'vitest';
import {
  assertExpectedRevision,
  assertNextEventSequence,
  assertRunTransition,
  canTransitionRun,
  hasActiveLease,
  isResumeEligible,
  isTerminalRunStatus,
} from './lifecycle.js';
import type { RunDocument } from './phase1.js';

describe('run lifecycle rules', () => {
  it('allows the fixed normal and bounded retry paths', () => {
    expect(canTransitionRun('persisted', 'running')).toBe(true);
    expect(canTransitionRun('running', 'retrying')).toBe(true);
    expect(canTransitionRun('retrying', 'running')).toBe(true);
    expect(canTransitionRun('running', 'complete')).toBe(true);
    expect(canTransitionRun('running', 'failed_retryable')).toBe(true);
  });

  it('rejects skipped, repeated, and terminal transitions', () => {
    for (const [from, to] of [
      ['persisted', 'complete'],
      ['running', 'running'],
      ['complete', 'running'],
      ['failed_terminal', 'running'],
    ] as const) {
      expect(canTransitionRun(from, to)).toBe(false);
      expect(() => assertRunTransition(from, to)).toThrow(/invalid/u);
    }
  });

  it('defines terminal and explicit resume eligibility exactly', () => {
    expect(isTerminalRunStatus('complete')).toBe(true);
    expect(isTerminalRunStatus('failed_terminal')).toBe(true);
    expect(isTerminalRunStatus('failed_retryable')).toBe(false);
    expect(isResumeEligible('persisted')).toBe(true);
    expect(isResumeEligible('failed_retryable')).toBe(true);
    expect(isResumeEligible('running')).toBe(false);
    expect(isResumeEligible('complete')).toBe(false);
  });

  it('checks revisions, event sequence, and lease expiry', () => {
    expect(() => assertExpectedRevision({ revision: 3 }, 3)).not.toThrow();
    expect(() => assertExpectedRevision({ revision: 3 }, 2)).toThrow(/stale/u);
    expect(() =>
      assertNextEventSequence({ nextEventSequence: 4 }, 4),
    ).not.toThrow();
    expect(() => assertNextEventSequence({ nextEventSequence: 4 }, 3)).toThrow(
      /sequence/u,
    );

    const run = {
      lease: {
        ownerId: 'worker-1',
        claimedAt: '2026-10-24T20:00:00.000Z',
        expiresAt: '2026-10-24T20:01:00.000Z',
      },
    } as RunDocument;
    expect(hasActiveLease(run, '2026-10-24T20:00:30.000Z')).toBe(true);
    expect(hasActiveLease(run, '2026-10-24T20:01:00.000Z')).toBe(false);
  });
});
