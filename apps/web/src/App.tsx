import {
  IntakeSubmissionSchema,
  PHASE_ONE_VERSIONS,
  TEST_EMAIL_DOMAINS,
} from '@leadflow-ai/domain';
import { type FormEvent, useEffect, useRef, useState } from 'react';

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

export function App() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [isLocallyValid, setIsLocallyValid] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errors, validationAttempt]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const yearValue = String(formData.get('vehicleYear') ?? '').trim();
    const candidate = {
      schemaVersion: PHASE_ONE_VERSIONS.intake,
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
      emailContactConsent: formData.get('emailContactConsent') === 'on',
    };
    const result = IntakeSubmissionSchema.safeParse(candidate);

    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
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
      setIsLocallyValid(false);
      setValidationAttempt((attempt) => attempt + 1);
      return;
    }

    setErrors({});
    setIsLocallyValid(true);
  }

  function handleReset() {
    setErrors({});
    setIsLocallyValid(false);
  }

  return (
    <>
      <div className="simulation-strip" role="note">
        <span className="simulation-mark" aria-hidden="true" />
        <strong>SIMULATION</strong>
        <span aria-hidden="true">·</span>
        <span>Synthetic leads and outcomes</span>
        <span className="simulation-scope">Local only</span>
      </div>

      <header className="masthead">
        <a className="brand" href="#main-content" aria-label="LeadFlow AI home">
          <span className="brand-mark" aria-hidden="true">
            LF
          </span>
          <span>
            <strong>LeadFlow AI</strong>
            <small>Operator workspace</small>
          </span>
        </a>
        <div className="phase-stamp">
          <span>Phase 1</span>
          <strong>Intake + qualification</strong>
        </div>
      </header>

      <main id="main-content" className="page-shell">
        <section className="page-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">New synthetic inquiry</p>
            <h1 id="page-title">Prepare a lead for qualification.</h1>
          </div>
          <p>
            Capture a fictional request, verify its local contract, then store
            it before the qualification workflow begins. This measures marketing
            readiness—not insurance eligibility, pricing, underwriting, or risk.
          </p>
        </section>

        <div className="workspace">
          <section className="intake-pane" aria-labelledby="intake-title">
            <div className="section-heading">
              <div>
                <p className="section-index">01 / Intake record</p>
                <h2 id="intake-title">Synthetic lead intake</h2>
              </div>
              <span className="schema-tag">intake-v1</span>
            </div>

            <form noValidate onSubmit={handleSubmit} onReset={handleReset}>
              {Object.keys(errors).length > 0 ? (
                <div
                  className="error-summary"
                  ref={errorSummaryRef}
                  role="alert"
                  tabIndex={-1}
                >
                  <p className="summary-label">Check this intake</p>
                  <h3>Some fields need attention.</h3>
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

              {isLocallyValid ? (
                <div className="validation-status" role="status">
                  <strong>Local validation complete.</strong>
                  <span>Nothing has been stored or processed yet.</span>
                </div>
              ) : null}

              <fieldset className="form-section source-section">
                <legend>
                  <span className="legend-number">A</span>
                  Verified source field
                </legend>
                <p className="fieldset-note" id="zip-source-note">
                  <strong>ZIP Code</strong> is the only exact field verified
                  from the current public{' '}
                  <a href="https://auto.military.com/">
                    Military.com auto page
                  </a>
                  , retrieved October 24, 2026. Full intake parity remains
                  unverified.
                </p>
                <div className="field field-short">
                  <label htmlFor="zipCode">
                    ZIP Code <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="zipCode"
                    name="zipCode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={5}
                    required
                    defaultValue="22150"
                    {...fieldA11y('zipCode', errors, 'zip-source-note')}
                  />
                  <FieldError field="zipCode" errors={errors} />
                </div>
              </fieldset>

              <fieldset className="form-section demo-section">
                <legend>
                  <span className="legend-number">B</span>
                  LeadFlow demo fields
                </legend>
                <p className="fieldset-note" id="demo-fields-note">
                  These fields demonstrate the LeadFlow workflow. They are not
                  verified Military.com questions. Use fictional names and
                  reserved example-domain contact details only.
                </p>

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
                      {...fieldA11y('givenName', errors, 'demo-fields-note')}
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
                      {...fieldA11y('familyName', errors, 'demo-fields-note')}
                    />
                    <FieldError field="familyName" errors={errors} />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="email">
                    Test email <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="off"
                    required
                    defaultValue="avery.jordan@example.com"
                    {...fieldA11y('email', errors, 'email-help')}
                  />
                  <p className="field-help" id="email-help">
                    Allowed domains: example.com, example.org, and example.net.
                    Real contact details are rejected.
                  </p>
                  <FieldError field="email" errors={errors} />
                </div>

                <div className="subsection-heading">
                  <span>Vehicle</span>
                  <small>Optional details improve record completeness</small>
                </div>
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
                      defaultValue="2021"
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
                    {...fieldA11y('requestDetails', errors, 'details-help')}
                  />
                  <p className="field-help" id="details-help">
                    Plain text only, up to 1,000 characters. Instructions
                    entered here cannot change scoring, consent, or system
                    authority.
                  </p>
                  <FieldError field="requestDetails" errors={errors} />
                </div>

                <div className="consent-field">
                  <input
                    id="emailContactConsent"
                    name="emailContactConsent"
                    type="checkbox"
                    {...fieldA11y(
                      'emailContactConsent',
                      errors,
                      'consent-help',
                    )}
                  />
                  <div>
                    <label htmlFor="emailContactConsent">
                      Record email contact consent
                    </label>
                    <p id="consent-help">
                      Off by default. Consent contributes no score and Phase 1
                      creates or sends no outreach.
                    </p>
                    <FieldError field="emailContactConsent" errors={errors} />
                  </div>
                </div>
              </fieldset>

              <div className="form-actions">
                <button className="primary-action" type="submit">
                  Validate synthetic intake
                </button>
                <button className="secondary-action" type="reset">
                  Restore example
                </button>
                <p>Required fields are marked with an asterisk.</p>
              </div>
            </form>
          </section>

          <aside className="run-pane" aria-labelledby="run-dossier-title">
            <div className="section-heading">
              <div>
                <p className="section-index">02 / Stored evidence</p>
                <h2 id="run-dossier-title">Run dossier</h2>
              </div>
              <span className="state-tag">No stored run</span>
            </div>

            <div className="empty-run">
              <span className="empty-glyph" aria-hidden="true">
                00
              </span>
              <h3>Waiting for a persisted lead.</h3>
              <p>
                This space will show the run only after the API confirms the
                lead, run, idempotency record, and first lifecycle event were
                stored.
              </p>
            </div>

            <div className="dossier-index" aria-label="Run dossier contents">
              <p className="summary-label">Evidence order</p>
              <ol>
                <li>
                  <span>01</span>
                  Stored identity and revision
                </li>
                <li>
                  <span>02</span>
                  Lifecycle events and retries
                </li>
                <li>
                  <span>03</span>
                  Marketing-readiness evidence
                </li>
                <li>
                  <span>04</span>
                  Separately labeled synthetic outcome
                </li>
              </ol>
            </div>

            <div className="boundary-note">
              <p className="summary-label">Operating boundary</p>
              <p>
                Local Firestore Emulator only. No model, enrichment, quote,
                insurer decision, outreach, or external submission is active.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="page-footer">
        <span>LeadFlow AI · local prototype</span>
        <span>No Military.com intake-parity claim is made.</span>
      </footer>
    </>
  );
}
