import React, { useState } from 'react';
import Layout from './components/layout/Layout';
import DatasetView from './components/DatasetView';
import { useCatalog, useDataLoader } from './hooks/useDataLoader';

function App() {
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const { data: dataset, loading: datasetLoading, error: datasetError } = useDataLoader(selectedDatasetId);

  // Auto-select first dataset
  React.useEffect(() => {
    if (catalog && !selectedDatasetId && catalog.datasets.length > 0) {
      setSelectedDatasetId(catalog.datasets[0].id);
    }
  }, [catalog, selectedDatasetId]);

  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading datasets...</p>
        </div>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Catalog</h2>
          <p className="text-gray-600 mb-4">{catalogError}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
      catalog={catalog}
      selectedDataset={selectedDatasetId}
      onDatasetSelect={setSelectedDatasetId}
    >
      {selectedDatasetId ? (
        <DatasetView
          dataset={dataset}
          loading={datasetLoading}
          error={datasetError}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Welcome to CEA-VIZ
            </h2>
            <p className="text-gray-600">
              Select a dataset from the sidebar to begin
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;
