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

// The detail sits in its own dd so each tile stays a valid term/description
// group for assistive technology.
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
  const notes = [
    provisional ? 'Provisional: costs fall as the flight fills.' : null,
    acquisition.unattributedLeads > 0
      ? `Includes ${acquisition.unattributedLeads} intake-form leads.`
      : null,
    acquisition.failedRunLeads > 0
      ? `Includes ${acquisition.failedRunLeads} failed runs.`
      : null,
  ].filter((note) => note !== null);

  return (
    <section
      className="acquisition-section"
      aria-labelledby="acquisition-title"
    >
      <div className="acquisition-heading">
        <h2 id="acquisition-title">Acquisition</h2>
      </div>

      <dl className="metric-strip acquisition-strip">
        <div>
          <dt>Spend</dt>
          <dd>{dollars(blended.spendCents)}</dd>
        </div>
        <div>
          <dt>Leads</dt>
          <dd>{blended.leads}</dd>
          <dd className="metric-detail">
            {flightLeads} of {acquisition.plannedLeads} planned
          </dd>
        </div>
        <Tile label="CPL" value={blended.cpl} detail="per lead" />
        <Tile
          label="Cost per MQL"
          value={blended.cpql}
          detail={`${blended.qualified} MQLs`}
        />
        <Tile
          label="Cost per contactable lead"
          value={blended.cpcl}
          detail={`${blended.contactable} consented`}
        />
        <Tile
          label="MQL rate"
          value={blended.qualifiedRate}
          detail={`${blended.qualified} of ${blended.leads}`}
        />
      </dl>
      {notes.length > 0 ? (
        <p className="acquisition-note">{notes.join(' ')}</p>
      ) : null}

      <div className="chart-section">
        <h3 id="channel-cpl-title">CPL by channel</h3>
        <figure className="chart-frame" aria-labelledby="channel-cpl-caption">
          <figcaption id="channel-cpl-caption" className="sr-only">
            Focus the chart and use the arrow keys to step through bars; the
            channel table lists every value.
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
                title="CPL by channel"
              >
                <CartesianGrid
                  stroke="#dcd9d0"
                  strokeDasharray="4 4"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#4e5753', fontSize: 12 }}
                  tickFormatter={(value: number) => `$${value}`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#1a211f', fontSize: 12, fontWeight: 600 }}
                />
                <Tooltip
                  animationDuration={0}
                  formatter={(value) => [usd.format(Number(value)), 'CPL']}
                  cursor={{ fill: 'rgb(11 23 20 / 5%)' }}
                />
                <Bar
                  dataKey="dollars"
                  fill="#087f73"
                  stroke="#075e57"
                  radius={[0, 8, 8, 0]}
                  maxBarSize={26}
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

      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-labelledby="channel-table-caption"
      >
        <table className="data-table">
          <caption id="channel-table-caption">
            Channels
            <span className="scroll-hint"> Scroll for more.</span>
          </caption>
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Leads</th>
              <th scope="col">CPL</th>
              <th scope="col">Cost per MQL</th>
              <th scope="col">Cost per contactable</th>
              <th scope="col">MQL rate</th>
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
        <summary>Campaigns ({acquisition.campaigns.length})</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Campaigns"
        >
          <table className="data-table">
            <caption className="sr-only">Campaigns</caption>
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Channel</th>
                <th scope="col">Leads</th>
                <th scope="col">CPL</th>
                <th scope="col">Cost per MQL</th>
                <th scope="col">Cost per contactable</th>
                <th scope="col">MQL rate</th>
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

      <details className="campaign-disclosure acquisition-notes">
        <summary>How these are calculated</summary>
        <dl className="definition-list">
          <div>
            <dt>CPL (cost per lead)</dt>
            <dd>
              {METRICS_DEFINITIONS.blendedCostPerLead.numerator} Divided by{' '}
              {METRICS_DEFINITIONS.blendedCostPerLead.denominator}
            </dd>
          </div>
          <div>
            <dt>MQL (marketing-qualified lead)</dt>
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
      </details>
    </section>
  );
}
