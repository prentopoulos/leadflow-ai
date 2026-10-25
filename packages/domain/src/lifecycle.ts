import type { RunDocument, RunStatus } from './phase1.js';

const allowedTransitions: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  persisted: ['running'],
  running: [
    'retrying',
    'partial',
    'failed_retryable',
    'failed_terminal',
    'complete',
  ],
  retrying: ['running', 'failed_retryable', 'failed_terminal'],
  partial: ['failed_retryable', 'failed_terminal', 'complete'],
  failed_retryable: ['running'],
  failed_terminal: [],
  complete: [],
};

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransitionRun(from, to)) {
    throw new Error(`invalid run transition: ${from} -> ${to}`);
  }
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return status === 'complete' || status === 'failed_terminal';
}

export function isResumeEligible(status: RunStatus): boolean {
  return status === 'persisted' || status === 'failed_retryable';
}

export function hasActiveLease(run: RunDocument, at: string): boolean {
  return run.lease !== null && Date.parse(run.lease.expiresAt) > Date.parse(at);
}

export function assertExpectedRevision(
  run: Pick<RunDocument, 'revision'>,
  expectedRevision: number,
): void {
  if (run.revision !== expectedRevision) {
    throw new Error(
      `stale run revision: expected ${expectedRevision}; actual ${run.revision}`,
    );
  }
}

export function assertNextEventSequence(
  run: Pick<RunDocument, 'nextEventSequence'>,
  sequence: number,
): void {
  if (sequence !== run.nextEventSequence) {
    throw new Error(
      `invalid event sequence: expected ${run.nextEventSequence}; received ${sequence}`,
    );
  }
}
