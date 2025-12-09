import React, { useState } from 'react';
import { format } from 'date-fns';
import StatsSummary from './analysis/StatsSummary';
import AnalyticsDashboard from './analytics/AnalyticsDashboard';
import AgentInsights from './agents/AgentInsights';

export default function DatasetView({ dataset, loading, error }) {
  const [activeTab, setActiveTab] = useState('analytics'); // Default to analytics

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dataset...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Dataset</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!dataset) {
    return null;
  }

  const { metadata, schema } = dataset;
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

      {/* Statistics Summary */}
      <StatsSummary schema={schema} metadata={metadata} />

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
        <AgentInsights datasetId={dataset.id} />
      )}
    </div>
  );
}
