import { useState, useEffect } from 'react';
import axios from 'axios';

const cache = new Map();

// API base URL - detect environment
// In production, API is served from same origin
// In development, use localhost API server
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3003');

export function useDataLoader(datasetId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!datasetId) {
      setData(null);
      setLoading(false);
      return;
    }

    // Check cache first
    if (cache.has(datasetId)) {
      setData(cache.get(datasetId));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Load metadata first
    const metadataUrl = `${API_BASE_URL}/api/datasets/${datasetId}`;

    axios.get(metadataUrl)
      .then(response => {
        const metadata = response.data;

        // For now, load first page of data (we can add pagination later)
        return axios.get(`${API_BASE_URL}/api/datasets/${datasetId}/data?page=1&limit=10000`)
          .then(dataResponse => {
            const fullDataset = {
              ...metadata,
              data: dataResponse.data.data,
              pagination: dataResponse.data.pagination
            };
            cache.set(datasetId, fullDataset);
            setData(fullDataset);
            setLoading(false);
          });
      })
      .catch(err => {
        console.error(`Failed to load dataset ${datasetId}:`, err);
        setError(err.message);
        setLoading(false);
      });
  }, [datasetId]);

  return { data, loading, error };
}

export function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const catalogUrl = `${API_BASE_URL}/api/datasets`;

    axios.get(catalogUrl)
      .then(response => {
        setCatalog(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load catalog:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { catalog, loading, error };
}
