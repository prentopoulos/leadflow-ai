import {
  CONSENT_WORDINGS,
  CURRENT_CONSENT_WORDING_VERSION,
  IntakeSubmissionSchema,
  CONTRACT_VERSIONS,
  TEST_EMAIL_DOMAINS,
  currentConsentRecord,
  type IntakeAcceptedResponse,
  type SafeError,
} from '@leadflow-ai/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  submitIntake,
  type IntakeClient,
  type IntakeClientResult,
} from './intake-client.js';
import { Masthead, SimulationStrip } from './Masthead.js';
import {
  AdditionalVehicles,
  CarrierQuestion,
  ChoiceQuestion,
} from './MilitaryFlow.js';
import { MILITARY_QUESTIONS, readMilitaryAnswers } from './military-flow.js';
import { RunDossier } from './RunDossier.js';
import { runClient as defaultRunClient, type RunClient } from './run-client.js';
import { useSession } from './session-context.js';

const coverageOptions = [
  ['balanced', 'Balanced coverage'],
  ['lower_cost', 'Lower monthly cost'],
  ['stronger_protection', 'Stronger protection'],
  ['not_sure', 'Not sure yet'],
] as const;

const intentOptions = [
  ['compare_options', 'Compare options'],
  ['replace_policy', 'Replace a current policy'],
  ['new_coverage', 'Start new coverage'],
  ['learn', 'Learn what to consider'],
] as const;

const timelineOptions = [
  ['within_30_days', 'Within 30 days'],
  ['days_31_to_90', '31–90 days'],
  ['over_90_days', 'More than 90 days'],
  ['researching', 'Researching for now'],
  ['not_sure', 'Not sure'],
] as const;

const fieldLabels = {
  givenName: 'First name',
  familyName: 'Last name',
  email: 'Test email',
  zipCode: 'ZIP Code',
  vehicleYear: 'Vehicle year',
  vehicleMake: 'Vehicle make',
  vehicleModel: 'Vehicle model',
  coverageFocus: 'Coverage focus',
  requestIntent: 'Request intent',
  needTimeline: 'Need timeline',
  requestDetails: 'Request details',
  emailContactConsent: 'Email contact consent',
  birthDate: 'Birthdate',
  phone: 'Phone number',
} as const;

type FieldName = keyof typeof fieldLabels;
type FieldErrors = Partial<Record<FieldName, string>>;

function getOptionalText(formData: FormData, name: FieldName) {
  const value = String(formData.get(name) ?? '').trim();
  return value === '' ? null : value;
}

function getFieldErrorMessage(field: FieldName, fallback: string) {
  switch (field) {
    case 'email':
      return `Use a test address ending in ${TEST_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(', ')}.`;
    case 'zipCode':
      return 'Enter a five-digit ZIP Code.';
    case 'vehicleYear':
      return 'Enter a whole year from 1981 through 2027, or leave it blank.';
    case 'givenName':
    case 'familyName':
      return `Enter a fictional ${field === 'givenName' ? 'first' : 'last'} name.`;
    case 'phone':
      return 'Use a fictional 555-01XX number, such as 703-555-0100.';
    case 'birthDate':
      return 'Enter a full birthdate, or leave it blank.';
    case 'vehicleMake':
      return 'Enter a make with at least one letter or number, or leave it blank.';
    default:
      return fallback;
  }
}

function FieldError({
  field,
  errors,
}: {
  field: FieldName;
  errors: FieldErrors;
}) {
  const message = errors[field];
  return message ? (
    <p className="field-error" id={`${field}-error`}>
      {message}
    </p>
  ) : null;
}

