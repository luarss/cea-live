import { useState, useCallback } from 'react';
import Layout from './components/layout/Layout';
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard';
import AgentInsights from './components/agents/AgentInsights';
import { useCatalog } from './hooks/useDataLoader';
import { useMarketInsights } from './hooks/useAnalytics';

function FullScreenMessage({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-ink text-white px-4 sm:px-6 lg:px-10 py-4 text-xl font-bold tracking-tight">CEA-VIZ</div>
      <div className="flex-1 flex items-center justify-center px-4">{children}</div>
    </div>
  );
}

function App() {
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();
  const [view, setView] = useState('agents');
  const [filters, setFilters] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isAgentsUpdating, setIsAgentsUpdating] = useState(false);

  const dataset = catalog?.datasets?.[0] || null;
  const datasetId = dataset?.id || null;

  const { data: filteredInsights, loading: filteredInsightsLoading, error: insightsError } = useMarketInsights(datasetId, filters);
  const { data: marketInsights } = useMarketInsights(datasetId, null);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    if (value) setView('agents');
  }, []);

  if (catalogLoading) {
    return (
      <FullScreenMessage>
        <p className="text-ink-muted" aria-live="polite">Loading transaction records…</p>
      </FullScreenMessage>
    );
  }

  if (catalogError || !dataset) {
    return (
      <FullScreenMessage>
        <div className="max-w-md">
          <h1 className="text-xl font-bold">Couldn’t reach the records</h1>
          <p className="text-ink-soft mt-1">
            {catalogError ? `${catalogError}.` : 'No dataset is available yet.'} The server may be waking up; try again in a few seconds.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 h-10 px-5 rounded-full bg-ink text-white font-semibold hover:bg-ink-soft"
          >
            Try again
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  const isUpdating = view === 'agents' ? isAgentsUpdating : filteredInsightsLoading;

  return (
    <Layout
      dataset={dataset}
      view={view}
      onViewChange={setView}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      filters={filters}
      onFiltersChange={setFilters}
      isUpdating={isUpdating}
    >
      {view === 'agents' ? (
        <AgentInsights
          datasetId={datasetId}
          filters={filters}
          searchQuery={searchQuery}
          marketInsights={marketInsights}
          onLoadingChange={setIsAgentsUpdating}
        />
      ) : (
        <AnalyticsDashboard
          datasetId={datasetId}
          filters={filters}
          insights={filteredInsights}
          insightsError={insightsError}
          isUpdating={filteredInsightsLoading}
        />
      )}
    </Layout>
  );
}

export default App;
