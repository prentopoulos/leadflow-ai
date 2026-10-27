import {
  CHANNEL_LABELS,
  CHANNEL_RULES_NOTICE,
  METRICS_DEFINITIONS,
  TRAFFIC_INDEPENDENCE_NOTICE,
  type AcquisitionRatio,
  type AcquisitionReport,
  type CostValue,
} from '@leadflow-ai/domain';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

// Cents round half up at display only; the report keeps exact values.
function dollars(cents: number) {
  return usd.format(Math.round(cents) / 100);
}

function costText(value: CostValue) {
  if (value.reason === 'no_spend') return 'n/a, no spend';
  if (value.reason === 'insufficient_data') return 'Insufficient data';
  return dollars(value.valueCents ?? 0);
}

function share(value: AcquisitionRatio) {
  return value.value === null
    ? 'Insufficient data'
    : `${Math.round(value.value * 100)}%`;
}

function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: CostValue | AcquisitionRatio;
  detail: string;
}) {
  const text = 'valueCents' in value ? costText(value) : share(value);
  return (
    <div>
      <dt>{label}</dt>
      <dd className={value.reason === null ? undefined : 'is-empty'}>{text}</dd>
      <small>{detail}</small>
    </div>
  );
}

export function AcquisitionSection({
  acquisition,
}: {
  acquisition: AcquisitionReport;
}) {
  const { blended } = acquisition;
  // Paid channels first: spend, then lead count, decides the order.
  const channels = acquisition.channels
    .filter((row) => row.leads > 0 || row.spendCents > 0)
    .sort(
      (left, right) =>
        right.spendCents - left.spendCents || right.leads - left.leads,
    );
  const chartData = channels
    .filter((row) => row.cpl.valueCents !== null)
    .map((row) => ({
      label: CHANNEL_LABELS[row.channel],
      dollars: Math.round(row.cpl.valueCents ?? 0) / 100,
    }));

  return (
    <section
      className="acquisition-section"
      aria-labelledby="acquisition-title"
    >
      <div className="section-heading operations-section-heading">
        <h2 id="acquisition-title">
          Acquisition <span className="simulated-tag">SIMULATED</span>
        </h2>
        <p className="acquisition-label">
          Synthetic spend fixture · fictional leads · simulated USD.{' '}
          {acquisition.storedLeads} of {acquisition.plannedLeads} planned leads
          stored; flight spend {dollars(blended.spendCents)}.
        </p>
      </div>

      <dl className="metric-strip">
        <Tile
          label="Cost per lead"
          value={blended.cpl}
          detail={`${blended.leads} leads`}
        />
        <Tile
          label="Cost per qualified lead"
          value={blended.cpql}
          detail={`${blended.qualified} high or standard`}
        />
        <Tile
          label="Cost per contactable lead"
          value={blended.cpcl}
          detail={`${blended.contactable} with email consent`}
        />
        <Tile
          label="Qualified-lead rate"
          value={blended.qualifiedRate}
          detail={`${blended.qualified} / ${blended.leads}`}
        />
      </dl>
      <p className="acquisition-note">
        Cost falls as the flight fills: spend is a flight total, not a running
        cost. {acquisition.unattributedLeads} unattributed and{' '}
        {acquisition.failedRunLeads} failed-run leads are included.
      </p>

      <div className="metrics-grid">
        <div className="chart-section">
          <h3 id="channel-cpl-title">Cost per lead by channel</h3>
          <figure className="chart-frame" aria-labelledby="channel-cpl-caption">
            <figcaption id="channel-cpl-caption" className="chart-caption">
              Simulated cost per lead for channels with spend and leads. Focus
              the chart and use the arrow keys to step through bars; the channel
              table lists every value.
            </figcaption>
            <ResponsiveContainer
              width="100%"
              height={Math.max(160, chartData.length * 44 + 40)}
            >
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 8, right: 64 }}
                accessibilityLayer
                title="Simulated cost per lead by channel"
              >
                <CartesianGrid stroke="#c8c6bd" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#4e5753', fontSize: 12 }}
                  tickFormatter={(value: number) => `$${value}`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  tick={{ fill: '#4e5753', fontSize: 12 }}
                />
                <Bar
                  dataKey="dollars"
                  fill="#087f73"
                  stroke="#075e57"
                  // Static: polling would restart an animation, and Recharts
                  // draws value labels only once an animation finishes.
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="dollars"
                    position="right"
                    fill="#1d2420"
                    fontSize={12}
                    formatter={(value) => usd.format(Number(value))}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </figure>
        </div>

        <div className="acquisition-notes">
          <h3>How these are calculated</h3>
          <dl className="definition-list">
            <div>
              <dt>Cost per lead</dt>
              <dd>
                {METRICS_DEFINITIONS.blendedCostPerLead.numerator} ÷{' '}
                {METRICS_DEFINITIONS.blendedCostPerLead.denominator}
              </dd>
            </div>
            <div>
              <dt>Qualified</dt>
              <dd>{METRICS_DEFINITIONS.costPerQualifiedLead.denominator}</dd>
            </div>
            <div>
              <dt>Contactable</dt>
              <dd>{METRICS_DEFINITIONS.costPerContactableLead.denominator}</dd>
            </div>
          </dl>
          <p>{CHANNEL_RULES_NOTICE}</p>
          <p>{TRAFFIC_INDEPENDENCE_NOTICE}</p>
          <p>{acquisition.spendLabel}</p>
        </div>
      </div>

      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-labelledby="channel-table-caption"
      >
        <table className="data-table">
          <caption id="channel-table-caption">Channels (simulated)</caption>
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Leads</th>
              <th scope="col">Lead share</th>
              <th scope="col">Spend</th>
              <th scope="col">Spend share</th>
              <th scope="col">Qualified rate</th>
              <th scope="col">Cost per lead</th>
              <th scope="col">Per qualified</th>
              <th scope="col">Per contactable</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((row) => (
              <tr key={row.channel}>
                <th scope="row">{CHANNEL_LABELS[row.channel]}</th>
                <td>{row.leads}</td>
                <td>{share(row.leadShare)}</td>
                <td>{dollars(row.spendCents)}</td>
                <td>{share(row.spendShare)}</td>
                <td>{share(row.qualifiedRate)}</td>
                <td>{costText(row.cpl)}</td>
                <td>{costText(row.cpql)}</td>
                <td>{costText(row.cpcl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="campaign-disclosure">
        <summary>Campaigns ({acquisition.campaigns.length})</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Simulated campaigns"
        >
          <table className="data-table">
            <caption className="sr-only">Simulated campaigns</caption>
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Channel</th>
                <th scope="col">Leads</th>
                <th scope="col">Spend</th>
                <th scope="col">Qualified rate</th>
                <th scope="col">Cost per lead</th>
                <th scope="col">Per qualified</th>
              </tr>
            </thead>
            <tbody>
              {acquisition.campaigns.map((row) => (
                <tr key={row.campaign}>
                  <th scope="row">{row.campaign}</th>
                  <td>{CHANNEL_LABELS[row.channel]}</td>
                  <td>{row.leads}</td>
                  <td>{dollars(row.spendCents)}</td>
                  <td>{share(row.qualifiedRate)}</td>
                  <td>{costText(row.cpl)}</td>
                  <td>{costText(row.cpql)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
