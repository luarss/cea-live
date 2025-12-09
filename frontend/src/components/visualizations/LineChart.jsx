import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function LineChartComponent({ data, config }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No data available for visualization
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="x"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => {
            // Format dates if they look like ISO strings
            if (typeof value === 'string' && value.includes('T')) {
              return new Date(value).toLocaleDateString();
            }
            return value;
          }}
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
        <Line
          type="monotone"
          dataKey="y"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={{ fill: '#0ea5e9', r: 3 }}
          activeDot={{ r: 5 }}
          name={config.yAxis}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
