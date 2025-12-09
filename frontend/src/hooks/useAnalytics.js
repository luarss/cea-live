import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3003');

/**
 * Hook for fetching multi-dimensional analytics data
 * @param {string} datasetId - Dataset ID
 * @param {string} dimension1 - Primary dimension field
 * @param {string} dimension2 - Optional secondary dimension
 * @param {Object} filters - Optional filters
 * @returns {Object} { data, loading, error }
 */
export function useMultiDimensionalAnalytics(datasetId, dimension1, dimension2 = null, filters = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!datasetId || !dimension1) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ dimension1 });
    if (dimension2) params.append('dimension2', dimension2);
    if (filters) params.append('filters', JSON.stringify(filters));

    const url = `${API_BASE_URL}/api/datasets/${datasetId}/analytics?${params}`;

    axios.get(url)
      .then(response => {
        setData(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load analytics:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [datasetId, dimension1, dimension2, JSON.stringify(filters)]);

  return { data, loading, error };
}

/**
 * Hook for fetching time-series data
 * @param {string} datasetId - Dataset ID
 * @param {string} period - "month" or "year"
 * @param {string} groupBy - Optional field to group by
 * @param {Object} filters - Optional filters
 * @returns {Object} { data, loading, error }
 */
export function useTimeSeriesData(datasetId, period = 'month', groupBy = null, filters = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!datasetId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ period });
    if (groupBy) params.append('groupBy', groupBy);
    if (filters) params.append('filters', JSON.stringify(filters));

    const url = `${API_BASE_URL}/api/datasets/${datasetId}/timeseries?${params}`;

    axios.get(url)
      .then(response => {
        setData(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load time series:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [datasetId, period, groupBy, JSON.stringify(filters)]);

  return { data, loading, error };
}

/**
 * Hook for fetching market insights
 * @param {string} datasetId - Dataset ID
 * @param {Object} filters - Optional filters
 * @returns {Object} { data, loading, error }
 */
export function useMarketInsights(datasetId, filters = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!datasetId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters && Object.keys(filters).some(k => filters[k]?.length > 0)) {
      params.append('filters', JSON.stringify(filters));
    }

    const queryString = params.toString();
    const url = `${API_BASE_URL}/api/datasets/${datasetId}/insights${queryString ? '?' + queryString : ''}`;

    axios.get(url)
      .then(response => {
        setData(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load insights:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [datasetId, JSON.stringify(filters)]);

  return { data, loading, error };
}
