import { describe, expect, it, vi } from 'vitest';
import { WorkflowExecutor } from './executor.js';

describe('WorkflowExecutor', () => {
  it('queues a second task for a run behind the first and becomes idle after both', async () => {
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const order: string[] = [];
    const first = vi.fn(async () => {
      order.push('first:start');
      await blocked;
      order.push('first:end');
    });
    const second = vi.fn(async () => {
      order.push('second');
    });
    const executor = new WorkflowExecutor();

    expect(executor.schedule('run-1', first)).toBe(true);
    expect(executor.schedule('run-1', second)).toBe(false);
    expect(executor.running).toBe(1);
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled();

    release();
    await executor.idle();

    expect(order).toEqual(['first:start', 'first:end', 'second']);
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
