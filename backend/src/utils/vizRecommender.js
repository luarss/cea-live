export function generateVisualizationRecommendations(schema, data) {
  // Only return table visualization
  return [{
    type: 'table',
    priority: 1,
    config: {
      columns: schema.columns.map(col => col.name),
      title: 'Data Table'
    },
    reasoning: 'Detailed view of all data'
  }];
}
