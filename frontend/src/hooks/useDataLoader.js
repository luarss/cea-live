import { useState, useEffect } from 'react';
import axios from 'axios';

// API base URL - detect environment
// In production, API is served from same origin
// In development, use localhost API server
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3003');

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
