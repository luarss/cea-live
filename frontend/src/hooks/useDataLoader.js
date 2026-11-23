import { useState, useEffect } from 'react';
import { getJson } from '../api';

export function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const path = '/api/datasets';

    getJson(path)
      .then(data => {
        setCatalog(data);
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
