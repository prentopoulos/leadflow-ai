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
import { useSession } from './session-context.js';
import { SimulatedTrafficControl } from './SimulatedTrafficControl.js';
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

const sourceLabels: Record<string, string> = {
  all: 'All sources',
  nhtsa_vpic: 'NHTSA vPIC',
  zippopotam_us: 'Zippopotam.us',
};

export function MetricsDashboard({
  client = defaultClient,
}: {
  client?: OperationsClient;
}) {
  const [snapshot, setSnapshot] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<SafeError | null>(null);
  const hosted = useSession().mode === 'cloud';
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
        <h2>Loading…</h2>
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
        <h1>Metrics</h1>
      </div>

      {hosted ? (
        <SimulatedTrafficControl systemBundleId={report.systemBundleId} />
      ) : null}

      {error === null ? null : (
        <div className="stale-state" role="status">
          <strong>Refresh failed</strong>
        </div>
      )}

      <section className="metric-ledger" aria-labelledby="metric-ledger-title">
        <div className="section-heading operations-section-heading">
          <h2 id="metric-ledger-title">Workload</h2>
        </div>
        <dl className="metric-strip">
          <div>
            <dt>Lead volume</dt>
            <dd>{report.leadVolume}</dd>
          </div>
          <div>
            <dt>Approval queue</dt>
            <dd>{report.approvalQueue}</dd>
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
            <small>n={report.processingTime.n}</small>
          </div>
        </dl>
      </section>

      <div className="metrics-grid">
        <section className="chart-section" aria-labelledby="priority-title">
          <h2 id="priority-title">Priority</h2>
          {/* Keyboard focus lands inside this frame: Recharts' accessibility
              layer steps through bars with the arrow keys, and the caption
              names the table that carries the same values. */}
          <figure
            className="chart-frame"
            aria-labelledby="priority-chart-caption"
          >
            <figcaption id="priority-chart-caption" className="chart-caption">
              Stored runs by priority. Focus the chart and use the arrow keys to
              step through bars; the table below lists the same counts.
            </figcaption>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={priorityData}
                margin={{ left: -18, right: 8 }}
                accessibilityLayer
                title="Stored runs by priority"
              >
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
          </figure>
          <table className="data-table compact-table">
            <caption className="sr-only">Priority distribution</caption>
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
          <h2 id="timing-title">Timing</h2>
          <dl className="definition-list">
            <div>
              <dt>Processing median / p90 / mean</dt>
              <dd>
                {milliseconds(report.processingTime.medianMs)} /{' '}
                {milliseconds(report.processingTime.p90Ms)} /{' '}
                {milliseconds(report.processingTime.meanMs)}
              </dd>
              <small>n={report.processingTime.n}</small>
            </div>
            <div>
              <dt>Review median / p90 / mean</dt>
              <dd>
                {milliseconds(report.reviewLatency.medianMs)} /{' '}
                {milliseconds(report.reviewLatency.p90Ms)} /{' '}
                {milliseconds(report.reviewLatency.meanMs)}
              </dd>
              <small>n={report.reviewLatency.n}</small>
            </div>
          </dl>
        </section>
      </div>

      <section
        className="metric-table-section"
        aria-labelledby="enrichment-title"
      >
        <h2 id="enrichment-title">Enrichment</h2>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-labelledby="enrichment-title"
        >
          <table className="data-table">
            <caption className="sr-only">
              Enrichment rates by class and source
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
              {[...live, ...recorded].map((item) => (
                <tr key={`${item.classGroup}-${item.source}`}>
                  <th scope="row">
                    {item.classGroup === 'recorded_or_mock'
                      ? 'Recorded / mock'
                      : 'Live'}
                  </th>
                  <td>{sourceLabels[item.source]}</td>
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
          <h2 id="failure-title">Failures</h2>
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
          <h2 id="synthetic-title">Simulation</h2>
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
        </section>
      </div>
    </div>
  );
}
