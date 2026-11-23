import { useState } from 'react';
import { formatLocation, formatNumber, formatPercent, isDistrict } from '../../lib/format';
import { ISLAND_PATHS, MAP_HEIGHT, MAP_WIDTH, locationPoint } from '../../lib/geography';

const MIN_RADIUS = 8;
const MAX_RADIUS = 17;
const RING_WIDTH = 3;
const MARKER_GAP = 1.5;
const SEPARATION_PASSES = 80;
const INK = '#1a1a1a';
const PAPER = '#ffffff';
const ISLAND_FILL = '#f5f5f3';
const ISLAND_STROKE = '#e3e3e0';

function markerRadius(count, maxCount) {
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(count / maxCount);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function separateMarkers(markers) {
  const positions = markers.map(marker => ({ ...marker, x: marker.point.x, y: marker.point.y }));
  for (let pass = 0; pass < SEPARATION_PASSES; pass += 1) {
    let moved = false;
    for (let first = 0; first < positions.length; first += 1) {
      for (let second = first + 1; second < positions.length; second += 1) {
        const a = positions[first];
        const b = positions[second];
        const deltaX = b.x - a.x || 0.01 * (second - first);
        const deltaY = b.y - a.y;
        const distance = Math.hypot(deltaX, deltaY);
        const required = a.radius + b.radius + MARKER_GAP;
        if (distance >= required) continue;
        const push = (required - distance) / 2;
        const unitX = deltaX / distance;
        const unitY = deltaY / distance;
        a.x -= unitX * push;
        a.y -= unitY * push;
        b.x += unitX * push;
        b.y += unitY * push;
        moved = true;
      }
    }
    positions.forEach(marker => {
      marker.x = clamp(marker.x, marker.radius, MAP_WIDTH - marker.radius);
      marker.y = clamp(marker.y, marker.radius, MAP_HEIGHT - marker.radius);
    });
    if (!moved) break;
  }
  return positions;
}

function StationMarker({ marker, active, dimmed, onHover }) {
  return (
    <g
      onMouseEnter={() => onHover(marker.town)}
      onMouseLeave={() => onHover(null)}
      style={{ opacity: dimmed ? 0.3 : 1, transition: 'opacity 150ms' }}
    >
      <title>{`${formatLocation(marker.town, { full: true })}: ${formatNumber(marker.count)}`}</title>
      <circle
        cx={marker.x}
        cy={marker.y}
        r={marker.radius - RING_WIDTH / 2}
        fill={active ? marker.color : PAPER}
        stroke={marker.color}
        strokeWidth={RING_WIDTH}
        style={{ transition: 'fill 150ms' }}
      />
      <text
        x={marker.x}
        y={marker.y}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-bold tabular pointer-events-none"
        style={{ fontSize: 11, fill: active ? PAPER : INK, transition: 'fill 150ms' }}
      >
        {marker.rank}
      </text>
    </g>
  );
}

function RankBadge({ stop, active }) {
  return (
    <span
      className="w-6 h-6 shrink-0 rounded-full border-[3px] grid place-items-center text-[11px] font-bold tabular transition-colors duration-150"
      style={{
        borderColor: stop.color,
        backgroundColor: active ? stop.color : PAPER,
        color: active ? PAPER : INK,
        opacity: stop.point ? 1 : 0.5,
      }}
      aria-hidden="true"
    >
      {stop.rank}
    </span>
  );
}

function TownRow({ stop, active, onHover }) {
  return (
    <li
      onMouseEnter={() => onHover(stop.town)}
      onMouseLeave={() => onHover(null)}
      className={`flex items-center gap-3 py-1.5 transition-colors duration-150 ${active ? 'bg-wash' : ''}`}
    >
      <RankBadge stop={stop} active={active} />
      <span className="flex-1 min-w-0 font-semibold truncate" title={formatLocation(stop.town, { full: true })}>
        {formatLocation(stop.town)}
      </span>
      <span className="tabular text-sm whitespace-nowrap">
        {formatNumber(stop.count)}
        <span className="text-ink-muted ml-2 inline-block w-12 text-right">{formatPercent(stop.percentage)}</span>
      </span>
    </li>
  );
}

export default function TownMap({ towns, townColor, districtColor }) {
  const [hoveredTown, setHoveredTown] = useState(null);

  if (!towns || towns.length === 0) {
    return <p className="text-sm text-ink-muted">No town or district recorded for these transactions.</p>;
  }

  const maxCount = Math.max(...towns.map(town => town.count));
  const stops = towns.map((town, index) => ({
    ...town,
    rank: index + 1,
    color: isDistrict(town.town) ? districtColor : townColor,
    point: locationPoint(town.town),
    radius: markerRadius(town.count, maxCount),
  }));
  const markers = separateMarkers(stops.filter(stop => stop.point));
  const drawOrder = [...markers].sort((first, second) => second.rank - first.rank);

  return (
    <div>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label="Map of Singapore showing where these transactions took place"
      >
        {ISLAND_PATHS.map(path => (
          <path key={path} d={path} fill={ISLAND_FILL} stroke={ISLAND_STROKE} strokeWidth={1} strokeLinejoin="round" />
        ))}
        {drawOrder.map(marker => (
          <StationMarker
            key={marker.town}
            marker={marker}
            active={marker.town === hoveredTown}
            dimmed={hoveredTown !== null && marker.town !== hoveredTown}
            onHover={setHoveredTown}
          />
        ))}
      </svg>
      <ol className="mt-4">
        {stops.map(stop => (
          <TownRow key={stop.town} stop={stop} active={stop.town === hoveredTown} onHover={setHoveredTown} />
        ))}
      </ol>
    </div>
  );
}
