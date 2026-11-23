import { lazy, Suspense, useState } from 'react';
import { format } from 'date-fns';
import AnalyticsDashboard from './analytics/AnalyticsDashboard';

const AgentInsights = lazy(() => import('./agents/AgentInsights'));

export default function DatasetView({ dataset }) {
  const [activeTab, setActiveTab] = useState('analytics'); // Default to analytics

  if (!dataset) {
    return null;
  }

  const { metadata } = dataset;
  const lastUpdated = metadata.lastUpdated
    ? format(new Date(metadata.lastUpdated), 'MMM d, yyyy HH:mm')
    : 'Unknown';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">{dataset.name}</h2>
        {dataset.description && (
          <p className="text-gray-600 mt-1">{dataset.description}</p>
        )}
        <div className="flex gap-6 mt-4 text-sm text-gray-500">
          <span>{metadata.rowCount?.toLocaleString() || 0} rows</span>
          <span>{metadata.columnCount || 0} columns</span>
          <span>Updated {lastUpdated}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`
              px-4 py-2 font-medium text-sm border-b-2 transition-colors
              ${activeTab === 'analytics'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`
              px-4 py-2 font-medium text-sm border-b-2 transition-colors
              ${activeTab === 'agents'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Agents
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'analytics' && (
        <AnalyticsDashboard datasetId={dataset.id} />
      )}

      {activeTab === 'agents' && (
        <Suspense fallback={<div className="flex items-center justify-center h-96 text-gray-500">Loading agent insights...</div>}>
          <AgentInsights datasetId={dataset.id} />
        </Suspense>
      )}
    </div>
  );
}
