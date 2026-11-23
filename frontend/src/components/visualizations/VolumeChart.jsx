import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fillMonths, formatNumber, formatPeriod, markProvisional, niceAxisTicks } from '../../lib/format';

function VolumeTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="bg-ink text-white px-3 py-2 text-sm shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
      <div className="font-semibold">{formatPeriod(point.period)}</div>
      <div className="tabular">{formatNumber(point.count)} transactions</div>
      {point.provisional && <div className="text-signal text-xs mt-0.5">Provisional: still being reported</div>}
    </div>
  );
}

function formatAxisValue(value) {
  if (value < 1000) return value;
  const thousands = value / 1000;
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
}

function yearTick(period) {
  return period.endsWith('-01') ? period.slice(0, 4) : '';
}

export default function VolumeChart({ series, latestPeriod, color = '#1a1a1a', height = 240 }) {
  if (!series || series.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-ink-muted bg-wash" style={{ height }}>
        No transactions match these filters.
      </div>
    );
  }

  const data = markProvisional(fillMonths(series, latestPeriod), latestPeriod);
  const showYearTicks = data.length > 24;
  const yTicks = niceAxisTicks(Math.max(...data.map(point => point.count)));

  return (
    <ResponsiveContainer width="100%" height={height} minWidth={0} initialDimension={{ width: 320, height }}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap="8%">
        <CartesianGrid vertical={false} stroke="#e3e3e0" />
        <XAxis
          dataKey="period"
          tickFormatter={showYearTicks ? yearTick : formatPeriod}
          interval={showYearTicks ? 0 : 'preserveStartEnd'}
          tick={{ fill: '#6b6b6b', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: '#1a1a1a' }}
          minTickGap={showYearTicks ? 0 : 24}
        />
        <YAxis
          width={44}
          ticks={yTicks}
          domain={[0, yTicks[yTicks.length - 1]]}
          tickFormatter={formatAxisValue}
          tick={{ fill: '#6b6b6b', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'rgba(250, 158, 13, 0.18)' }} isAnimationActive={false} />
        <Bar dataKey="count" isAnimationActive={false}>
          {data.map(point => (
            <Cell key={point.period} fill={point.provisional ? '#c9c9c5' : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
