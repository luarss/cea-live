import { fetchDataGovSG } from './datagovsg-fetcher.js';

export async function fetchData(source, options = {}) {
  const { type, resourceId } = source;

  if (type.toLowerCase() === 'datagovsg') {
    if (!resourceId) {
      throw new Error('resourceId is required for datagovsg source type');
    }
    return await fetchDataGovSG(resourceId, options);
  }

  throw new Error(`Unsupported source type: ${type}`);
}

export { fetchDataGovSG };
