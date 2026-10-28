import {
  CHANNEL_LABELS,
  channelFor,
  type Attribution,
  type IntakeSubmission,
  type QualificationField,
  type QualificationResult,
  type RunDetailResponse,
  type RunStatus,
  type SafeError,
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

// Form labels as the intake shows them. Only ZIP Code is verified against
// the Military.com auto landing form (IntakeFieldProvenanceSchema); every
// other field is a labelled LeadFlow demo field.
const formFields: Record<
  QualificationField,
  { label: string; source: string }
> = {
  zipCode: { label: 'ZIP Code', source: 'Military.com form' },
  givenName: { label: 'First name', source: 'LeadFlow demo field' },
  familyName: { label: 'Last name', source: 'LeadFlow demo field' },
  email: { label: 'Test email', source: 'LeadFlow demo field' },
  vehicleYear: { label: 'Vehicle year', source: 'LeadFlow demo field' },
  vehicleMake: { label: 'Vehicle make', source: 'LeadFlow demo field' },
  vehicleModel: { label: 'Vehicle model', source: 'LeadFlow demo field' },
  requestIntent: { label: 'Request intent', source: 'LeadFlow demo field' },
  coverageFocus: { label: 'Coverage focus', source: 'LeadFlow demo field' },
  needTimeline: { label: 'Need timeline', source: 'LeadFlow demo field' },
  requestDetails: { label: 'Request details', source: 'LeadFlow demo field' },
};

function answer(value: string | number | null) {
  if (value === null || value === '') return null;
  return typeof value === 'number' ? String(value) : readable(value);
}

// Every field the lead filled in, so whoever handles it can see exactly
// what was left blank.
function FormAnswers({ intake }: { intake: IntakeSubmission }) {
  const rows = (Object.keys(formFields) as QualificationField[]).map(
    (field) => ({
      field,
      value: answer(field === 'email' ? intake.email : intake[field]),
    }),
  );
  const answered = rows.filter((row) => row.value !== null).length;
  return (
    <details className="form-answers">
      <summary>
        Form answers ({answered} of {rows.length} answered)
      </summary>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">Form answers</caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Form</th>
              <th scope="col">Answer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ field, value }) => (
              <tr key={field}>
                <th scope="row">{formFields[field].label}</th>
                <td>{formFields[field].source}</td>
                <td className={value === null ? 'answer-missing' : undefined}>
                  {value ?? 'Not answered'}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">Email contact consent</th>
              <td>LeadFlow demo field</td>
              <td>{intake.emailContactConsent ? 'Yes' : 'No'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Qualification({
  result,
  intake,
}: {
  result: QualificationResult;
  intake: IntakeSubmission;
}) {
  if (result.integrityHold !== null) {
    return (
      <section
        className="result-section integrity-hold"
        aria-labelledby="qualification-title"
      >
        <h3 id="qualification-title">Held</h3>
        <p>{result.integrityHold.message}</p>
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
        <h3 id="qualification-title">{readable(result.priority)} priority</h3>
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
        <strong>Missing from the form</strong>
        {result.missingInformation.length === 0 ? (
          <p>Nothing: every scored field was answered.</p>
        ) : (
          <ul className="missing-list">
            {result.missingInformation.map((field) => (
              <li key={field}>
                <span className="missing-pill">{formFields[field].label}</span>
                <small>{formFields[field].source}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FormAnswers intake={intake} />
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
  // Offered after a review so the operator can continue through the queue.
  nextPending?: { label: string; open(): void } | null;
}

// Synthetic acquisition data from simulated traffic; intake-form leads have
// none. The click ID appears here and nowhere else.
function AttributionBlock({
  attribution,
}: {
  attribution: Attribution | null;
}) {
  return (
    <section
      className="result-section simulation-result"
      aria-labelledby="attribution-title"
    >
      <h3 id="attribution-title">Acquisition</h3>
      <dl>
        <div>
          <dt>Channel</dt>
          <dd>
            {attribution === null
              ? 'None: entered through the intake form'
              : CHANNEL_LABELS[channelFor(attribution)]}
          </dd>
        </div>
        {attribution === null ? null : (
          <>
            <div>
              <dt>Source</dt>
              <dd>
                {attribution.source} / {attribution.medium}
              </dd>
            </div>
            <div>
              <dt>Campaign</dt>
              <dd>{attribution.campaign}</dd>
            </div>
            {attribution.clickId === null ? null : (
              <div>
                <dt>Click ID</dt>
                <dd>{attribution.clickId}</dd>
              </div>
            )}
          </>
        )}
      </dl>
    </section>
  );
}

export function RunDossier({
  runId,
  client = defaultRunClient,
  pollIntervalMs = 2_000,
  maxPollAttempts = 30,
  operationsClient = defaultOperationsClient,
  nextPending = null,
}: RunDossierProps) {
  const [detail, setDetail] = useState<RunDetailResponse | null>(null);
  const [refreshError, setRefreshError] = useState<SafeError | null>(null);
  const [resumeError, setResumeError] = useState<SafeError | null>(null);
  const [resuming, setResuming] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);
  const attempts = useRef(0);
  // Polling re-renders every few seconds; the live region speaks only when
  // the stored status or step materially changes.
  const [announcement, setAnnouncement] = useState('');
  const announced = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    attempts.current += 1;
    const result = await client.get(runId);
    if (result.status === 'error') {
      setRefreshError(result.error);
      return false;
    }
    setDetail(result.value);
    setRefreshError(null);
    const material = `${result.value.run.status}:${result.value.run.currentStep ?? ''}`;
    if (announced.current !== material) {
      const first = announced.current === null;
      announced.current = material;
      if (!first) {
        setAnnouncement(
          `Run ${readable(result.value.run.status).toLowerCase()}${
            result.value.run.currentStep === null
              ? ''
              : `, ${readable(result.value.run.currentStep).toLowerCase()}`
          }.`,
        );
      }
    }
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
        <h3>Loading…</h3>
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
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {refreshError !== null ? (
        <div className="stale-state" role="status">
          <strong>Refresh failed</strong>
        </div>
      ) : null}
      <section className="run-summary" aria-labelledby="stored-run-title">
        <h3 id="stored-run-title">{readable(detail.run.status)}</h3>
        {/* Attempts, retries and evidence completeness are operator
            diagnostics; the person handling the lead sees only progress. */}
        {detail.run.currentStep === null ? null : (
          <p>Now: {readable(detail.run.currentStep)}</p>
        )}
        {detail.run.holds.length > 0 ? (
          <p className="safe-error">Draft blocked by verification</p>
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
          </div>
        ) : null}
        {resumeError !== null ? (
          <p className="safe-error" role="alert">
            {resumeError.message}
          </p>
        ) : null}
      </section>

      {detail.qualification !== null ? (
        <Qualification
          result={detail.qualification}
          intake={detail.lead.intake}
        />
      ) : null}

      <DraftSection
        draft={detail.draft}
        skipReason={detail.run.draftSkipReason}
        client={operationsClient}
        onChanged={refresh}
        nextPending={nextPending}
      />
      <VerificationSection
        verification={detail.verification}
        holds={detail.run.holds}
      />
      <EnrichmentEvidenceSection
        evidence={detail.enrichment}
        emailCheck={detail.emailCheck}
        completeness={detail.run.evidenceCompleteness}
      />

      {detail.simulation !== null ? (
        <section
          className="result-section simulation-result"
          aria-labelledby="simulation-title"
        >
          <h3 id="simulation-title">Outcomes</h3>
          <dl>
            <div>
              <dt>Contacted</dt>
              <dd>{detail.simulation.outcome.contacted ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Responded</dt>
              <dd>{detail.simulation.outcome.responded ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Appointment</dt>
              <dd>{detail.simulation.outcome.appointment ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <AttributionBlock attribution={detail.lead.intake.attribution} />

      <section className="event-history" aria-labelledby="event-history-title">
        <h3 id="event-history-title">Events</h3>
        <details>
          <summary>
            {detail.events.length} events
            {detail.events.length > 0
              ? ` · last: ${readable(detail.events.at(-1)?.name ?? '')}`
              : ''}
          </summary>
          <ol>
            {detail.events.map((event) => (
              <li key={event.eventId}>
                <span>{String(event.sequence).padStart(2, '0')}</span>
                <div>
                  <strong>
                    {readable(event.name)}
                    {event.step === null ? '' : ` · ${readable(event.step)}`}
                  </strong>
                  <small>
                    {new Date(event.occurredAt).toLocaleTimeString()} · attempt{' '}
                    {event.attempt}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </details>
      </section>
    </div>
  );
}
