import { useState, useEffect } from 'react';
import { getJson } from '../api';

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
    if (filters && Object.keys(filters).some(k => filters[k]?.length > 0)) {
      params.append('filters', JSON.stringify(filters));
    }

    const path = `/api/datasets/${datasetId}/timeseries?${params}`;

    getJson(path)
      .then(data => {
        setData(data);
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
    const path = `/api/datasets/${datasetId}/insights${queryString ? '?' + queryString : ''}`;

    getJson(path)
      .then(data => {
        setData(data);
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

/**
 * Hook for fetching top agents ranking
 * @param {string} datasetId - Dataset ID
 * @param {number} limit - Number of agents to fetch (default 100)
 * @param {Object} filters - Optional filters
 * @param {string} search - Optional search query for agent name or reg number
 * @returns {Object} { data, loading, error }
 */
export function useTopAgents(datasetId, limit = 100, filters = null, search = null) {
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

    const params = new URLSearchParams({ limit: limit.toString() });
    if (filters && Object.keys(filters).some(k => filters[k]?.length > 0)) {
      params.append('filters', JSON.stringify(filters));
    }
    if (search && search.trim()) {
      params.append('search', search.trim());
    }

    const path = `/api/datasets/${datasetId}/agents/top?${params}`;

    getJson(path)
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load top agents:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [datasetId, limit, JSON.stringify(filters), search]);

  return { data, loading, error };
}

/**
 * Hook for fetching individual agent profile
 * @param {string} datasetId - Dataset ID
 * @param {string} regNum - Agent registration number
 * @returns {Object} { data, loading, error }
 */
export function useAgentProfile(datasetId, regNum) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!datasetId || !regNum) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const path = `/api/datasets/${datasetId}/agents/${regNum}`;

    getJson(path)
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load agent profile:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [datasetId, regNum]);

  return { data, loading, error };
}
