import { describe, expect, it, vi } from 'vitest';
import { WorkflowExecutor } from './executor.js';

describe('WorkflowExecutor', () => {
  it('runs one background task per run and becomes idle after settlement', async () => {
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const task = vi.fn(async () => blocked);
    const executor = new WorkflowExecutor();

    expect(executor.schedule('run-1', task)).toBe(true);
    expect(executor.schedule('run-1', task)).toBe(false);
    expect(executor.running).toBe(1);

    release();
    await executor.idle();

    expect(task).toHaveBeenCalledTimes(1);
    expect(executor.running).toBe(0);
  });

  it('reports a rejected task without leaking the rejection from idle', async () => {
    const failure = new Error('synthetic background failure');
    const onFailure = vi.fn();
    const executor = new WorkflowExecutor(onFailure);

    expect(
      executor.schedule('run-2', async () => Promise.reject(failure)),
    ).toBe(true);
    await expect(executor.idle()).resolves.toBeUndefined();

    expect(onFailure).toHaveBeenCalledWith('run-2', failure);
    expect(executor.running).toBe(0);
  });
});
