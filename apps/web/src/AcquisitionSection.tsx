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
  Tooltip,
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

function SimulatedTag() {
  return <span className="simulated-tag">SIMULATED</span>;
}

// The detail sits in its own dd so each tile stays a valid term/description
// group for assistive technology.
function Tile({
  label,
  value,
  detail,
  provisional,
}: {
  label: string;
  value: CostValue | AcquisitionRatio;
  detail: string;
  provisional: boolean;
}) {
  const text = 'valueCents' in value ? costText(value) : share(value);
  return (
    <div>
      <dt>
        {label} · simulated{provisional ? ' · provisional' : ''}
      </dt>
      <dd className={value.reason === null ? undefined : 'is-empty'}>{text}</dd>
      <dd className="metric-detail">{detail}</dd>
    </div>
  );
}

function CostCells({
  row,
}: {
  row: { cpl: CostValue; cpql: CostValue; cpcl: CostValue };
}) {
  // A free channel has no cost at all; one merged cell says so once.
  if (row.cpl.reason === 'no_spend') {
    return (
      <td colSpan={3} className="is-empty">
        No spend (free channel)
      </td>
    );
  }
  return (
    <>
      <td>{costText(row.cpl)}</td>
      <td>{costText(row.cpql)}</td>
      <td>{costText(row.cpcl)}</td>
    </>
  );
}

export function AcquisitionSection({
  acquisition,
}: {
  acquisition: AcquisitionReport;
}) {
  const { blended } = acquisition;
  // Only simulated traffic carries attribution, so attributed leads are the
  // flight's progress; intake-form leads never count toward the plan.
  const flightLeads = acquisition.storedLeads - acquisition.unattributedLeads;
  const provisional = flightLeads < acquisition.plannedLeads;
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
      leads: row.leads,
    }));
  const mixed =
    acquisition.unattributedLeads === 0 && acquisition.failedRunLeads === 0
      ? 'No unattributed or failed-run leads are in the window.'
      : `Includes ${acquisition.unattributedLeads} unattributed and ${acquisition.failedRunLeads} failed-run leads.`;

  return (
    <section
      className="acquisition-section"
      aria-labelledby="acquisition-title"
    >
      <div className="acquisition-heading">
        <h2 id="acquisition-title">
          Acquisition <SimulatedTag />
        </h2>
        <p className="acquisition-label">
          Made-up spend plan · fictional leads · simulated USD. Flight{' '}
          {flightLeads} of {acquisition.plannedLeads} planned leads; spend{' '}
          {dollars(blended.spendCents)}.
        </p>
      </div>

      <dl className="metric-strip">
        <Tile
          label="Cost per lead"
          value={blended.cpl}
          detail={`${blended.leads} leads`}
          provisional={provisional}
        />
        <Tile
          label="Cost per qualified lead"
          value={blended.cpql}
          detail={`${blended.qualified} high or standard`}
          provisional={provisional}
        />
        <Tile
          label="Cost per contactable lead"
          value={blended.cpcl}
          detail={`${blended.contactable} with email consent`}
          provisional={provisional}
        />
        <Tile
          label="Qualified-lead rate"
          value={blended.qualifiedRate}
          detail={`${blended.qualified} / ${blended.leads}`}
          provisional={false}
        />
      </dl>
      <p className="acquisition-note">
        {provisional
          ? "Costs are provisional until the flight finishes: spend is the whole flight's budget, so cost per lead starts high and falls as leads arrive. "
          : ''}
        {mixed}
      </p>

      <div className="metrics-grid">
        <div className="chart-section">
          <h3 id="channel-cpl-title">Cost per lead by channel</h3>
          <figure className="chart-frame" aria-labelledby="channel-cpl-caption">
            <figcaption id="channel-cpl-caption" className="chart-caption">
              <SimulatedTag /> {TRAFFIC_INDEPENDENCE_NOTICE} Bars show simulated
              cost per lead and lead count, ordered by spend. Focus the chart
              and use the arrow keys to step through bars; the channel table
              lists every value.
            </figcaption>
            {chartData.length === 0 ? (
              <p className="chart-empty">
                No channel has both spend and leads yet.
              </p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(160, chartData.length * 44 + 40)}
              >
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 8, right: 112 }}
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
                  <Tooltip
                    animationDuration={0}
                    formatter={(value) => [
                      usd.format(Number(value)),
                      'Simulated cost per lead',
                    ]}
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
                      content={({ x, y, width, height, value, index }) => (
                        <text
                          x={Number(x) + Number(width) + 6}
                          y={Number(y) + Number(height) / 2}
                          dominantBaseline="central"
                          fill="#1d2420"
                          fontSize={12}
                        >
                          {usd.format(Number(value))} ·{' '}
                          {chartData[Number(index)]?.leads} leads
                        </text>
                      )}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </figure>
        </div>

        <div className="chart-section acquisition-notes">
          <h3>How these are calculated</h3>
          <dl className="definition-list">
            <div>
              <dt>Cost per lead</dt>
              <dd>
                {METRICS_DEFINITIONS.blendedCostPerLead.numerator} Divided by{' '}
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
          <caption id="channel-table-caption">
            Channels <SimulatedTag />
            <span className="scroll-hint">
              {' '}
              Scroll sideways for all columns.
            </span>
          </caption>
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Leads</th>
              <th scope="col">Cost per lead</th>
              <th scope="col">Cost per qualified</th>
              <th scope="col">Cost per contactable</th>
              <th scope="col">Qualified rate</th>
              <th scope="col">Spend</th>
              <th scope="col">Spend share</th>
              <th scope="col">Lead share</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((row) => (
              <tr key={row.channel}>
                <th scope="row">{CHANNEL_LABELS[row.channel]}</th>
                <td>{row.leads}</td>
                <CostCells row={row} />
                <td>{share(row.qualifiedRate)}</td>
                <td>{dollars(row.spendCents)}</td>
                <td>{share(row.spendShare)}</td>
                <td>{share(row.leadShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="campaign-disclosure">
        <summary>
          Campaigns ({acquisition.campaigns.length}) <SimulatedTag />
        </summary>
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
                <th scope="col">Cost per lead</th>
                <th scope="col">Cost per qualified</th>
                <th scope="col">Cost per contactable</th>
                <th scope="col">Qualified rate</th>
                <th scope="col">Spend</th>
              </tr>
            </thead>
            <tbody>
              {acquisition.campaigns.map((row) => (
                <tr key={row.campaign}>
                  <th scope="row">{row.campaign}</th>
                  <td>{CHANNEL_LABELS[row.channel]}</td>
                  <td>{row.leads}</td>
                  <CostCells row={row} />
                  <td>{share(row.qualifiedRate)}</td>
                  <td>{dollars(row.spendCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
