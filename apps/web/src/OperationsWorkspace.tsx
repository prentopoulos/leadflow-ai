import type {
  RunListFilter,
  RunListResponse,
  RunSummary,
  SafeError,
} from '@leadflow-ai/domain';
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  FilePlus2,
  Inbox,
  Keyboard,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from './components/ui/button.js';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './components/ui/tabs.js';
import { Masthead, SimulationStrip } from './Masthead.js';
import { MetricsDashboard } from './MetricsDashboard.js';
import {
  operationsClient as defaultOperationsClient,
  type OperationsClient,
} from './operations-client.js';
import { RunDossier } from './RunDossier.js';
import type { RunClient } from './run-client.js';
import { useSession } from './session-context.js';
import { useVisiblePolling } from './use-visible-polling.js';

export type OperatorView = 'runs' | 'metrics';

function readable(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/^\w/u, (letter) => letter.toUpperCase());
}

function age(timestamp: string) {
  const milliseconds = Math.max(0, Date.now() - Date.parse(timestamp));
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes < 1) return 'under 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.floor(hours / 24)} d`;
}

function RunItem({
  item,
  selected,
  onSelect,
}: {
  item: RunSummary;
  selected: boolean;
  onSelect(): void;
}) {
  const attention =
    item.leaseState === 'expired' ||
    item.status.startsWith('failed') ||
    item.draftState === 'verification_blocked';
  // A concise accessible name; the visible grid repeats the details and
  // the dossier holds the full record.
  const name = [
    `Lead ${item.shortLeadId}`,
    readable(item.status),
    `${readable(item.priority)} priority`,
    `draft ${readable(item.draftState).toLowerCase()}`,
    attention ? 'needs attention' : null,
    item.resumable ? 'resume available' : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <li className={selected ? 'run-item is-selected' : 'run-item'}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={name}
      >
        <span className="run-item-heading">
          <strong>Lead {item.shortLeadId}</strong>
          <span className={`status-marker status-${item.status}`}>
            {readable(item.status)}
          </span>
        </span>
        <span className="run-item-grid">
          <span>
            <small>Priority</small>
            {readable(item.priority)}
          </span>
          <span>
            <small>Age</small>
            {age(item.createdAt)}
          </span>
          <span>
            <small>Retries</small>
            {item.retryCount}
          </span>
          <span>
            <small>Evidence</small>
            {readable(item.evidenceCompleteness)}
          </span>
          <span>
            <small>Draft</small>
            {readable(item.draftState)}
          </span>
          <span>
            <small>Lease</small>
            {readable(item.leaseState)}
          </span>
        </span>
        {attention ? (
          <span className="run-attention">
            <AlertTriangle size={15} aria-hidden="true" />
            Operator attention required
          </span>
        ) : null}
        {item.resumable ? (
          <span className="run-resumable">
            <RefreshCw size={14} aria-hidden="true" />
            Resume available in dossier
          </span>
        ) : null}
      </button>
    </li>
  );
}

