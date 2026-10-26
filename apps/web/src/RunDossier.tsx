import type {
  QualificationResult,
  RunDetailResponse,
  RunStatus,
  SafeError,
} from '@leadflow-ai/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  operationsClient as defaultOperationsClient,
  type OperationsClient,
} from './operations-client.js';
import { runClient as defaultRunClient, type RunClient } from './run-client.js';
import {
  DraftSection,
  EnrichmentEvidenceSection,
  VerificationSection,
} from './RunEvidence.js';

const terminalStatuses = new Set<RunStatus>([
  'complete',
  'failed_retryable',
  'failed_terminal',
]);

const criterionLabels = {
  needTimeline: 'Need timeline',
  requestClarity: 'Request clarity',
  completeness: 'Completeness',
} as const;

function readable(value: string) {
  return value
    .replace(/[._]+/gu, ' ')
    .replace(/^\w/u, (letter) => letter.toUpperCase());
}

function Qualification({ result }: { result: QualificationResult }) {
  if (result.integrityHold !== null) {
    return (
      <section
        className="result-section integrity-hold"
        aria-labelledby="qualification-title"
      >
        <p className="section-index">Qualification held</p>
        <h3 id="qualification-title">No priority was assigned.</h3>
        <p>{result.integrityHold.message}</p>
        <small>{result.meaning}</small>
      </section>
    );
  }
  if (
    result.criteria === null ||
    result.total === null ||
    result.priority === null
  )
    return null;
  return (
    <section className="result-section" aria-labelledby="qualification-title">
      <div className="score-heading">
        <div>
          <p className="section-index">Marketing readiness</p>
          <h3 id="qualification-title">{readable(result.priority)} priority</h3>
          <p>{result.meaning}</p>
        </div>
        <strong className="score-value">
          {result.total}
          <span>/100</span>
        </strong>
      </div>
      <div className="criteria-list">
        {Object.entries(result.criteria).map(([key, criterion]) => (
          <details key={key}>
            <summary>
              <span>
                {criterionLabels[key as keyof typeof criterionLabels]}
              </span>
              <strong>
                {criterion.points} / {criterion.maximum}
              </strong>
            </summary>
            <ul>
              {criterion.components.map((component) => (
                <li key={component.component}>
                  <span>{readable(component.component)}</span>
                  <strong>{component.points} pts</strong>
                  <small>
                    Evidence:{' '}
                    {component.evidenceFields.map(readable).join(', ') ||
                      'none'}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <div className="missing-information">
        <strong>Missing information</strong>
        <p>
          {result.missingInformation.length === 0
            ? 'None.'
            : result.missingInformation.map(readable).join(', ')}
        </p>
      </div>
      <p className="version-line">
        {result.rubricVersion} · {result.interpreterVersion}
      </p>
    </section>
  );
}

export interface RunDossierProps {
  runId: string;
  initialRevision: number;
  client?: RunClient;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  operationsClient?: OperationsClient;
}

export function RunDossier({
  runId,
  initialRevision,
  client = defaultRunClient,
  pollIntervalMs = 2_000,
  maxPollAttempts = 30,
  operationsClient = defaultOperationsClient,
}: RunDossierProps) {
  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [refreshError, setRefreshError] = useState<SafeError | null>(null);
  const [resumeError, setResumeError] = useState<SafeError | null>(null);
  const [resuming, setResuming] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);
  const attempts = useRef(0);

  const refresh = useCallback(async () => {
    attempts.current += 1;
    const result = await client.get(runId);
    if (result.status === 'error') {
      setRefreshError(result.error);
      return false;
    }
    setDetail(result.value);
    setRefreshError(null);
    return terminalStatuses.has(result.value.run.status);
  }, [client, runId]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    attempts.current = 0;
    async function poll() {
      const terminal = await refresh();
      if (!active || terminal || attempts.current >= maxPollAttempts) return;
      timer = setTimeout(() => void poll(), pollIntervalMs);
    }
    void poll();
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [maxPollAttempts, pollCycle, pollIntervalMs, refresh]);

  async function resume() {
    if (detail === null) return;
    setResuming(true);
    setResumeError(null);
    const result = await client.resume(runId, detail.run.revision);
    setResuming(false);
    if (result.status === 'error') {
      setResumeError(result.error);
      if (result.error.code === 'revision_conflict') await refresh();
      return;
    }
    setPollCycle((cycle) => cycle + 1);
  }

  if (detail === null) {
    return (
      <div className="run-loading" aria-live="polite">
        <p className="summary-label">Stored · rev {initialRevision}</p>
        <h3>Loading the first stored snapshot…</h3>
        {refreshError !== null ? <p>{refreshError.message}</p> : null}
      </div>
    );
  }

  const canResume =
    detail.run.status === 'persisted' ||
    detail.run.status === 'failed_retryable' ||
    (detail.run.status === 'running' &&
      detail.run.lease !== null &&
      Date.parse(detail.run.lease.expiresAt) <= Date.now());
  return (
    <div className="run-detail">
      {refreshError !== null ? (
        <div className="stale-state" role="status">
          <strong>Newer state is unavailable.</strong>
          <span>
            Showing revision {detail.run.revision}, confirmed{' '}
            {new Date(detail.retrievedAt).toLocaleTimeString()}.
          </span>
        </div>
      ) : null}
      <section className="run-summary" aria-labelledby="stored-run-title">
        <p className="section-index">
          Stored run · revision {detail.run.revision}
        </p>
        <h3 id="stored-run-title">{readable(detail.run.status)}</h3>
        <dl>
          <div>
            <dt>Attempt</dt>
            <dd>{detail.run.attempt}</dd>
          </div>
          <div>
            <dt>Retries</dt>
            <dd>{detail.run.retryCount}</dd>
          </div>
          <div>
            <dt>Current step</dt>
            <dd>
              {detail.run.currentStep === null
                ? 'None'
                : readable(detail.run.currentStep)}
            </dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>
              {readable(detail.run.evidenceCompleteness)}
              {detail.run.enrichmentMode === null
                ? ''
                : ` · ${detail.run.enrichmentMode}`}
            </dd>
          </div>
          <div>
            <dt>Bundle</dt>
            <dd>{detail.run.systemBundleId}</dd>
          </div>
        </dl>
        {detail.run.holds.length > 0 ? (
          <p className="safe-error">
            Hold: the draft failed verification and is not in the approval
            queue.
          </p>
        ) : null}
        {detail.run.safeError !== null ? (
          <p className="safe-error">{detail.run.safeError.message}</p>
        ) : null}
        {canResume ? (
          <div className="resume-action">
            <button
              type="button"
              onClick={() => void resume()}
              disabled={resuming}
            >
              {resuming
                ? 'Requesting resume…'
                : detail.run.status === 'persisted'
                  ? 'Start stored run'
                  : 'Resume retryable run'}
            </button>
            <span>Expected revision {detail.run.revision}</span>
          </div>
        ) : null}
        {resumeError !== null ? (
          <p className="safe-error" role="alert">
            {resumeError.message}
          </p>
        ) : null}
      </section>

      <section className="event-history" aria-labelledby="event-history-title">
        <p className="section-index">Append-only history</p>
        <h3 id="event-history-title">Lifecycle events</h3>
        <ol>
          {detail.events.map((event) => (
            <li key={event.eventId}>
              <span>{String(event.sequence).padStart(2, '0')}</span>
              <div>
                <strong>{readable(event.name)}</strong>
                <small>
                  {new Date(event.occurredAt).toLocaleTimeString()} · attempt{' '}
                  {event.attempt}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {detail.qualification !== null ? (
        <Qualification result={detail.qualification} />
      ) : null}

      <EnrichmentEvidenceSection
        evidence={detail.enrichment}
        emailCheck={detail.emailCheck}
        completeness={detail.run.evidenceCompleteness}
      />
      <DraftSection
        draft={detail.draft}
        skipReason={detail.run.draftSkipReason}
        client={operationsClient}
        onChanged={refresh}
      />
      <VerificationSection
        verification={detail.verification}
        holds={detail.run.holds}
      />

      {detail.simulation !== null ? (
        <section
          className="result-section simulation-result"
          aria-labelledby="simulation-title"
        >
          <p className="section-index">Synthetic outcome · not predictive</p>
          <h3 id="simulation-title">Lifecycle contract exercise</h3>
          <dl>
            <div>
              <dt>Contacted</dt>
              <dd>
                {detail.simulation.outcome.contacted
                  ? 'Simulated yes'
                  : 'Simulated no'}
              </dd>
            </div>
            <div>
              <dt>Responded</dt>
              <dd>
                {detail.simulation.outcome.responded
                  ? 'Simulated yes'
                  : 'Simulated no'}
              </dd>
            </div>
            <div>
              <dt>Appointment</dt>
              <dd>
                {detail.simulation.outcome.appointment
                  ? 'Simulated yes'
                  : 'Simulated no'}
              </dd>
            </div>
          </dl>
          <p>
            This is neither a live outcome nor evidence that the readiness score
            predicts conversion.
          </p>
          <small>
            Evidence {detail.simulation.evidenceClass} · source run {runId} ·{' '}
            {detail.simulation.simulatorVersion} ·{' '}
            {detail.simulation.seedVersion} · seed {detail.simulation.seed}
          </small>
        </section>
      ) : null}
    </div>
  );
}
