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

  // Schedules one execution per run; a second request while one is in
  // flight is declined so a run never has two local workers.
  schedule(runId: string, task: () => Promise<unknown>): boolean {
    if (this.inFlight.has(runId)) return false;
    const execution = Promise.resolve()
      .then(task)
      .then(
        () => undefined,
        (error: unknown) => this.onFailure(runId, error),
      )
      .finally(() => this.inFlight.delete(runId));
    this.inFlight.set(runId, execution);
    return true;
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
