import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..', '..');

/**
 * Fetch CSV data from data.gov.sg using Playwright to extract the S3 URL
 * @param {string} datasetId - The data.gov.sg dataset ID
 * @returns {Promise<string>} - The S3 URL for the CSV file
 */
export async function getS3UrlFromDataGovSG(datasetId) {
  const apiUrl = `https://api-open.data.gov.sg/v1/public/api/datasets/${datasetId}/poll-download`;
  console.log(`Fetching S3 URL from data.gov.sg API...`);
  const response = await axios.get(apiUrl);
  const url = response.data?.data?.url;
  if (!url) throw new Error('Failed to extract S3 URL from data.gov.sg API');
  console.log(`Extracted S3 URL: ${url.substring(0, 100)}...`);
  return url;
}

/**
 * Download CSV data from S3 URL and parse it
 * @param {string} s3Url - The S3 URL to download from
 * @returns {Promise<string>} - The CSV content as a string
 */
export async function downloadCSVFromS3(s3Url) {
  console.log('Downloading CSV from S3...');
  const response = await axios.get(s3Url, {
    responseType: 'text',
    timeout: 300000, // 5 minute timeout for large files
  });

  return response.data;
}

/**
 * Parse CSV string into array of objects
 * @param {string} csvString - The CSV content as a string
 * @returns {Array<Object>} - Array of row objects
 */
export function parseCSV(csvString) {
  // Handle empty input
  if (!csvString || csvString.trim().length === 0) return [];

  try {
    // Use csv-parse with robust options to handle quoted fields and commas within values
    const records = parse(csvString, {
      columns: true,           // Use first row as headers
      skip_empty_lines: true,  // Skip empty lines
      trim: true,              // Trim whitespace from fields
      relax_quotes: true,      // Be lenient with quotes
      quote: '"',              // Specify quote character
      escape: '"'              // Specify escape character
    });

    return records;
  } catch (error) {
    console.error('Error parsing CSV:', error.message);
    console.error('CSV parsing failed. This may be due to malformed CSV data.');
    // Return empty array instead of crashing the process
    return [];
  }
}

/**
 * Load data from local CSV file
 * @returns {Array<Object>} - Array of parsed data rows
 */
export function loadLocalCSV() {
  const csvPath = join(ROOT_DIR, 'data', 'CEASalespersonsPropertyTransactionRecordsresidential.csv');

  if (!existsSync(csvPath)) {
    throw new Error(`Local CSV file not found at ${csvPath}. Run 'npm run download' to fetch it.`);
  }

  console.log(`Loading data from local CSV: ${csvPath}`);
  const csvContent = readFileSync(csvPath, 'utf-8');
  const data = parseCSV(csvContent);

  console.log(`Successfully loaded ${data.length} records from local CSV`);
  return data;
}

/**
 * Main function to fetch and parse data from data.gov.sg
 * Checks for local CSV first, falls back to download if not found
 * @param {string} datasetId - The data.gov.sg dataset ID
 * @returns {Promise<Array<Object>>} - Array of parsed data rows
 */
export async function fetchDataWithPlaywright(datasetId) {
  const csvPath = join(ROOT_DIR, 'data', 'CEASalespersonsPropertyTransactionRecordsresidential.csv');

  // Try local CSV first
  if (existsSync(csvPath)) {
    console.log('Using local CSV file (skipping download)');
    return loadLocalCSV();
  }

  // Fall back to download if local file doesn't exist
  console.log('Local CSV not found, downloading from data.gov.sg...');

  // Get the S3 URL using Playwright
  const s3Url = await getS3UrlFromDataGovSG(datasetId);

  // Download the CSV from S3
  const csvContent = await downloadCSVFromS3(s3Url);

  // Parse the CSV
  const data = parseCSV(csvContent);

  console.log(`Successfully fetched and parsed ${data.length} records`);
  return data;
}
