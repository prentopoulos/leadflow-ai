import type {
  ModelPort,
  ModelRequest,
  ModelResponse,
} from '@leadflow-ai/runtime';
import { describe, expect, it, vi } from 'vitest';
import { LocalAgentModelControl } from './agent-model-control.js';

const request = {} as ModelRequest;
const response = {} as ModelResponse;

function fakePort(call = vi.fn(async () => response)): ModelPort {
  return { call };
}

describe('local agent model control', () => {
  it('installs and enables a persisted key without a process restart', async () => {
    const call = vi.fn(async () => response);
    const control = new LocalAgentModelControl(null, () => fakePort(call));

    await control.configure(
      'test-key',
      vi.fn(async () => undefined),
    );

    expect(control.available).toBe(true);
    expect(control.enabled).toBe(true);
    await expect(control.call(request)).resolves.toBe(response);
    expect(call).toHaveBeenCalledWith(request);
  });

  it('blocks every subsequent provider call after the switch is turned off', async () => {
    const call = vi.fn(async () => response);
    const control = new LocalAgentModelControl(fakePort(call), () =>
      fakePort(),
    );
    control.setEnabled(true);
    await control.call(request);

    control.setEnabled(false);

    await expect(control.call(request)).rejects.toMatchObject({
      name: 'ModelCallError',
      code: 'disabled',
    });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('keeps the old state when persistence fails', async () => {
    const control = new LocalAgentModelControl(null, () => fakePort());

    await expect(
      control.configure('test-key', async () => {
        throw new Error('disk unavailable');
      }),
    ).rejects.toThrow('disk unavailable');

    expect(control.available).toBe(false);
    expect(control.enabled).toBe(false);
  });

  it('does not overwrite a stop request made while the key is being saved', async () => {
    let finishWrite: (() => void) | undefined;
    const write = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const control = new LocalAgentModelControl(null, () => fakePort());
    const configuring = control.configure('test-key', () => write);

    control.setEnabled(false);
    finishWrite?.();
    await configuring;

    expect(control.available).toBe(true);
    expect(control.enabled).toBe(false);
  });
});
