export const PROPERTY_TYPES = [
  { value: 'HDB', label: 'HDB', code: 'HDB', color: '#007a3d' },
  { value: 'CONDOMINIUM_APARTMENTS', label: 'Condo / apartment', code: 'CONDO', color: '#d42e12' },
  { value: 'LANDED', label: 'Landed', code: 'LANDED', color: '#9d5b25' },
  { value: 'EXECUTIVE_CONDOMINIUM', label: 'Executive condo', code: 'EC', color: '#9900aa' },
  { value: 'STRATA_LANDED', label: 'Strata landed', code: 'STRATA', color: '#005ec4' },
];

export const TRANSACTION_TYPES = [
  { value: 'RESALE', label: 'Resale' },
  { value: 'NEW SALE', label: 'New sale' },
  { value: 'SUB-SALE', label: 'Sub-sale' },
  { value: 'WHOLE RENTAL', label: 'Whole rental' },
  { value: 'ROOM RENTAL', label: 'Room rental' },
];

export const REPRESENTATION_TYPES = [
  { value: 'BUYER', label: 'Buyer' },
  { value: 'SELLER', label: 'Seller' },
  { value: 'TENANT', label: 'Tenant' },
  { value: 'LANDLORD', label: 'Landlord' },
];

const FALLBACK_PROPERTY = { label: 'Other', code: 'OTHER', color: '#4a4a4a' };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const UPPERCASE_TOKENS = new Set(['S/O', 'D/O', 'II', 'III', 'IV']);

export const PROVISIONAL_MONTHS = 2;

export function propertyType(value) {
  return PROPERTY_TYPES.find(type => type.value === value) || { ...FALLBACK_PROPERTY, value, label: titleCase(value) };
}

export function transactionLabel(value) {
  return TRANSACTION_TYPES.find(type => type.value === value)?.label || titleCase(value);
}

export function representationLabel(value) {
  return REPRESENTATION_TYPES.find(type => type.value === value)?.label || titleCase(value);
}

export function titleCase(text) {
  if (!text) return '';
  return String(text)
    .split(' ')
    .map(word => {
      if (UPPERCASE_TOKENS.has(word.toUpperCase())) return word.toUpperCase();
      return word
        .toLowerCase()
        .replace(/(^|[-'(/])([a-z])/g, (_, separator, letter) => separator + letter.toUpperCase());
    })
    .join(' ');
}

const DISTRICT_PATTERN = /^D(\d+)\s+(.*)$/;

export function isDistrict(location) {
  return DISTRICT_PATTERN.test(location || '');
}

export function formatLocation(location, { full = false } = {}) {
  if (!location) return '';
  const districtMatch = DISTRICT_PATTERN.exec(location);
  if (!districtMatch) return titleCase(location);
  const localities = districtMatch[2].split('/').map(locality => locality.trim()).filter(Boolean);
  return `D${districtMatch[1]} · ${full ? localities.join(' / ') : localities[0]}`;
}

export function formatSignedPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

export function niceAxisTicks(maxValue, targetCount = 5) {
  if (!maxValue || maxValue <= 0) return [0];
  const roughStep = maxValue / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].map(multiplier => multiplier * magnitude).find(candidate => candidate >= roughStep);
  const ticks = [0];
  while (ticks[ticks.length - 1] < maxValue) {
    ticks.push(ticks[ticks.length - 1] + step);
  }
  return ticks;
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return Number(value).toLocaleString('en-SG');
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatPeriod(period) {
  if (!period) return '';
  const isoMatch = /^(\d{4})-(\d{2})$/.exec(period);
  if (isoMatch) return `${MONTH_NAMES[Number(isoMatch[2]) - 1]} ${isoMatch[1]}`;
  const ceaMatch = /^([A-Z]{3})-(\d{4})$/i.exec(period);
  if (ceaMatch) return `${titleCase(ceaMatch[1])} ${ceaMatch[2]}`;
  return period;
}

export function formatShortPeriod(period) {
  const isoMatch = /^(\d{4})-(\d{2})$/.exec(period || '');
  if (!isoMatch) return period;
  return `${MONTH_NAMES[Number(isoMatch[2]) - 1]} ’${isoMatch[1].slice(2)}`;
}

export function toIsoPeriod(period) {
  if (!period) return null;
  if (/^\d{4}-\d{2}$/.test(period)) return period;
  const ceaMatch = /^([A-Z]{3})-(\d{4})$/i.exec(period);
  if (!ceaMatch) return null;
  const monthIndex = MONTH_NAMES.findIndex(name => name.toLowerCase() === ceaMatch[1].toLowerCase());
  return `${ceaMatch[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function shiftMonth(isoPeriod, offset) {
  const [year, month] = isoPeriod.split('-').map(Number);
  const totalMonths = year * 12 + (month - 1) + offset;
  return `${Math.floor(totalMonths / 12)}-${String((totalMonths % 12) + 1).padStart(2, '0')}`;
}

export function fillMonths(series, endPeriod) {
  if (!series || series.length === 0) return [];
  const countByPeriod = new Map(series.map(point => [point.period, point.count]));
  const lastPeriod = endPeriod && endPeriod > series[series.length - 1].period ? endPeriod : series[series.length - 1].period;
  const filled = [];
  for (let period = series[0].period; period <= lastPeriod; period = shiftMonth(period, 1)) {
    filled.push({ period, count: countByPeriod.get(period) || 0 });
  }
  return filled;
}

export function markProvisional(series, latestPeriod) {
  const datasetEnd = latestPeriod || series[series.length - 1]?.period;
  const firstProvisional = datasetEnd ? shiftMonth(datasetEnd, 1 - PROVISIONAL_MONTHS) : null;
  return series.map(point => ({
    ...point,
    provisional: Boolean(firstProvisional) && point.period >= firstProvisional,
  }));
}

export function twelveMonthChange(series) {
  const settled = series.slice(0, Math.max(0, series.length - PROVISIONAL_MONTHS));
  if (settled.length < 24) return null;
  const sum = points => points.reduce((total, point) => total + point.count, 0);
  const recent = sum(settled.slice(-12));
  const previous = sum(settled.slice(-24, -12));
  if (!previous) return null;
  return {
    percent: ((recent - previous) / previous) * 100,
    recent,
    previous,
    through: settled[settled.length - 1].period,
  };
}
