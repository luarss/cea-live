import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3003');

export async function getJson(path) {
  const initialData = window.__INITIAL_DATA__;
  if (initialData && Object.hasOwn(initialData, path)) {
    return initialData[path];
  }
  const response = await axios.get(`${API_BASE_URL}${path}`);
  return response.data;
}
