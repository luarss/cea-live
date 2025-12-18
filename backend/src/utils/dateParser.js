/**
 * Date parsing utilities for CEA transaction data
 * Handles "MMM-YYYY" format (e.g., "OCT-2017", "JAN-2025")
 */

const MONTH_MAP = {
  'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
  'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
  'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
};

/**
 * Parse transaction date string to ISO format
 * @param {string} dateStr - Date in "MMM-YYYY" format
 * @returns {string} ISO date string "YYYY-MM-DD"
 */
export function parseTransactionDate(dateStr) {
  if (!dateStr || dateStr === '-') return null;

  const [month, year] = dateStr.split('-');
  const monthNum = MONTH_MAP[month];

  if (!monthNum || !year) return null;

  return `${year}-${monthNum}-01`;
}

/**
 * Group data by time period
 * @param {Array} data - Array of records with transaction_date field
 * @param {string} period - "month" or "year"
 * @param {string} groupByField - Optional field to group by (e.g., "property_type")
 * @returns {Object} Grouped data by period
 */
export function groupByPeriod(data, period = 'month', groupByField = null) {
  const grouped = {};

  data.forEach(record => {
    const isoDate = parseTransactionDate(record.transaction_date);
    if (!isoDate) return;

    // Extract period key
    let periodKey;
    if (period === 'year') {
      periodKey = isoDate.substring(0, 4); // "YYYY"
    } else {
      periodKey = isoDate.substring(0, 7); // "YYYY-MM"
    }

    if (!grouped[periodKey]) {
      grouped[periodKey] = groupByField ? {} : 0;
    }

    if (groupByField) {
      const groupValue = record[groupByField] || 'Unknown';
      grouped[periodKey][groupValue] = (grouped[periodKey][groupValue] || 0) + 1;
    } else {
      grouped[periodKey]++;
    }
  });

  return grouped;
}

/**
 * Sort period keys chronologically
 * @param {Array<string>} periodKeys - Array of period keys ("YYYY-MM" or "YYYY")
 * @returns {Array<string>} Sorted period keys
 */
export function sortPeriods(periodKeys) {
  return periodKeys.sort((a, b) => a.localeCompare(b));
}

/**
 * Format period key for display
 * @param {string} periodKey - Period key ("YYYY-MM" or "YYYY")
 * @param {string} period - "month" or "year"
 * @returns {string} Formatted period string
 */
export function formatPeriod(periodKey, period) {
  if (period === 'year') {
    return periodKey;
  }

  const [year, month] = periodKey.split('-');
  const monthName = Object.keys(MONTH_MAP).find(key => MONTH_MAP[key] === month);
  return `${monthName} ${year}`;
}

/**
 * Get date range from data
 * @param {Array} data - Array of records with transaction_date field
 * @returns {Object} { start: "JAN-2017", end: "APR-2025" }
 */
export function getDateRange(data) {
  if (!data || data.length === 0) {
    return { start: null, end: null };
  }

  // Get unique dates and count them
  const dateCounts = {};
  data.forEach(record => {
    const date = record.transaction_date;
    if (date && date !== '-') {
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    }
  });

  // Parse and sort dates
  const sortedDates = Object.keys(dateCounts)
    .map(dateStr => ({ original: dateStr, iso: parseTransactionDate(dateStr) }))
    .filter(d => d.iso !== null)
    .sort((a, b) => a.iso.localeCompare(b.iso));

  if (sortedDates.length === 0) {
    return { start: null, end: null };
  }

  return {
    start: sortedDates[0].original,
    end: sortedDates[sortedDates.length - 1].original
  };
}
