import React from 'react';

export default function Sidebar({ catalog, selectedDataset, onDatasetSelect }) {
  const datasets = catalog?.datasets || [];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Datasets</h2>
        <p className="text-xs text-gray-500">
          {datasets.length} {datasets.length === 1 ? 'dataset' : 'datasets'} available
        </p>
      </div>

      <nav className="space-y-2">
        {datasets.map(dataset => (
          <button
            key={dataset.id}
            onClick={() => onDatasetSelect(dataset.id)}
            className={`
              w-full text-left px-4 py-3 rounded-lg transition-colors
              ${selectedDataset === dataset.id
                ? 'bg-primary-100 text-primary-700 border border-primary-300'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
              }
            `}
          >
            <div className="font-medium text-sm">{dataset.name}</div>
            {dataset.description && (
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                {dataset.description}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">
              {dataset.metadata?.rowCount?.toLocaleString() || 0} rows
            </div>
          </button>
        ))}

        {datasets.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-8">
            No datasets available
          </div>
        )}
      </nav>
    </aside>
  );
}
