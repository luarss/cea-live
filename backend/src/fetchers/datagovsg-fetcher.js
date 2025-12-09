import axios from 'axios';

/**
 * Fetch data from data.gov.sg API with pagination
 * @param {string} resourceId - The data.gov.sg resource ID
 * @param {object} options - Fetcher options
 * @returns {Promise<Array>} - Array of records
 */
export async function fetchDataGovSG(resourceId, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    limit = 1000, // Records per request
    maxRecords = 10000, // Total max records to fetch
  } = options;

  // Validate and normalize maxRetries to minimum of 1
  const normalizedMaxRetries = Math.max(1, maxRetries);

  const baseUrl = 'https://data.gov.sg/api/action/datastore_search';
  let allRecords = [];
  let offset = 0;
  let hasMore = true;

  console.log(`Fetching data from data.gov.sg (resource: ${resourceId})`);

  while (hasMore && allRecords.length < maxRecords) {
    let attempt = 0;
    let success = false;
    let response;

    while (attempt < normalizedMaxRetries && !success) {
      attempt++;
      try {
        console.log(`Fetching batch at offset ${offset} (attempt ${attempt}/${normalizedMaxRetries})`);

        response = await axios.get(baseUrl, {
          params: {
            resource_id: resourceId,
            limit: limit,
            offset: offset,
          },
          timeout: 30000, // 30 second timeout
        });

        if (response.data && response.data.success) {
          success = true;
        } else {
          throw new Error('API returned unsuccessful response');
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);

        if (attempt < normalizedMaxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        } else {
          throw new Error(`Failed to fetch data after ${normalizedMaxRetries} attempts: ${error.message}`);
        }
      }
    }

    // Ensure response is defined before accessing
    if (!response) {
      throw new Error('No response received after retry attempts');
    }

    const result = response.data.result;
    const records = result.records || [];

    allRecords = allRecords.concat(records);

    console.log(`Fetched ${records.length} records (total: ${allRecords.length})`);

    // Check if there are more records
    const total = result.total || 0;
    offset += records.length;
    hasMore = records.length === limit && offset < total && allRecords.length < maxRecords;
  }

  console.log(`Successfully fetched ${allRecords.length} total records`);

  return allRecords;
}