function fieldA11y(field: FieldName, errors: FieldErrors, helpId?: string) {
  const errorId = errors[field] ? `${field}-error` : undefined;
  return {
    'aria-describedby':
      [helpId, errorId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': errors[field] ? (true as const) : undefined,
  };
}

function createIdempotencyKey() {
  return crypto.randomUUID();
}

type SubmissionStatus = 'idle' | 'submitting' | 'failed' | 'stored';

interface AppProps {
  intakeClient?: IntakeClient;
  idempotencyKeyFactory?: () => string;
  runClient?: RunClient;
}

export function App({
  intakeClient = submitIntake,
  idempotencyKeyFactory = createIdempotencyKey,
  runClient,
}: AppProps = {}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [submissionStatus, setSubmissionStatus] =
    useState<SubmissionStatus>('idle');
  const [submissionError, setSubmissionError] = useState<SafeError | null>(
    null,
  );
  const [accepted, setAccepted] = useState<IntakeAcceptedResponse | null>(null);
  const [executionNotice, setExecutionNotice] = useState<string | null>(null);
  // A form reset clears inputs but not component state, so remounting the
  // extra-vehicle rows on reset removes any rows that were added.
  const [resetCount, setResetCount] = useState(0);
  const session = useSession();
  const hosted = session.mode === 'cloud';
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const submissionErrorRef = useRef<HTMLDivElement>(null);
  const runHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestIdentityRef = useRef<{
    fingerprint: string;
    idempotencyKey: string;
  } | null>(null);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errors, validationAttempt]);

  useEffect(() => {
    if (submissionStatus === 'failed') {
      submissionErrorRef.current?.focus();
    }
  }, [submissionStatus]);

  useEffect(() => {
    if (accepted !== null) {
      runHeadingRef.current?.focus();
    }
  }, [accepted]);

  // Hosted intake starts no work after its 202. The browser holds one
  // authenticated execution request while the dossier polls stored state; a
  // duplicate or stale request is a harmless conflict.
  useEffect(() => {
    if (!hosted || accepted === null) return;
    const client = runClient ?? defaultRunClient;
    if (client.execute === undefined) return;
    let active = true;
    setExecutionNotice(null);
    void client.execute(accepted.runId, accepted.runRevision).then((result) => {
      if (!active || result.status === 'ok') return;
      if (
        result.error.code === 'revision_conflict' ||
        result.error.code === 'run_ineligible'
      ) {
        return;
      }
      setExecutionNotice(
        result.error.code === 'execution_deadline'
          ? 'Execution stopped at its time limit. Resume the run from the dossier once its lease expires.'
          : result.error.message,
      );
    });
    return () => {
      active = false;
    };
  }, [accepted, hosted, runClient]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const yearValue = String(formData.get('vehicleYear') ?? '').trim();
    const consentGiven = formData.get('emailContactConsent') === 'on';
    const candidate = {
      schemaVersion: CONTRACT_VERSIONS.intake,
      identityClass: 'fictional' as const,
      givenName: String(formData.get('givenName') ?? ''),
      familyName: String(formData.get('familyName') ?? ''),
      email: String(formData.get('email') ?? ''),
      zipCode: String(formData.get('zipCode') ?? ''),
      vehicleYear: yearValue === '' ? null : Number(yearValue),
      vehicleMake: getOptionalText(formData, 'vehicleMake'),
      vehicleModel: getOptionalText(formData, 'vehicleModel'),
      coverageFocus: getOptionalText(formData, 'coverageFocus'),
      requestIntent: getOptionalText(formData, 'requestIntent'),
      needTimeline: getOptionalText(formData, 'needTimeline'),
      requestDetails: getOptionalText(formData, 'requestDetails'),
      emailContactConsent: consentGiven,
      consentRecord: consentGiven ? currentConsentRecord() : null,
      // The form never captures URL parameters; only simulated traffic carries attribution.
      attribution: null,
      militaryAnswers: readMilitaryAnswers(formData),
    };
    const result = IntakeSubmissionSchema.safeParse(candidate);

    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        // Flow answers report the nested field, such as phone.
        const field =
          issue.path[0] === 'militaryAnswers' ? issue.path[1] : issue.path[0];
        if (
          typeof field === 'string' &&
          field in fieldLabels &&
          !nextErrors[field as FieldName]
        ) {
          nextErrors[field as FieldName] = getFieldErrorMessage(
            field as FieldName,
            issue.message,
          );
        }
      }
      setErrors(nextErrors);
      setSubmissionError(null);
      setSubmissionStatus('idle');
      setValidationAttempt((attempt) => attempt + 1);
      return;
    }

    setErrors({});
    setSubmissionError(null);
    setSubmissionStatus('submitting');

    const fingerprint = JSON.stringify(result.data);
    if (requestIdentityRef.current?.fingerprint !== fingerprint) {
      requestIdentityRef.current = {
        fingerprint,
        idempotencyKey: idempotencyKeyFactory(),
      };
    }

    let response: IntakeClientResult;
    try {
      response = await intakeClient(
        result.data,
        requestIdentityRef.current.idempotencyKey,
      );
    } catch {
      response = {
        status: 'rejected',
        error: {
          code: 'unknown_failure',
          category: 'runtime',
          retryable: true,
          message:
            'The local intake request could not be completed. Your input remains in this browser.',
        },
      };
    }

    if (response.status === 'rejected') {
      setSubmissionError(response.error);
      setSubmissionStatus('failed');
      return;
    }

    setAccepted(response.value);
    setSubmissionStatus('stored');
  }

  function handleReset() {
    setErrors({});
    setSubmissionError(null);
    setSubmissionStatus('idle');
    setAccepted(null);
    setExecutionNotice(null);
    setResetCount((count) => count + 1);
    requestIdentityRef.current = null;
  }

  return (
    <>
      <SimulationStrip />
      <Masthead view="intake" />

      <main id="main-content" className="page-shell">
        <section className="page-intro" aria-labelledby="page-title">
          <h1 id="page-title">New lead</h1>
        </section>

        <div className="workspace">
          <section className="intake-pane" aria-labelledby="intake-title">
            <div className="section-heading">
              <h2 id="intake-title">Intake</h2>
            </div>

            <form noValidate onSubmit={handleSubmit} onReset={handleReset}>
              {Object.keys(errors).length > 0 ? (
                <div
                  className="error-summary"
                  ref={errorSummaryRef}
                  role="alert"
                  tabIndex={-1}
                >
                  <h3>Check fields</h3>
                  <ul>
                    {Object.entries(errors).map(([field, message]) => (
                      <li key={field}>
                        <a
                          href={`#${field}`}
                          onClick={(clickEvent) => {
                            clickEvent.preventDefault();
                            document.getElementById(field)?.focus();
                          }}
                        >
                          {fieldLabels[field as FieldName]}: {message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {submissionError !== null ? (
                <div
                  className="submission-error"
                  ref={submissionErrorRef}
                  role="alert"
                  tabIndex={-1}
                >
                  <h3>Not stored</h3>
                  <p>{submissionError.message}</p>
                </div>
              ) : null}

              {submissionStatus === 'submitting' ? (
                <div className="validation-status" role="status">
                  <strong>Storing…</strong>
                </div>
              ) : null}

              <fieldset className="form-section source-section">
                <legend>
                  <span className="legend-number">A</span>
                  Military.com auto quote
                </legend>
                <p className="form-section-note">
                  The questions of the Military.com auto quote flow, in its
                  order and wording.
                </p>

                <div className="flow-question">
                  <label htmlFor="zipCode">
                    {MILITARY_QUESTIONS.zip}: ZIP Code{' '}
                    <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="zipCode"
                    name="zipCode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={5}
                    required
                    defaultValue="22150"
                    {...fieldA11y('zipCode', errors)}
                  />
                  <FieldError field="zipCode" errors={errors} />
                </div>

                <ChoiceQuestion field="currentlyInsured" />
                <CarrierQuestion />
                <ChoiceQuestion field="validLicense" />
                <ChoiceQuestion field="recentIncidents" />
                <ChoiceQuestion field="duiDwi" />
                <ChoiceQuestion field="sr22" />
                <ChoiceQuestion field="militaryService" />

                <div className="flow-question">
                  <span className="flow-question-title">
                    {MILITARY_QUESTIONS.vehicle}
                  </span>
                  <div className="field-grid vehicle-grid">
                    <div className="field">
                      <label htmlFor="vehicleYear">Year</label>
                      <input
                        id="vehicleYear"
                        name="vehicleYear"
                        type="number"
                        min="1981"
                        max="2027"
                        inputMode="numeric"
                        defaultValue="2020"
                        {...fieldA11y('vehicleYear', errors)}
                      />
                      <FieldError field="vehicleYear" errors={errors} />
                    </div>
                    <div className="field">
                      <label htmlFor="vehicleMake">Make</label>
                      <input
                        id="vehicleMake"
                        name="vehicleMake"
                        autoComplete="off"
                        defaultValue="Subaru"
                        {...fieldA11y('vehicleMake', errors)}
                      />
                      <FieldError field="vehicleMake" errors={errors} />
                    </div>
                    <div className="field">
                      <label htmlFor="vehicleModel">Model</label>
                      <input
                        id="vehicleModel"
                        name="vehicleModel"
                        autoComplete="off"
                        defaultValue="Outback"
                        {...fieldA11y('vehicleModel', errors)}
                      />
                      <FieldError field="vehicleModel" errors={errors} />
                    </div>
                  </div>
                  <AdditionalVehicles key={resetCount} />
                </div>

                <ChoiceQuestion field="multipleDrivers" />
                <ChoiceQuestion field="homeOwner" />
                <ChoiceQuestion field="bundleInterest" />
                <ChoiceQuestion field="married" />
                <ChoiceQuestion field="gender" />

                <div className="flow-question">
                  <label htmlFor="birthDate">
                    {MILITARY_QUESTIONS.birthDate}
                  </label>
                  <input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    defaultValue="1985-06-15"
                    {...fieldA11y('birthDate', errors)}
                  />
                  <FieldError field="birthDate" errors={errors} />
                </div>

                <div className="flow-question">
                  <span className="flow-question-title">
                    {MILITARY_QUESTIONS.address}
                  </span>
                  <div className="field-grid two-columns">
                    <div className="field">
                      <label htmlFor="streetAddress">Street address</label>
                      <input
                        id="streetAddress"
                        name="streetAddress"
                        autoComplete="off"
                        defaultValue="100 Example Street"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="aptUnitSuite">
                        Apt, Unit, Suite (optional)
                      </label>
                      <input
                        id="aptUnitSuite"
                        name="aptUnitSuite"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                <div className="flow-question">
                  <span className="flow-question-title">
                    {MILITARY_QUESTIONS.name}
                  </span>
                  <div className="field-grid two-columns">
                    <div className="field">
                      <label htmlFor="givenName">
                        First name <span aria-hidden="true">*</span>
                      </label>
                      <input
                        id="givenName"
                        name="givenName"
                        autoComplete="off"
                        required
                        defaultValue="Avery"
                        {...fieldA11y('givenName', errors)}
                      />
                      <FieldError field="givenName" errors={errors} />
                    </div>
                    <div className="field">
                      <label htmlFor="familyName">
                        Last name <span aria-hidden="true">*</span>
                      </label>
                      <input
                        id="familyName"
                        name="familyName"
                        autoComplete="off"
                        required
                        defaultValue="Jordan"
                        {...fieldA11y('familyName', errors)}
                      />
                      <FieldError field="familyName" errors={errors} />
                    </div>
                  </div>
                </div>

                <div className="flow-question">
                  <label htmlFor="email">
                    {MILITARY_QUESTIONS.email} Test email{' '}
                    <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="off"
                    required
                    defaultValue="avery.jordan@example.com"
                    {...fieldA11y('email', errors)}
                  />
                  <FieldError field="email" errors={errors} />
                </div>

                <div className="flow-question">
                  <label htmlFor="phone">
                    {MILITARY_QUESTIONS.phone} Fictional 555-01XX number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="off"
                    defaultValue="703-555-0100"
                    {...fieldA11y('phone', errors)}
                  />
                  <FieldError field="phone" errors={errors} />
                </div>
              </fieldset>

              <fieldset className="form-section demo-section">
                <legend>
                  <span className="legend-number">B</span>
                  LeadFlow scoring questions
                </legend>
                <p className="form-section-note">
                  Not on Military.com. LeadFlow scores marketing readiness from
                  these.
                </p>

                <div className="field-grid two-columns">
                  <div className="field">
                    <label htmlFor="requestIntent">Request intent</label>
                    <select
                      id="requestIntent"
                      name="requestIntent"
                      defaultValue="compare_options"
                      {...fieldA11y('requestIntent', errors)}
                    >
                      <option value="">Select an intent</option>
                      {intentOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <FieldError field="requestIntent" errors={errors} />
                  </div>
                  <div className="field">
                    <label htmlFor="coverageFocus">Coverage focus</label>
                    <select
                      id="coverageFocus"
                      name="coverageFocus"
                      defaultValue="balanced"
                      {...fieldA11y('coverageFocus', errors)}
                    >
                      <option value="">Select a focus</option>
                      {coverageOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <FieldError field="coverageFocus" errors={errors} />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="needTimeline">Need timeline</label>
                  <select
                    id="needTimeline"
                    name="needTimeline"
                    defaultValue="days_31_to_90"
                    {...fieldA11y('needTimeline', errors)}
                  >
                    <option value="">Select a timeline</option>
                    {timelineOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <FieldError field="needTimeline" errors={errors} />
                </div>

                <div className="field">
                  <label htmlFor="requestDetails">Request details</label>
                  <textarea
                    id="requestDetails"
                    name="requestDetails"
                    rows={5}
                    maxLength={1000}
                    defaultValue="Looking for a clearer comparison before renewal."
                    {...fieldA11y('requestDetails', errors)}
                  />
                  <FieldError field="requestDetails" errors={errors} />
                </div>

                <div className="consent-field">
                  <input
                    id="emailContactConsent"
                    name="emailContactConsent"
                    type="checkbox"
                    {...fieldA11y('emailContactConsent', errors)}
                  />
                  <div>
                    <label htmlFor="emailContactConsent">
                      {CONSENT_WORDINGS[CURRENT_CONSENT_WORDING_VERSION].text}
                    </label>
                    <FieldError field="emailContactConsent" errors={errors} />
                  </div>
                </div>
              </fieldset>

              <div className="form-actions">
                <button
                  className="primary-action"
                  type="submit"
                  disabled={
                    submissionStatus === 'submitting' ||
                    submissionStatus === 'stored'
                  }
                >
                  {submissionStatus === 'submitting'
                    ? 'Storing lead…'
                    : submissionStatus === 'stored'
                      ? 'Lead stored'
                      : 'Store lead'}
                </button>
                <button
                  className="secondary-action"
                  type="reset"
                  disabled={submissionStatus === 'submitting'}
                >
                  {submissionStatus === 'stored'
                    ? 'Start another intake'
                    : 'Restore example'}
                </button>
                <p>* Required</p>
              </div>
            </form>
          </section>

          <aside className="run-pane" aria-labelledby="run-dossier-title">
            <div className="section-heading">
              <h2 id="run-dossier-title" ref={runHeadingRef} tabIndex={-1}>
                Dossier
              </h2>
              <span className="state-tag">
                {accepted === null
                  ? 'No stored run'
                  : `Stored · rev ${accepted.runRevision}`}
              </span>
            </div>

            {accepted === null ? (
              <div className="empty-run">
                <span className="empty-glyph" aria-hidden="true">
                  00
                </span>
                <h3>Waiting</h3>
              </div>
            ) : (
              <>
                <div className="stored-run" role="status">
                  <h3>{accepted.replayed ? 'Already stored' : 'Stored'}</h3>
                  <dl>
                    <div>
                      <dt>Run ID</dt>
                      <dd>{accepted.runId}</dd>
                    </div>
                    <div>
                      <dt>Lead ID</dt>
                      <dd>{accepted.leadId}</dd>
                    </div>
                    <div>
                      <dt>Committed</dt>
                      <dd>{new Date(accepted.committedAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Evidence</dt>
                      <dd>
                        {hosted ? 'Private hosted' : accepted.evidenceClass}
                      </dd>
                    </div>
                  </dl>
                </div>
                {executionNotice === null ? null : (
                  <p className="safe-error" role="status">
                    {executionNotice}
                  </p>
                )}
                <RunDossier
                  runId={accepted.runId}
                  initialRevision={accepted.runRevision}
                  {...(runClient === undefined ? {} : { client: runClient })}
                />
              </>
            )}
          </aside>
        </div>
      </main>

      <footer className="page-footer">
        <span>
          LeadFlow AI · {hosted ? 'private hosted proof' : 'local prototype'}
        </span>
      </footer>
    </>
  );
}
