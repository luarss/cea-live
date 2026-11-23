import { formatNumber, formatPercent } from '../../lib/format';

export default function BarList({ items, renderLabel, colorFor, compareTo }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-ink-muted py-4">No transactions match these filters.</p>;
  }

  const compareByName = new Map((compareTo || []).map(item => [item.name, item.percentage]));
  const maxPercentage = Math.max(
    ...items.map(item => item.percentage),
    ...(compareTo || []).map(item => item.percentage),
    1
  );

  return (
    <ul className="space-y-3">
      {items.map(item => {
        const color = colorFor ? colorFor(item.name) : '#1a1a1a';
        const marketPercentage = compareByName.get(item.name);

        return (
          <li key={item.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{renderLabel ? renderLabel(item.name) : item.name}</span>
              <span className="tabular whitespace-nowrap">
                <span className="font-semibold">{formatPercent(item.percentage)}</span>
                {item.count !== undefined && (
                  <span className="text-ink-muted ml-2">{formatNumber(item.count)}</span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-2 bg-wash" aria-hidden="true">
              <div className="h-full" style={{ width: `${(item.percentage / maxPercentage) * 100}%`, backgroundColor: color }} />
            </div>
            {marketPercentage !== undefined && (
              <div className="mt-1 flex items-center gap-2" aria-hidden="true">
                <div className="flex-1 h-1 bg-wash">
                  <div className="h-full bg-[#b5b5b0]" style={{ width: `${(marketPercentage / maxPercentage) * 100}%` }} />
                </div>
                <span className="text-[11px] text-ink-muted tabular w-16 text-right">market {formatPercent(marketPercentage, 0)}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
