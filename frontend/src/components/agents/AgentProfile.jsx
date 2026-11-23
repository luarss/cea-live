import { useAgentProfile } from '../../hooks/useAnalytics';
import VolumeChart from '../visualizations/VolumeChart';
import TownLine from '../visualizations/TownLine';
import BarList from '../visualizations/BarList';
import PropertyChip from '../ui/PropertyChip';
import { ArrowLeftIcon } from '../ui/Icons';
import {
  formatNumber,
  formatPeriod,
  propertyType,
  representationLabel,
  titleCase,
  toIsoPeriod,
  transactionLabel,
} from '../../lib/format';

function toBarItems(entries, key) {
  return entries.map(entry => ({ name: entry[key], count: entry.count, percentage: entry.percentage }));
}

function Section({ title, children }) {
  return (
    <section className="pt-5 mt-5 border-t border-rule">
      <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink-soft mb-4">{title}</h3>
      {children}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading salesperson record">
      <div className="h-7 w-2/3 bg-wash" />
      <div className="h-4 w-1/3 bg-wash mt-3" />
      <div className="h-16 bg-wash mt-6" />
      <div className="h-48 bg-wash mt-6" />
    </div>
  );
}

export default function AgentProfile({ datasetId, regNum, filters, marketInsights, onClose }) {
  const { data: profile, loading, error } = useAgentProfile(datasetId, regNum, filters);
  const hasActiveFilters = Object.values(filters || {}).some(values => values?.length > 0);

  if (!regNum) {
    return (
      <p className="text-ink-muted">
        Pick a salesperson from the list to see their full record.
      </p>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-lg font-bold">Couldn’t load this record</h2>
        <p className="text-ink-soft mt-1 text-sm">{error}. Pick the salesperson again, or reload the page.</p>
      </div>
    );
  }

  if (loading && profile?.agent?.regNum !== regNum) {
    return <ProfileSkeleton />;
  }

  if (!profile) return null;

  const dominantType = profile.propertyTypes[0]?.type;
  const lineColor = propertyType(dominantType).color;
  const dominantPrivateType = profile.propertyTypes.find(entry => entry.type !== 'HDB')?.type;
  const districtColor = propertyType(dominantPrivateType || 'CONDOMINIUM_APARTMENTS').color;
  const marketTotal = marketInsights?.summary?.totalTransactions;
  const latestPeriod = toIsoPeriod(marketInsights?.summary?.dateRange?.end);
  const shareOfMarket = marketTotal ? (profile.agent.totalTransactions / marketTotal) * 100 : null;
  const marketPropertyMix = marketInsights?.distributions?.propertyTypes;
  const topRepresentation = profile.representation[0];
  const topTransaction = profile.transactionTypes[0];

  return (
    <article aria-labelledby="agent-name">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to list
        </button>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="agent-name" className="text-2xl font-bold leading-tight text-balance">{titleCase(profile.agent.name)}</h2>
          <p className="text-sm text-ink-muted mt-1 tabular">
            {profile.agent.regNum} · active {formatPeriod(profile.dateRange.start)} – {formatPeriod(profile.dateRange.end)}
          </p>
          {hasActiveFilters && (
            <p className="text-xs font-semibold text-ink-soft mt-1">Showing only deals that match your filters</p>
          )}
        </div>
        {dominantType && <PropertyChip value={dominantType} size="lg" />}
      </div>

      <dl className="grid grid-cols-2 mt-5 border-y border-ink">
        <div className="py-3 pr-4">
          <dt className="text-xs text-ink-muted">Recorded transactions</dt>
          <dd className="text-2xl font-bold tabular">{formatNumber(profile.agent.totalTransactions)}</dd>
          {shareOfMarket !== null && (
            <dd className="text-xs text-ink-muted tabular">{shareOfMarket.toFixed(2)}% of all recorded deals</dd>
          )}
        </div>
        <div className="py-3 pl-4 border-l border-rule">
          <dt className="text-xs text-ink-muted">Usually</dt>
          <dd className="font-semibold leading-snug mt-1">
            {topTransaction ? transactionLabel(topTransaction.type) : '–'}
            {topRepresentation && <>, for the {representationLabel(topRepresentation.type).toLowerCase()}</>}
          </dd>
          {topRepresentation && (
            <dd className="text-xs text-ink-muted tabular">{topRepresentation.percentage}% of their deals</dd>
          )}
        </div>
      </dl>

      <Section title="Where they work">
        <TownLine towns={profile.topTowns} color={lineColor} townColor={propertyType('HDB').color} districtColor={districtColor} />
      </Section>

      <Section title="Transactions per month">
        <VolumeChart series={profile.monthlyActivity} latestPeriod={latestPeriod} color={lineColor} height={140} />
      </Section>

      <Section title="Property mix vs the market">
        <BarList
          items={toBarItems(profile.propertyTypes, 'type')}
          compareTo={marketPropertyMix}
          renderLabel={name => propertyType(name).label}
          colorFor={name => propertyType(name).color}
        />
      </Section>

      <Section title="Acting for">
        <BarList items={toBarItems(profile.representation, 'type')} renderLabel={representationLabel} />
      </Section>

      <Section title="Deal type">
        <BarList items={toBarItems(profile.transactionTypes, 'type')} renderLabel={transactionLabel} />
      </Section>
    </article>
  );
}
