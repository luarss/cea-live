import React from 'react';

export default function StatsSummary({ schema, metadata }) {
  const { columns } = schema;

  const typeColors = {
    numeric: 'bg-blue-100 text-blue-800',
    datetime: 'bg-purple-100 text-purple-800',
    categorical: 'bg-green-100 text-green-800',
    text: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Schema Overview</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Column
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statistics
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {columns.map((column, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {column.name}
                  {schema.temporalColumn === column.name && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Temporal
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[column.type] || typeColors.text}`}>
                    {column.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <ColumnStats stats={column.stats} type={column.type} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnStats({ stats, type }) {
  if (!stats) return null;

  if (type === 'numeric') {
    return (
      <div className="space-y-1">
        <div>Range: {stats.min?.toFixed(2)} - {stats.max?.toFixed(2)}</div>
        <div>Mean: {stats.mean?.toFixed(2)} (σ: {stats.stdDev?.toFixed(2)})</div>
        <div className="text-xs text-gray-500">{stats.unique} unique values</div>
      </div>
    );
  }

  if (type === 'datetime') {
    return (
      <div className="space-y-1">
        <div className="text-xs">{stats.min} to {stats.max}</div>
        <div className="text-xs text-gray-500">{stats.unique} unique dates</div>
      </div>
    );
  }

  if (type === 'categorical' && stats.topValues) {
    return (
      <div className="space-y-1">
        <div className="text-xs">Top: {stats.topValues.slice(0, 3).map(v => v.value).join(', ')}</div>
        <div className="text-xs text-gray-500">{stats.unique} categories</div>
      </div>
    );
  }

  return (
    <div className="text-xs text-gray-500">
      {stats.unique} unique values
    </div>
  );
}
