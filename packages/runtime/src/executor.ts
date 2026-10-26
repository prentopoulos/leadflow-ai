// In-process background execution for workflows that start after a durable
// commit (intake, resume). Outcomes are durable run state, never the HTTP
// response; a crash leaves the lease to expire and the run to be reclaimed.
export class WorkflowExecutor {
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly onFailure: (
      runId: string,
      error: unknown,
    ) => void = () => {},
  ) {}

  // One local worker per run: a task scheduled while another is in flight
  // runs after it settles instead of being dropped, because its trigger (a
  // resume or reclaim) is already committed. Returns false when queued.
  schedule(runId: string, task: () => Promise<unknown>): boolean {
    const previous = this.inFlight.get(runId);
    const execution = (previous ?? Promise.resolve())
      .then(task)
      .then(
        () => undefined,
        (error: unknown) => this.onFailure(runId, error),
      )
      .finally(() => {
        if (this.inFlight.get(runId) === execution) this.inFlight.delete(runId);
      });
    this.inFlight.set(runId, execution);
    return previous === undefined;
  }

  get running(): number {
    return this.inFlight.size;
  }

  async idle(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all(this.inFlight.values());
    }
  }
}
