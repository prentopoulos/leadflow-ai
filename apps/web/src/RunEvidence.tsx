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
    return <p>Skipped: vehicle details missing</p>;
  }
  if (record.outcome === 'unavailable') {
    return <p>No answer ({readable(record.failureKind ?? 'unknown')})</p>;
  }
  if (claim?.kind === 'vehicle_listing') {
    return (
      <p>
        {claim.listed
          ? `${claim.modelYear} ${claim.makeName ?? ''} ${claim.modelName ?? ''}`
          : `Not listed for ${claim.modelYear}`}
      </p>
    );
  }
  if (claim?.kind === 'zip_places') {
    return (
      <p>
        {claim.places
          .map((place) => `${place.placeName}, ${place.stateAbbreviation}`)
          .join('; ')}
        {claim.places.length > 1 ? ' (several)' : ''}
      </p>
    );
  }
  return <p>ZIP not listed</p>;
}

export function EnrichmentEvidenceSection({
  evidence,
  emailCheck,
}: {
  evidence: readonly EnrichmentEvidence[];
  emailCheck: EmailCheck | null;
  completeness: string;
}) {
  if (evidence.length === 0 && emailCheck === null) return null;
  return (
    <section className="result-section" aria-labelledby="evidence-title">
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
            </dl>
            <small>{record.attribution}</small>
          </li>
        ))}
      </ul>
      {emailCheck === null ? null : (
        <p className="email-check">
          <strong>Email:</strong> test domain {emailCheck.domain}
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
      <h3 id="verification-title">
        {verification.draftPassed === false || holds.length > 0
          ? 'Blocked'
          : 'Verified'}
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
        <h3 id="draft-title">No draft</h3>
        <p>{skipReason === 'no_consent' ? 'No consent' : 'Lead held'}</p>
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
        <h3 id="draft-title">{readable(state)}</h3>
        <span className="state-tag">{revision.followUpAction}</span>
      </div>
      <p
        className={`draft-verdict ${passed === checked.length ? 'is-passed' : 'is-blocked'}`}
      >
        {passed} of {checked.length} rules passed
      </p>
      <p className="draft-boundary">
        Approval is for manual use. Nothing is sent.
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
        Revision {revision.revisionNumber} ·{' '}
        {revision.contentSha256.slice(0, 12)}
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
