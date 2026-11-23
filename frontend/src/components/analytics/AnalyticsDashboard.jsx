import { useTimeSeriesData } from '../../hooks/useAnalytics';
import VolumeChart from '../visualizations/VolumeChart';
import BarList from '../visualizations/BarList';
import {
  formatNumber,
  formatSignedPercent,
  propertyType,
  representationLabel,
  transactionLabel,
  twelveMonthChange,
} from '../../lib/format';

function Figure({ label, value }) {
  return (
    <div className="py-4 pr-6 sm:border-r sm:border-rule last:border-r-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-[28px] leading-tight font-bold tabular mt-0.5">{value}</dd>
    </div>
  );
}

function Breakdown({ title, children }) {
  return (
    <section>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink-soft pb-2 mb-4 border-b-2 border-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function AnalyticsDashboard({ datasetId, filters, insights, insightsError, isUpdating }) {
  const { data: timeSeriesData } = useTimeSeriesData(datasetId, 'month', null, filters);
  const series = timeSeriesData?.series || [];
  const change = twelveMonthChange(series);

  if (!insights) {
    return insightsError ? (
      <p className="py-10 text-ink-soft">Couldn’t load market figures ({insightsError}). Check your connection and reload.</p>
    ) : (
      <div className="animate-pulse space-y-6" aria-label="Loading market figures">
        <div className="h-24 bg-wash" />
        <div className="h-64 bg-wash" />
      </div>
    );
  }

  const { summary, trends, distributions } = insights;

  return (
    <div className={`space-y-12 transition-opacity duration-200 ${isUpdating ? 'opacity-60' : ''}`}>
      <section aria-labelledby="market-heading">
        <h1 id="market-heading" className="text-2xl font-bold">Residential market</h1>

        <dl className="grid grid-cols-1 sm:grid-cols-3 mt-4 border-y border-ink">
          <Figure label="Recorded transactions" value={formatNumber(summary.totalTransactions)} />
          <Figure label="Per month, on average" value={formatNumber(trends.monthlyAverage)} />
          <Figure
            label="Last 12 months vs the 12 before"
            value={change ? formatSignedPercent(change.percent) : '–'}
          />
        </dl>
      </section>

      <section aria-labelledby="volume-heading">
        <h2 id="volume-heading" className="text-lg font-bold mb-3">Transactions per month</h2>
        <VolumeChart series={series} height={260} />
      </section>

      <div className="grid gap-10 md:grid-cols-3">
        <Breakdown title="Property">
          <BarList
            items={distributions.propertyTypes}
            renderLabel={name => propertyType(name).label}
            colorFor={name => propertyType(name).color}
          />
        </Breakdown>
        <Breakdown title="Deal type">
          <BarList items={distributions.transactionTypes} renderLabel={transactionLabel} />
        </Breakdown>
        <Breakdown title="Salesperson acting for">
          <BarList items={distributions.represented} renderLabel={representationLabel} />
        </Breakdown>
      </div>
    </div>
  );
}