function RunsView({
  client,
  runClient,
}: {
  client: OperationsClient;
  runClient?: RunClient;
}) {
  const [filter, setFilter] = useState<RunListFilter>('all');
  const [snapshot, setSnapshot] = useState<RunListResponse | null>(null);
  const [error, setError] = useState<SafeError | null>(null);
  const [selected, setSelected] = useState<RunSummary | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageCount = useRef(1);

  const refresh = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      let cursor: string | undefined;
      const items: RunSummary[] = [];
      let latest: RunListResponse | null = null;
      for (let page = 0; page < pageCount.current; page += 1) {
        const result = await client.list(filter, cursor, 12);
        if (!isCurrent()) return;
        if (result.status === 'error') {
          setError(result.error);
          return;
        }
        latest = result.value;
        items.push(...result.value.items);
        cursor = result.value.nextCursor ?? undefined;
        if (cursor === undefined) break;
      }
      if (latest === null) return;
      setSnapshot({ ...latest, items, nextCursor: cursor ?? null });
      setError(null);
      setSelected((current) => {
        if (current === null) return items[0] ?? null;
        return items.find((item) => item.runId === current.runId) ?? current;
      });
    },
    [client, filter],
  );
  useVisiblePolling(refresh);

  // After a review, the operator is offered the next draft still waiting.
  const nextPending =
    snapshot?.items.find(
      (item) =>
        item.draftState === 'pending_review' && item.runId !== selected?.runId,
    ) ?? null;
  const dossierHeading = useRef<HTMLHeadingElement>(null);
  const openNextPending =
    nextPending === null
      ? null
      : () => {
          setSelected(nextPending);
          dossierHeading.current?.focus();
        };

  const changeFilter = (next: RunListFilter) => {
    pageCount.current = 1;
    setSnapshot(null);
    setSelected(null);
    setError(null);
    setFilter(next);
  };

  const loadMore = async () => {
    if (snapshot?.nextCursor === null || snapshot === null) return;
    setLoadingMore(true);
    const result = await client.list(filter, snapshot.nextCursor, 12);
    setLoadingMore(false);
    if (result.status === 'error') {
      setError(result.error);
      return;
    }
    pageCount.current += 1;
    setSnapshot({
      ...result.value,
      items: [...snapshot.items, ...result.value.items],
    });
    setError(null);
  };

  return (
    <div className="runs-workspace">
      <div className="operations-heading">
        <h1>Runs</h1>
      </div>

      <div className="run-monitor-layout">
        <section className="run-list-pane" aria-labelledby="run-list-title">
          <div className="section-heading operations-section-heading">
            <h2 id="run-list-title">Leads</h2>
            <span className="state-tag">
              {snapshot?.totalMatching ?? '—'} matching
            </span>
          </div>

          <div className="run-filters" role="group" aria-label="Run filters">
            <Button
              variant={filter === 'all' ? 'primary' : 'secondary'}
              size="compact"
              aria-pressed={filter === 'all'}
              onClick={() => changeFilter('all')}
            >
              All runs
            </Button>
            <Button
              variant={filter === 'approval_queue' ? 'primary' : 'secondary'}
              size="compact"
              aria-pressed={filter === 'approval_queue'}
              onClick={() => changeFilter('approval_queue')}
            >
              <Inbox size={15} aria-hidden="true" /> Approval queue
            </Button>
            <Button
              variant={filter === 'attention' ? 'primary' : 'secondary'}
              size="compact"
              aria-pressed={filter === 'attention'}
              onClick={() => changeFilter('attention')}
            >
              <AlertTriangle size={15} aria-hidden="true" /> Attention
            </Button>
          </div>

          {error === null ? null : (
            <div className="stale-state" role="status">
              <strong>Refresh failed</strong>
              <span>
                {snapshot === null
                  ? error.message
                  : `Showing the snapshot retrieved ${new Date(snapshot.retrievedAt).toLocaleTimeString()}.`}
              </span>
            </div>
          )}

          {snapshot === null ? (
            <div className="operations-loading" aria-live="polite">
              <Clock3 size={22} aria-hidden="true" />
              <p>Loading…</p>
            </div>
          ) : snapshot.items.length === 0 ? (
            <div className="empty-run compact-empty">
              <span className="empty-glyph" aria-hidden="true">
                00
              </span>
              <h3>No runs</h3>
            </div>
          ) : (
            <>
              <ol className="run-list">
                {snapshot.items.map((item) => (
                  <RunItem
                    key={item.runId}
                    item={item}
                    selected={selected?.runId === item.runId}
                    onSelect={() => setSelected(item)}
                  />
                ))}
              </ol>
              {snapshot.nextCursor === null ? null : (
                <Button
                  className="load-more"
                  variant="secondary"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : 'Load 12 more'}
                </Button>
              )}
            </>
          )}
        </section>

        <aside
          className="monitor-dossier"
          aria-labelledby="monitor-dossier-title"
        >
          <div className="section-heading operations-section-heading">
            <h2 id="monitor-dossier-title" ref={dossierHeading} tabIndex={-1}>
              Dossier
            </h2>
            <span className="state-tag">
              {selected === null
                ? 'Nothing selected'
                : `Lead ${selected.shortLeadId}`}
            </span>
          </div>
          {selected === null ? (
            <div className="empty-run compact-empty">
              <FilePlus2 size={28} aria-hidden="true" />
              <h3>Nothing selected</h3>
            </div>
          ) : (
            <RunDossier
              key={selected.runId}
              runId={selected.runId}
              initialRevision={selected.revision}
              pollIntervalMs={3_000}
              maxPollAttempts={Number.POSITIVE_INFINITY}
              operationsClient={client}
              nextPending={
                nextPending === null || openNextPending === null
                  ? null
                  : {
                      label: `Lead ${nextPending.shortLeadId}`,
                      open: openNextPending,
                    }
              }
              {...(runClient === undefined ? {} : { client: runClient })}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// The workspace adds no single-key shortcuts that could collide with screen
// reader commands; it documents the standard keys each control supports.
function KeyboardGuide() {
  return (
    <section className="page-shell keyboard-guide" aria-labelledby="keys-title">
      <details>
        <summary>
          <Keyboard size={15} aria-hidden="true" />
          <span id="keys-title">Keyboard shortcuts</span>
        </summary>
        <dl>
          <div>
            <dt>
              <kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd>
            </dt>
            <dd>Move between controls in reading order.</dd>
          </div>
          <div>
            <dt>
              <kbd>←</kbd> <kbd>→</kbd>
            </dt>
            <dd>Switch between Runs and Metrics when the tabs have focus.</dd>
          </div>
          <div>
            <dt>
              <kbd>Enter</kbd> or <kbd>Space</kbd>
            </dt>
            <dd>
              Choose a filter or lead, open or close a disclosure, or press a
              button.
            </dd>
          </div>
          <div>
            <dt>
              <kbd>←</kbd> <kbd>→</kbd> in a chart
            </dt>
            <dd>
              Step through the bars; the table under each chart lists the same
              values.
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

export function OperationsWorkspace({
  view,
  operationsClient = defaultOperationsClient,
  runClient,
}: {
  view: OperatorView;
  operationsClient?: OperationsClient;
  runClient?: RunClient;
}) {
  const session = useSession();
  const navigate = (next: string) => {
    window.location.hash = next;
  };
  return (
    <>
      <SimulationStrip />
      <Masthead view={view} />

      <main id="main-content" className="page-shell operations-page">
        <Tabs value={view} onValueChange={navigate}>
          <TabsList aria-label="Operations workspace">
            <TabsTrigger value="runs">
              <Inbox size={16} aria-hidden="true" /> Runs
            </TabsTrigger>
            <TabsTrigger value="metrics">
              <BarChart3 size={16} aria-hidden="true" /> Metrics
            </TabsTrigger>
          </TabsList>
          <TabsContent value="runs">
            <RunsView
              client={operationsClient}
              {...(runClient === undefined ? {} : { runClient })}
            />
          </TabsContent>
          <TabsContent value="metrics">
            <MetricsDashboard client={operationsClient} />
          </TabsContent>
        </Tabs>
      </main>
      <KeyboardGuide />
      <footer className="page-footer">
        <span>
          LeadFlow AI ·{' '}
          {session.mode === 'cloud'
            ? 'private hosted proof'
            : 'local prototype'}
        </span>
        <span>No outreach is sent. Approval permits manual use only.</span>
      </footer>
    </>
  );
}
