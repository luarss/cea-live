import React from 'react';
import DataTable from './DataTable';

export default function ChartRenderer({ recommendation, dataset }) {
  if (!recommendation || !dataset) {
    return (
      <div className="text-center py-12 text-gray-500">
        No visualization available
      </div>
    );
  }

  const { type, config, reasoning } = recommendation;

  // Only support table visualization now
  if (type !== 'table') {
    return (
      <div className="text-center py-12 text-gray-500">
        Unsupported chart type: {type}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart Title and Reasoning */}
      <div>
        <h4 className="text-md font-semibold text-gray-800">{config.title}</h4>
        {reasoning && (
          <p className="text-sm text-gray-500 mt-1">{reasoning}</p>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-50 rounded-lg p-4">
        <DataTable data={dataset.data} schema={dataset.schema} />
      </div>
    </div>
  );
}
