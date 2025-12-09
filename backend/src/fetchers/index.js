import { fetchDataGovSG } from './datagovsg-fetcher.js';

export async function fetchData(source, options = {}) {
  const { type, resourceId } = source;

  // Validate source.type
  if (!type || typeof type !== 'string') {
    throw new Error('source.type is required and must be a string');
  }

  const normalizedType = type.toLowerCase();

  if (normalizedType === 'datagovsg') {
    if (!resourceId) {
      throw new Error('resourceId is required for datagovsg source type');
    }
    return await fetchDataGovSG(resourceId, options);
  }

  throw new Error(`Unsupported source type: ${type}`);
}

export { fetchDataGovSG };
