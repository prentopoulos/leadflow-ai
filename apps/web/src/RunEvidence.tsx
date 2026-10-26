import type {
  DraftView,
  EmailCheck,
  EnrichmentEvidence,
  SafeError,
  VerificationResult,
} from '@leadflow-ai/domain';
import { Check, Copy, Download, PencilLine, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from './components/ui/button.js';
import type { OperationsClient } from './operations-client.js';

function readable(value: string) {
  return value
    .replace(/[._]+/gu, ' ')
    .replace(/^\w/u, (letter) => letter.toUpperCase());
}

const sourceNames = {
  nhtsa_vpic: 'NHTSA vPIC',
  zippopotam_us: 'Zippopotam.us',
} as const;

const classLabels = {
  live: 'Live',
  recorded: 'Recorded',
  mock: 'Mock',
} as const;

function time(value: string | null) {
  return value === null ? '—' : new Date(value).toLocaleString();
}

function Claim({ record }: { record: EnrichmentEvidence }) {
  const claim = record.claim;
  if (record.outcome === 'not_attempted') {
    return <p>Not attempted: the vehicle year, make or model is missing.</p>;
  }
  if (record.outcome === 'unavailable') {
    return (
      <p>
        Unavailable ({readable(record.failureKind ?? 'unknown')}). This is not
        evidence that the value is wrong.
      </p>
    );
  }
  if (claim?.kind === 'vehicle_listing') {
    return (
      <p>
        {claim.listed
          ? `${claim.modelYear} ${claim.makeName ?? ''} ${claim.modelName ?? ''}: ${claim.statement}.`
          : `Not listed by NHTSA vPIC for model year ${claim.modelYear}. The intake value is shown unchanged.`}
      </p>
    );
  }
  if (claim?.kind === 'zip_places') {
    return (
      <p>
        {claim.places
          .map((place) => `${place.placeName}, ${place.stateAbbreviation}`)
          .join('; ')}
        {claim.places.length > 1 ? ' (several places; none is chosen)' : ''}
      </p>
    );
  }
  return <p>The source answered that this ZIP Code is not listed.</p>;
}

export function EnrichmentEvidenceSection({
  evidence,
  emailCheck,
  completeness,
}: {
  evidence: readonly EnrichmentEvidence[];
  emailCheck: EmailCheck | null;
  completeness: string;
}) {
  if (evidence.length === 0 && emailCheck === null) return null;
  return (
    <section className="result-section" aria-labelledby="evidence-title">
      <p className="section-index">
        Source evidence · {readable(completeness)}
      </p>
      <h3 id="evidence-title">Enrichment</h3>
      <ul className="evidence-list">
        {evidence.map((record) => (
          <li key={record.evidenceId} className={`evidence-${record.outcome}`}>
            <div className="evidence-heading">
              <strong>{sourceNames[record.source]}</strong>
              <span className="state-tag">{readable(record.outcome)}</span>
              <span
                className={`class-tag class-${record.evidenceClass}`}
                title="Evidence class"
              >
                {classLabels[record.evidenceClass]}
              </span>
            </div>
            <Claim record={record} />
            <dl className="evidence-facts">
              <div>
                <dt>Retrieved</dt>
                <dd>{time(record.retrievedAt)}</dd>
              </div>
              {record.recordedCapturedAt === null ? null : (
                <div>
                  <dt>Live capture</dt>
                  <dd>{time(record.recordedCapturedAt)}</dd>
                </div>
              )}
              <div>
                <dt>HTTP</dt>
                <dd>{record.httpStatus ?? '—'}</dd>
              </div>
              <div>
                <dt>Attempts</dt>
                <dd>{record.attempts}</dd>
              </div>
              <div>
                <dt>Body SHA-256</dt>
                <dd className="mono">
                  {record.rawBodySha256?.slice(0, 12) ?? '—'}
                  {record.rawBodyTruncated ? ' (truncated copy)' : ''}
                </dd>
              </div>
            </dl>
            <small>{record.attribution}</small>
          </li>
        ))}
      </ul>
      {emailCheck === null ? null : (
        <p className="email-check">
          <strong>Email check:</strong> valid syntax on the reserved test domain{' '}
          {emailCheck.domain}. Local check; {emailCheck.limitation}.
        </p>
      )}
    </section>
  );
}

export function VerificationSection({
  verification,
  holds,
}: {
  verification: VerificationResult | null;
  holds: readonly string[];
}) {
  if (verification === null) return null;
  return (
    <section className="result-section" aria-labelledby="verification-title">
      <p className="section-index">
        {verification.rulesVersion} · {verification.decisionLanguageVersion}
      </p>
      <h3 id="verification-title">
        Verification{' '}
        {verification.draftPassed === false || holds.length > 0
          ? 'blocked the draft'
          : 'passed'}
      </h3>
      <ul className="rule-list">
        {verification.rules.map((rule) => (
          <li key={rule.ruleId} className={`rule-${rule.outcome}`}>
            <span className="rule-mark" aria-hidden="true">
              {rule.outcome === 'pass'
                ? '✓'
                : rule.outcome === 'fail'
                  ? '✕'
                  : '–'}
            </span>
            <span>
              <strong>{rule.ruleId}</strong> {readable(rule.outcome)}
              {rule.matches.length > 0 ? ` · ${rule.matches.join(', ')}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function exportDraft(subject: string, body: string, revisionNumber: number) {
  const blob = new Blob([`Subject: ${subject}\n\n${body}\n`], {
    type: 'text/plain',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `leadflow-draft-revision-${revisionNumber}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function DraftSection({
  draft,
  skipReason,
  client,
  onChanged,
}: {
  draft: DraftView | null;
  skipReason: string | null;
  client: OperationsClient;
  onChanged(): Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<SafeError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (draft === null) {
    if (skipReason === null) return null;
    return (
      <section className="result-section" aria-labelledby="draft-title">
        <p className="section-index">Outreach</p>
        <h3 id="draft-title">No draft</h3>
        <p>
          {skipReason === 'no_consent'
            ? 'No email-contact consent was recorded, so no outreach draft exists.'
            : 'Qualification was held, so no outreach draft was composed.'}
        </p>
      </section>
    );
  }
  const latest = draft.revisions.at(-1);
  if (latest === undefined) return null;
  const { revision, state, verification } = latest;
  const draftId = revision.draftId;
  const checked = verification.rules.filter(
    (rule) => rule.outcome !== 'not_applicable',
  );
  const passed = checked.filter((rule) => rule.outcome === 'pass').length;

  async function act(
    run: () => ReturnType<OperationsClient['review']>,
    success: string,
  ) {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    const result = await run();
    setBusy(false);
    if (result.status === 'error') {
      setActionError(result.error);
      await onChanged();
      return;
    }
    setEditing(false);
    setNotice(success);
    await onChanged();
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void act(
      () =>
        client.revise(draftId, {
          baseRevisionId: revision.revisionId,
          baseContentSha256: revision.contentSha256,
          subject: String(form.get('subject') ?? ''),
          body: String(form.get('body') ?? ''),
        }),
      'Saved a new revision; it was verified again before entering the queue.',
    );
  }

  return (
    <section
      className="result-section draft-section"
      aria-labelledby="draft-title"
    >
      <div className="draft-heading">
        <div>
          <p className="section-index">
            Email draft · revision {revision.revisionNumber} ·{' '}
            {revision.origin === 'template'
              ? revision.composerVersion
              : 'operator edited'}
          </p>
          <h3 id="draft-title">{readable(state)}</h3>
        </div>
        <span className="state-tag">{revision.followUpAction}</span>
      </div>
      <p
        className={`draft-verdict ${passed === checked.length ? 'is-passed' : 'is-blocked'}`}
      >
        Verification: {passed} of {checked.length} rules passed
        {passed === checked.length ? '' : ' · see Verification below'}
      </p>
      <p className="draft-boundary">
        Approval means approved for manual use. LeadFlow never sends email.
      </p>
      {editing ? (
        <form className="draft-edit" onSubmit={submitEdit}>
          <label htmlFor="draft-subject">Subject</label>
          <input
            id="draft-subject"
            name="subject"
            defaultValue={revision.subject}
            maxLength={160}
            required
          />
          <label htmlFor="draft-body">Body</label>
          <textarea
            id="draft-body"
            name="body"
            defaultValue={revision.body}
            maxLength={4_000}
            rows={14}
            required
          />
          <div className="draft-actions">
            <Button type="submit" disabled={busy}>
              Save revision
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <article className="draft-preview" aria-label="Draft email">
          <p>
            <strong>Subject:</strong> {revision.subject}
          </p>
          <pre>{revision.body}</pre>
        </article>
      )}
      {revision.slots.some(
        (slot) => slot.provenance === 'verified_evidence',
      ) ? (
        <p className="slot-legend">
          Grounded sentences:{' '}
          {revision.slots
            .filter((slot) => slot.provenance === 'verified_evidence')
            .map((slot) => slot.key)
            .join(', ')}{' '}
          come from found source evidence.
        </p>
      ) : null}
      {editing ? null : (
        <div className="draft-actions">
          {state === 'pending_review' ? (
            <>
              <Button
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      client.review(draftId, {
                        revisionId: revision.revisionId,
                        contentSha256: revision.contentSha256,
                        decision: 'approved',
                      }),
                    'Approved for manual use. Nothing was sent.',
                  )
                }
              >
                <Check size={16} aria-hidden="true" /> Approve for manual use
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      client.review(draftId, {
                        revisionId: revision.revisionId,
                        contentSha256: revision.contentSha256,
                        decision: 'rejected',
                      }),
                    'Rejected. The draft stays stored.',
                  )
                }
              >
                <X size={16} aria-hidden="true" /> Reject
              </Button>
            </>
          ) : null}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            <PencilLine size={16} aria-hidden="true" /> Edit as new revision
          </Button>
          {state === 'approved' ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard
                    ?.writeText(
                      `Subject: ${revision.subject}\n\n${revision.body}`,
                    )
                    .then(() => setNotice('Copied. Nothing was sent.'))
                }
              >
                <Copy size={16} aria-hidden="true" /> Copy
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  exportDraft(
                    revision.subject,
                    revision.body,
                    revision.revisionNumber,
                  )
                }
              >
                <Download size={16} aria-hidden="true" /> Export .txt
              </Button>
            </>
          ) : null}
        </div>
      )}
      {notice === null ? null : (
        <p className="action-notice" role="status">
          {notice}
        </p>
      )}
      <p className="operator-label">
        A decision binds revision {revision.revisionNumber}, digest{' '}
        {revision.contentSha256.slice(0, 12)}. Recorded as: Local operator
        (unauthenticated).
      </p>
      {actionError === null ? null : (
        <p className="safe-error" role="alert">
          {actionError.message}
        </p>
      )}
      {draft.reviews.length > 0 || draft.revisions.length > 1 ? (
        <details className="draft-history">
          <summary>
            History: {draft.revisions.length} revision(s),{' '}
            {draft.reviews.length} decision(s)
          </summary>
          <ol>
            {draft.revisions.map((entry) => (
              <li key={entry.revision.revisionId}>
                Revision {entry.revision.revisionNumber} ·{' '}
                {readable(entry.state)} ·{' '}
                {entry.revision.contentSha256.slice(0, 12)}
              </li>
            ))}
            {draft.reviews.map((review) => (
              <li key={review.reviewId}>
                {readable(review.decision)} {time(review.decidedAt)} · digest{' '}
                {review.contentSha256.slice(0, 12)}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
