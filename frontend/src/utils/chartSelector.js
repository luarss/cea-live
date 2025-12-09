/**
 * Select optimal chart type based on column properties
 */
export function selectChartType(column, dataset) {
  const { type, stats } = column;
  const { schema } = dataset;
  const rowCount = dataset.data?.length || 0;

  if (type === 'numeric') {
    // Time series if temporal column exists
    if (schema.temporalColumn) {
      return 'line';
    }

    // High cardinality -> histogram
    const cardinality = stats.unique / rowCount;
    if (cardinality > 0.5) {
      return 'histogram';
    }

    // Default to bar for aggregated values
    return 'bar';
  }

  if (type === 'categorical') {
    // Low cardinality -> pie chart
    if (stats.unique <= 8) {
      return 'pie';
    }

    // Otherwise bar chart
    return 'bar';
  }

  if (type === 'datetime') {
    return 'timeline';
  }

  return 'table';
}

/**
 * Get chart configuration based on recommendation
 */
export function getChartConfig(recommendation, dataset) {
  const { type, config } = recommendation;

  const baseConfig = {
    type,
    ...config,
    responsive: true,
    maintainAspectRatio: false
  };

  // Add specific configurations based on chart type
  if (type === 'line' || type === 'bar') {
    baseConfig.legend = {
      display: true,
      position: 'top'
    };
  }

  if (type === 'pie') {
    baseConfig.legend = {
      display: true,
      position: 'right'
    };
  }

  return baseConfig;
}

/**
 * Prepare data for a specific chart type
 */
export function prepareChartData(recommendation, dataset) {
  const { type, config } = recommendation;
  const { data } = dataset;

  if (!data || data.length === 0) {
    return [];
  }

  switch (type) {
    case 'line':
    case 'bar':
      return data.map(row => ({
        x: row[config.xAxis],
        y: row[config.yAxis],
        ...(config.groupBy && { category: row[config.groupBy] })
      }));

    case 'pie':
      // Aggregate by category
      const counts = {};
      data.forEach(row => {
        const category = row[config.category];
        counts[category] = (counts[category] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({
        name,
        value
      }));

    case 'scatter':
      return data.map(row => ({
        x: row[config.xAxis],
        y: row[config.yAxis]
      }));

    case 'table':
    default:
      return data;
  }
}
