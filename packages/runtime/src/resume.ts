import { isDeepStrictEqual } from 'node:util';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { BaseCheckpointSaver } from '@langchain/langgraph';
import {
  QualificationGraphStateSchema,
  isResumeEligible,
  type QualificationGraphState,
  type RunDocument,
} from '@leadflow-ai/domain';
import { qualificationProjectionFromLead } from './interpreter.js';
import {
  RunLeaseConflictError,
  RunNotFoundError,
  RunRevisionConflictError,
  RunStateConflictError,
  type ClaimRunRequest,
  type LifecyclePersistenceService,
} from './lifecycle.js';
import type { FirestoreRepositories } from './repositories.js';
import {
  initialQualificationGraphState,
  type CompiledQualificationWorkflow,
} from './workflow.js';

export class CheckpointMissingError extends Error {
  readonly code = 'checkpoint_missing' as const;

  constructor() {
    super('A durable checkpoint is required to resume this run.');
    this.name = 'CheckpointMissingError';
  }
}

export class CheckpointIncompatibleError extends Error {
  readonly code = 'checkpoint_incompatible' as const;

  constructor() {
    super('The durable checkpoint is incompatible with this run.');
    this.name = 'CheckpointIncompatibleError';
  }
}

export interface QualificationResumeDependencies {
  repositories: FirestoreRepositories;
  lifecycle: LifecyclePersistenceService;
  checkpoints: Pick<BaseCheckpointSaver, 'getTuple'>;
  workflow: CompiledQualificationWorkflow;
  now?: () => string;
}

export interface QualificationResumeRequest extends Omit<
  ClaimRunRequest,
  'authorization'
> {
  authorization: 'allowed';
}

export interface QualificationResumeResult {
  resumedFrom: 'persisted' | 'checkpoint';
  state: QualificationGraphState;
}

function graphConfig(run: RunDocument): RunnableConfig {
  return {
    configurable: {
      thread_id: run.runId,
      system_bundle_id: run.systemBundleId,
    },
  };
}

export class QualificationResumeService {
  private readonly now: () => string;

  constructor(private readonly dependencies: QualificationResumeDependencies) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  async resume(
    request: QualificationResumeRequest,
  ): Promise<QualificationResumeResult> {
    const run = await this.dependencies.repositories.runs.get(request.runId);
    if (run === null) throw new RunNotFoundError();
    if (run.revision !== request.expectedRevision) {
      throw new RunRevisionConflictError();
    }
    if (!isResumeEligible(run.status)) {
      throw new RunStateConflictError(
        'Only a persisted or retryable run can be resumed.',
      );
    }
    if (
      run.lease !== null &&
      Date.parse(run.lease.expiresAt) > Date.parse(this.now())
    ) {
      throw new RunLeaseConflictError();
    }

    const prepared =
      run.status === 'persisted'
        ? await this.fromPersisted(run, request)
        : await this.fromCheckpoint(run);
    const resumed = await this.dependencies.lifecycle.resume(request);
    const state = QualificationGraphStateSchema.parse({
      ...prepared,
      runRevision: resumed.run.revision,
      safeError: null,
      finalized: false,
    });
    return {
      resumedFrom: run.status === 'persisted' ? 'persisted' : 'checkpoint',
      state: await this.dependencies.workflow.invoke(state, graphConfig(run)),
    };
  }

  private async fromPersisted(
    run: RunDocument,
    request: QualificationResumeRequest,
  ): Promise<QualificationGraphState> {
    const lead = await this.dependencies.repositories.leads.get(run.leadId);
    if (lead === null || lead.leadId !== run.leadId) {
      throw new RunStateConflictError('The persisted lead is unavailable.');
    }
    return initialQualificationGraphState({
      runId: run.runId,
      leadId: run.leadId,
      traceId: request.traceId,
      requestId: request.requestId,
      systemBundleId: run.systemBundleId,
      runRevision: run.revision,
      projection: qualificationProjectionFromLead(lead),
    });
  }

  private async fromCheckpoint(
    run: RunDocument,
  ): Promise<QualificationGraphState> {
    let tuple;
    try {
      tuple = await this.dependencies.checkpoints.getTuple(graphConfig(run));
    } catch {
      throw new CheckpointIncompatibleError();
    }
    if (tuple === undefined) throw new CheckpointMissingError();
    let state: QualificationGraphState;
    try {
      const channelValues = tuple.checkpoint.channel_values;
      if (
        typeof channelValues !== 'object' ||
        channelValues === null ||
        Array.isArray(channelValues)
      ) {
        throw new Error('Checkpoint channels are malformed.');
      }
      const applicationState = {
        ...(channelValues as Record<string, unknown>),
      };
      delete applicationState.__pregel_tasks;
      state = QualificationGraphStateSchema.parse(applicationState);
    } catch {
      throw new CheckpointIncompatibleError();
    }
    if (
      state.runId !== run.runId ||
      state.leadId !== run.leadId ||
      state.systemBundleId !== run.systemBundleId ||
      state.runRevision !== run.revision ||
      state.finalized ||
      state.safeError === null ||
      !isDeepStrictEqual(state.safeError, run.safeError)
    ) {
      throw new CheckpointIncompatibleError();
    }
    return state;
  }
}
