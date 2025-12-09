export function analyzeSchema(data) {
  if (!data || data.length === 0) {
    return { columns: [], temporalColumn: null };
  }

  const columns = [];
  const sampleRow = data[0];
  const columnNames = Object.keys(sampleRow).filter(key => key !== '_id');

  for (const columnName of columnNames) {
    const columnData = data.map(row => row[columnName]).filter(val => val !== null && val !== undefined && val !== '');

    if (columnData.length === 0) {
      continue;
    }

    const column = {
      name: columnName,
      type: inferType(columnData),
      stats: calculateStats(columnData, columnName)
    };

    columns.push(column);
  }

  // Try to identify temporal column
  const temporalColumn = columns.find(col =>
    col.name.toLowerCase().includes('date') ||
    col.name.toLowerCase().includes('time') ||
    col.name.toLowerCase().includes('year')
  );

  return {
    columns,
    temporalColumn: temporalColumn ? temporalColumn.name : null
  };
}

function inferType(values) {
  const sample = values.slice(0, 100);

  let numericCount = 0;
  let textCount = 0;

  for (const val of sample) {
    const num = Number(val);
    if (!isNaN(num) && val !== '' && val !== null) {
      numericCount++;
    } else if (typeof val === 'string') {
      textCount++;
    }
  }

  return numericCount > textCount ? 'numeric' : 'text';
}

function calculateStats(values, columnName) {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  const uniqueValues = new Set(nonNullValues);

  const stats = {
    count: nonNullValues.length,
    nullCount: values.length - nonNullValues.length,
    unique: uniqueValues.size
  };

  // Try numeric statistics
  const numericValues = nonNullValues.map(v => Number(v)).filter(n => !isNaN(n));

  if (numericValues.length > nonNullValues.length * 0.8) {
    // Mostly numeric
    numericValues.sort((a, b) => a - b);

    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / numericValues.length;

    const median = numericValues.length % 2 === 0
      ? (numericValues[numericValues.length / 2 - 1] + numericValues[numericValues.length / 2]) / 2
      : numericValues[Math.floor(numericValues.length / 2)];

    const squaredDiffs = numericValues.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / numericValues.length;
    const stdDev = Math.sqrt(variance);

    stats.min = numericValues[0];
    stats.max = numericValues[numericValues.length - 1];
    stats.mean = mean;
    stats.median = median;
    stats.stdDev = stdDev;
    stats.sum = sum;
  }

  return stats;
}
