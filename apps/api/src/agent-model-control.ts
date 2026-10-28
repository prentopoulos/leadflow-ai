import {
  ModelCallError,
  type ModelPort,
  type ModelRequest,
  type ModelResponse,
} from '@leadflow-ai/runtime';

// Owns the live adapter and checks the operator switch before every paid call.
// Configuration is transactional: persistence must succeed before a new adapter
// becomes available, and a concurrent stop request is never overwritten.
export class LocalAgentModelControl implements ModelPort {
  readonly #createPort: (apiKey: string) => ModelPort;
  #port: ModelPort | null;
  #enabled = false;
  #switchRevision = 0;

  constructor(
    initialPort: ModelPort | null,
    createPort: (apiKey: string) => ModelPort,
  ) {
    this.#port = initialPort;
    this.#createPort = createPort;
  }

  get available(): boolean {
    return this.#port !== null;
  }

  get enabled(): boolean {
    return this.available && this.#enabled;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = this.available && enabled;
    this.#switchRevision += 1;
  }

  async configure(
    apiKey: string,
    persist: (value: string) => Promise<void>,
  ): Promise<void> {
    const revisionBeforeWrite = this.#switchRevision;
    const nextPort = this.#createPort(apiKey);
    await persist(apiKey);
    this.#port = nextPort;
    if (this.#switchRevision === revisionBeforeWrite) {
      this.#enabled = true;
      this.#switchRevision += 1;
    }
  }

  call(request: ModelRequest): Promise<ModelResponse> {
    if (!this.enabled || this.#port === null) {
      return Promise.reject(new ModelCallError('disabled'));
    }
    return this.#port.call(request);
  }
}
