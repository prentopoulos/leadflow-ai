import type { MetricsResponse, RateValue } from '@leadflow-ai/domain';
import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OperationsClient, SafeError } from './operations-client.js';
import { operationsClient as defaultClient } from './operations-client.js';
import { useVisiblePolling } from './use-visible-polling.js';

function milliseconds(value: number | null) {
  if (value === null) return 'Insufficient data';
  if (value < 1_000) return `${Math.round(value)} ms`;
  return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} s`;
}

function percent(metric: RateValue) {
  return metric.value === null
    ? 'Insufficient data'
    : `${Math.round(metric.value * 100)}%`;
}

function RateDefinition({ metric }: { metric: RateValue }) {
  return (
    <span className="metric-denominator">
      {metric.numerator} / {metric.denominator}; {metric.excluded} excluded
    </span>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function MetricsDashboard({
  client = defaultClient,
}: {
  client?: OperationsClient;
}) {
  const [snapshot, setSnapshot] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<SafeError | null>(null);
  const reducedMotion = useReducedMotion();
  const refresh = useCallback(async () => {
    const result = await client.metrics();
    if (result.status === 'error') {
      setError(result.error);
      return;
    }
    setSnapshot(result.value);
    setError(null);
  }, [client]);
  useVisiblePolling(refresh);

  if (snapshot === null) {
    return (
      <div className="operations-loading" aria-live="polite">
        <p className="section-index">Stored metrics</p>
        <h2>Loading the current bundle window…</h2>
        {error === null ? null : <p>{error.message}</p>}
      </div>
    );
  }

  const { report } = snapshot;
  const priorityData = Object.entries(report.priorityDistribution).map(
    ([label, count]) => ({ label: label.replace('_', ' '), count }),
  );
  const recorded = report.enrichment.filter(
    (item) => item.classGroup === 'recorded_or_mock',
  );
  const live = report.enrichment.filter((item) => item.classGroup === 'live');

  return (
    <div className="metrics-dashboard">
      <div className="operations-heading">
        <div>
          <p className="eyebrow">Current system bundle</p>
          <h1>Operational evidence, with the denominator attached.</h1>
        </div>
        <p>
          Calculated only from stored run records. Recorded/mock enrichment is
          kept separate from live enrichment; synthetic outcomes are never
          presented as operational results.
        </p>
      </div>

      {error === null ? null : (
        <div className="stale-state" role="status">
          <strong>Metrics refresh is unavailable.</strong>
          <span>
            Showing the snapshot retrieved{' '}
            {new Date(snapshot.retrievedAt).toLocaleTimeString()}.
          </span>
        </div>
      )}

      <section className="metric-ledger" aria-labelledby="metric-ledger-title">
        <div className="section-heading operations-section-heading">
          <div>
            <p className="section-index">01 / Window</p>
            <h2 id="metric-ledger-title">Current stored workload</h2>
          </div>
          <span className="state-tag">metrics-definitions-v1</span>
        </div>
        <dl className="metric-strip">
          <div>
            <dt>Lead volume</dt>
            <dd>{report.leadVolume}</dd>
            <small>{report.window.otherBundleRuns} other-bundle excluded</small>
          </div>
          <div>
            <dt>Approval queue</dt>
            <dd>{report.approvalQueue}</dd>
            <small>Latest pending revisions</small>
          </div>
          <div>
            <dt>Agent failures</dt>
            <dd
              className={
                report.agentFailures.value === null ? 'is-empty' : undefined
              }
            >
              {percent(report.agentFailures)}
            </dd>
            <RateDefinition metric={report.agentFailures} />
          </div>
          <div>
            <dt>Median processing</dt>
            <dd
              className={
                report.processingTime.medianMs === null ? 'is-empty' : undefined
              }
            >
              {milliseconds(report.processingTime.medianMs)}
            </dd>
            <small>
              n={report.processingTime.n}; {report.processingTime.excluded}{' '}
              active excluded
            </small>
          </div>
        </dl>
      </section>

      <div className="metrics-grid">
        <section className="chart-section" aria-labelledby="priority-title">
          <p className="section-index">02 / Distribution</p>
          <h2 id="priority-title">Marketing-readiness priority</h2>
          <p className="section-note">
            Labels support outreach triage only—not insurance eligibility,
            pricing, underwriting, or risk.
          </p>
          <div className="chart-frame" aria-hidden="true">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={priorityData} margin={{ left: -18, right: 8 }}>
                <CartesianGrid stroke="#c8c6bd" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#4e5753', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#4e5753', fontSize: 12 }}
                />
                <Tooltip animationDuration={0} />
                <Bar
                  dataKey="count"
                  fill="#087f73"
                  stroke="#075e57"
                  isAnimationActive={!reducedMotion}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="data-table compact-table">
            <caption>Text equivalent for priority distribution chart</caption>
            <thead>
              <tr>
                <th scope="col">Priority</th>
                <th scope="col">Stored runs</th>
              </tr>
            </thead>
            <tbody>
              {priorityData.map((item) => (
                <tr key={item.label}>
                  <th scope="row">{item.label}</th>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="chart-section" aria-labelledby="timing-title">
          <p className="section-index">03 / Timing</p>
          <h2 id="timing-title">Stored processing and review</h2>
          <dl className="definition-list">
            <div>
              <dt>Processing median / p90 / mean</dt>
              <dd>
                {milliseconds(report.processingTime.medianMs)} /{' '}
                {milliseconds(report.processingTime.p90Ms)} /{' '}
                {milliseconds(report.processingTime.meanMs)}
              </dd>
              <small>
                Finished runs n={report.processingTime.n}; active exclusions{' '}
                {report.processingTime.excluded}.
              </small>
            </div>
            <div>
              <dt>Review median / p90 / mean</dt>
              <dd>
                {milliseconds(report.reviewLatency.medianMs)} /{' '}
                {milliseconds(report.reviewLatency.p90Ms)} /{' '}
                {milliseconds(report.reviewLatency.meanMs)}
              </dd>
              <small>
                Reviewed drafts n={report.reviewLatency.n}; unreviewed
                exclusions {report.reviewLatency.excluded}.
              </small>
            </div>
          </dl>
        </section>
      </div>

      <section
        className="metric-table-section"
        aria-labelledby="enrichment-title"
      >
        <p className="section-index">04 / Source evidence</p>
        <h2 id="enrichment-title">Enrichment outcomes stay separated</h2>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-labelledby="enrichment-title"
        >
          <table className="data-table">
            <caption>
              Success and found rates by evidence class and source
            </caption>
            <thead>
              <tr>
                <th scope="col">Evidence class</th>
                <th scope="col">Source</th>
                <th scope="col">Success</th>
                <th scope="col">Found</th>
                <th scope="col">Not attempted</th>
              </tr>
            </thead>
            <tbody>
              {[...recorded, ...live].map((item) => (
                <tr key={`${item.classGroup}-${item.source}`}>
                  <th scope="row">
                    {item.classGroup === 'recorded_or_mock'
                      ? 'Recorded / mock'
                      : 'Live'}
                  </th>
                  <td>{item.source.replaceAll('_', ' ')}</td>
                  <td>
                    {percent(item.success)}{' '}
                    <RateDefinition metric={item.success} />
                  </td>
                  <td>
                    {percent(item.foundRate)}{' '}
                    <RateDefinition metric={item.foundRate} />
                  </td>
                  <td>{item.notAttempted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="metrics-grid">
        <section
          className="metric-table-section"
          aria-labelledby="failure-title"
        >
          <p className="section-index">05 / Recovery</p>
          <h2 id="failure-title">Failures by workflow step</h2>
          <dl className="failure-ledger">
            {Object.entries(report.failuresByStep).map(([step, count]) => (
              <div key={step}>
                <dt>{step.replaceAll('_', ' ')}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="synthetic-panel" aria-labelledby="synthetic-title">
          <p className="section-index">SYNTHETIC · not live · not predictive</p>
          <h2 id="synthetic-title">Simulator contract exercise</h2>
          <dl>
            <div>
              <dt>Runs</dt>
              <dd>{report.simulation.runs}</dd>
            </div>
            <div>
              <dt>Contacted</dt>
              <dd>{report.simulation.contacted}</dd>
            </div>
            <div>
              <dt>Responded</dt>
              <dd>{report.simulation.responded}</dd>
            </div>
            <div>
              <dt>Appointment</dt>
              <dd>{report.simulation.appointment}</dd>
            </div>
          </dl>
          <p>
            These fixed-seed outcomes are never included in operational rates.
          </p>
        </section>
      </div>

      <p className="metrics-footnote">
        Retrieved {new Date(snapshot.retrievedAt).toLocaleString()} · bundle{' '}
        {report.systemBundleId} · synthetic leads stored locally; each lookup
        row names its own evidence class
      </p>
    </div>
  );
}
