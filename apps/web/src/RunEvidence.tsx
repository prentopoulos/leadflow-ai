import { AGENT_TOPICS } from '@leadflow-ai/domain';
import type {
  AgentBriefRecord,
  DraftView,
  EmailCheck,
  EnrichmentEvidence,
  SafeError,
  VerificationResult,
} from '@leadflow-ai/domain';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  PencilLine,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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

// A public page behind each record that whoever handles the lead can open
// during a call: NHTSA's vehicle page (recalls and safety ratings) when the
// model is known, otherwise the exact vPIC or Zippopotam.us query.
function sourceLink(record: EnrichmentEvidence) {
  const subject = record.subject;
  if (subject.kind === 'zip') {
    return {
      href: `https://api.zippopotam.us/us/${subject.zipCode}`,
      label: 'Open Zippopotam.us ZIP data',
    };
  }
  if (subject.make === null || subject.modelYear === null) return null;
  const make = encodeURIComponent(subject.make.toUpperCase());
  if (subject.model !== null) {
    const model = encodeURIComponent(subject.model.toUpperCase());
    return {
      href: `https://www.nhtsa.gov/vehicle/${subject.modelYear}/${make}/${model}`,
      label: 'Open NHTSA recalls and safety ratings',
    };
  }
  return {
    href: `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${make}/modelyear/${subject.modelYear}?format=json`,
    label: 'Open NHTSA vPIC data',
  };
}

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
            </div>
            <Claim record={record} />
            {(() => {
              const link = sourceLink(record);
              return link === null ? null : (
                <a
                  className="evidence-source"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={record.attribution}
                >
                  {link.label}
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              );
            })()}
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
  const failed = verification.rules.filter((rule) => rule.outcome === 'fail');
  return (
    <section className="result-section" aria-labelledby="verification-title">
      <h3 id="verification-title">
        {verification.draftPassed === false || holds.length > 0
          ? 'Blocked'
          : 'Verified'}
      </h3>
      {/* One line for the person handling the lead; only failed checks are
          named, because a passed rule list tells them nothing to act on. */}
      {failed.length === 0 ? (
        <p>All draft checks passed.</p>
      ) : (
        <ul className="rule-list">
          {failed.map((rule) => (
            <li key={rule.ruleId} className="rule-fail">
              <strong>{rule.ruleId}</strong>
              {rule.matches.length > 0 ? ` · ${rule.matches.join(', ')}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const fallbackReasons: Record<
  NonNullable<AgentBriefRecord['fallbackReason']>,
  string
> = {
  no_research_subject: 'nothing verified to research',
  budget_exceeded: 'the spend cap was reached',
  model_error: 'a model call failed',
  no_verified_claims: 'no claim survived source checks',
  rule_check_failed: 'the paragraph kept breaking a rule',
  critic_unresolved: 'the critic did not approve it',
};

const roleNames: Record<AgentBriefRecord['calls'][number]['role'], string> = {
  lead_plan: 'Lead plan',
  worker: 'Worker',
  lead_merge: 'Lead merge',
  writer: 'Writer',
  critic: 'Critic',
};

const dollars = (micros: number, places = 4) =>
  `$${(micros / 1_000_000).toFixed(places)}`;

const topicNames = {
  vehicle: 'Vehicle',
  area: 'Area',
  coverage: 'Coverage',
} as const;

function sourceLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./u, '');
  } catch {
    return url;
  }
}

// The agent team's stored brief, after 21st.dev stat chips and grouped
// cards: a one-line outcome, a row of figures, then the facts used in the
// draft by topic, each with its source. Quotes and model calls stay one
// click away.
export function AgentResearch({ brief }: { brief: AgentBriefRecord }) {
  const cited = brief.claims.filter((claim) =>
    brief.paragraphClaimIds.includes(claim.claimId),
  );
  const shown = brief.status === 'drafted' ? cited : brief.claims;
  const sources = new Set(shown.map((claim) => claim.url)).size;
  const topics = AGENT_TOPICS.map((topic) => ({
    topic,
    claims: shown.filter((claim) => claim.topic === topic),
  })).filter((group) => group.claims.length > 0);
  return (
    <section className="agent-research" aria-labelledby="agent-research-title">
      <div className="draft-heading">
        <h4 id="agent-research-title">Agent research</h4>
        <span className="class-tag class-live">Claude</span>
      </div>
      <p className="agent-summary">
        {brief.status === 'drafted'
          ? 'Written by the agent team from checked sources.'
          : `Template draft used: ${fallbackReasons[brief.fallbackReason ?? 'model_error']}.`}
      </p>
      <dl className="agent-stats">
        <div>
          <dt>Sources</dt>
          <dd>{sources}</dd>
        </div>
        <div>
          <dt>Facts checked</dt>
          <dd>
            {brief.claims.length} of {brief.candidateClaims}
          </dd>
        </div>
        <div>
          <dt>Rewrites</dt>
          <dd>{brief.attempts}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{dollars(brief.totalCostMicros, 2)}</dd>
        </div>
      </dl>
      {topics.map(({ topic, claims }) => (
        <div key={topic} className="agent-topic">
          <h5>{topicNames[topic]}</h5>
          <ul className="agent-facts">
            {claims.map((claim) => (
              <li key={claim.claimId}>
                <p>{claim.text}</p>
                <div className="agent-fact-meta">
                  {claim.url.startsWith('https://') ? (
                    <a
                      className="evidence-source"
                      href={claim.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={claim.title ?? undefined}
                    >
                      {sourceLabel(claim.url)}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  ) : null}
                  <details>
                    <summary>Quote</summary>
                    <blockquote>{claim.quote}</blockquote>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <details className="draft-history">
        <summary>Model calls ({brief.calls.length})</summary>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Model calls</caption>
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Model</th>
                <th scope="col">Result</th>
                <th scope="col">Cost</th>
              </tr>
            </thead>
            <tbody>
              {brief.calls.map((call, index) => (
                <tr key={index}>
                  <th scope="row">
                    {roleNames[call.role]}
                    {call.topic === null ? '' : ` · ${topicNames[call.topic]}`}
                    {call.attempt > 1 ? ` · try ${call.attempt}` : ''}
                  </th>
                  <td>{call.model}</td>
                  <td>
                    {readable(call.outcome)}
                    {call.errorCode === null
                      ? ''
                      : ` (${readable(call.errorCode)})`}
                  </td>
                  <td>{dollars(call.costMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
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
  nextPending = null,
}: {
  draft: DraftView | null;
  skipReason: string | null;
  client: OperationsClient;
  onChanged(): Promise<unknown>;
  nextPending?: { label: string; open(): void } | null;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<SafeError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  // A completed action moves focus to its confirmation, which then offers
  // the next pending draft.
  useEffect(() => {
    if (notice !== null) noticeRef.current?.focus();
  }, [notice]);

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
    review = false,
  ) {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    setReviewed(false);
    const result = await run();
    setBusy(false);
    if (result.status === 'error') {
      setActionError(result.error);
      await onChanged();
      return;
    }
    setEditing(false);
    setReviewed(review);
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
      {draft.agentBrief === null ? null : (
        <AgentResearch brief={draft.agentBrief} />
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
                    true,
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
                    true,
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
        <div className="action-notice" role="status">
          <p ref={noticeRef} tabIndex={-1}>
            {notice}
          </p>
          {reviewed ? (
            nextPending === null ? (
              <p className="next-pending">No other drafts are waiting.</p>
            ) : (
              <Button
                variant="secondary"
                size="compact"
                onClick={nextPending.open}
              >
                Next pending: {nextPending.label}
              </Button>
            )
          ) : null}
        </div>
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
