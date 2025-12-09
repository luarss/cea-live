import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ScatterPlotComponent({ data, config }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No data available for visualization
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          dataKey="x"
          name={config.xAxis}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={config.yAxis}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px'
          }}
        />
        <Scatter
          name={`${config.yAxis} vs ${config.xAxis}`}
          data={data}
          fill="#0ea5e9"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
