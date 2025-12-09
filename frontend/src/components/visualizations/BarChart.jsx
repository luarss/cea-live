import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function BarChartComponent({ data, config }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No data available for visualization
      </div>
    );
  }

  // Aggregate data if needed
  const aggregatedData = config.aggregate ? aggregateData(data, config) : data;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={aggregatedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="x"
          tick={{ fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px'
          }}
        />
        <Legend />
        <Bar
          dataKey="y"
          fill="#0ea5e9"
          name={config.yAxis}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function aggregateData(data, config) {
  const groups = {};

  data.forEach(item => {
    const key = item.x;
    if (!groups[key]) {
      groups[key] = { x: key, values: [] };
    }
    groups[key].values.push(item.y);
  });

  return Object.values(groups).map(group => ({
    x: group.x,
    y: config.aggregate === 'mean'
      ? group.values.reduce((a, b) => a + b, 0) / group.values.length
      : group.values.reduce((a, b) => a + b, 0)
  }));
}
