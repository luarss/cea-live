export function generateVisualizationRecommendations(schema, data) {
  const recommendations = [];
  const numericColumns = schema.columns.filter(col => col.type === 'numeric');
  const textColumns = schema.columns.filter(col => col.type === 'text');

  // Always add table view
  recommendations.push({
    type: 'table',
    priority: 1,
    config: {
      columns: schema.columns.map(col => col.name),
      title: 'Data Table'
    },
    reasoning: 'Detailed view of all data'
  });

  // Scatter plots for numeric columns
  for (let i = 0; i < numericColumns.length && i < 3; i++) {
    for (let j = i + 1; j < numericColumns.length && j < 4; j++) {
      recommendations.push({
        type: 'scatter',
        priority: 4,
        config: {
          xAxis: numericColumns[i].name,
          yAxis: numericColumns[j].name,
          title: `${numericColumns[j].name} vs ${numericColumns[i].name}`
        },
        reasoning: 'Two numeric columns - useful for correlation analysis'
      });
    }
  }

  // Bar charts for text columns with reasonable cardinality
  for (const textCol of textColumns) {
    if (textCol.stats.unique > 1 && textCol.stats.unique <= 50) {
      recommendations.push({
        type: 'bar',
        priority: 3,
        config: {
          xAxis: textCol.name,
          yAxis: 'count',
          title: `Distribution of ${textCol.name}`
        },
        reasoning: 'Categorical data with reasonable number of categories'
      });
    }
  }

  // Pie charts for low-cardinality categorical data
  for (const textCol of textColumns) {
    if (textCol.stats.unique > 1 && textCol.stats.unique <= 10) {
      recommendations.push({
        type: 'pie',
        priority: 2,
        config: {
          categoryColumn: textCol.name,
          valueColumn: 'count',
          title: `${textCol.name} Distribution`
        },
        reasoning: 'Low-cardinality categorical data'
      });
    }
  }

  // Sort by priority (higher = more important) and limit
  recommendations.sort((a, b) => b.priority - a.priority);

  // Ensure we have at least one visualization besides table
  if (recommendations.length === 1) {
    // Add a simple bar chart of first text column if available
    if (textColumns.length > 0) {
      recommendations.unshift({
        type: 'bar',
        priority: 3,
        config: {
          xAxis: textColumns[0].name,
          yAxis: 'count',
          title: `Distribution of ${textColumns[0].name}`
        },
        reasoning: 'Basic categorical distribution'
      });
    }
  }

  return recommendations.slice(0, 6); // Limit to 6 visualizations
}
