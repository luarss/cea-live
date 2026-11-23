import { formatLocation, formatNumber, formatPercent, isDistrict } from '../../lib/format';

const STOP_SPACING = 38;

export default function TownLine({ towns, color, townColor, districtColor }) {
  if (!towns || towns.length === 0) {
    return <p className="text-sm text-ink-muted">No town or district recorded for these transactions.</p>;
  }

  const lineHeight = (towns.length - 1) * STOP_SPACING;

  return (
    <ol className="relative" style={{ height: lineHeight + 24 }}>
      <span
        className="absolute left-[10px] top-3 w-2.5 rounded-full"
        style={{ height: lineHeight, backgroundColor: color }}
        aria-hidden="true"
      />
      {towns.map((town, index) => {
        const stopColor = isDistrict(town.town) ? districtColor || color : townColor || color;
        return (
          <li
            key={town.town}
            className="absolute left-0 right-0 flex items-center gap-4"
            style={{ top: index * STOP_SPACING }}
          >
            <span
              className="relative z-10 w-[30px] h-[18px] shrink-0 rounded-full bg-white border-[3px]"
              style={{ borderColor: stopColor }}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0 font-semibold whitespace-nowrap" title={formatLocation(town.town, { full: true })}>
              {formatLocation(town.town)}
            </span>
            <span className="tabular text-sm whitespace-nowrap">
              {formatNumber(town.count)}
              <span className="text-ink-muted ml-2 inline-block w-12 text-right">{formatPercent(town.percentage)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
