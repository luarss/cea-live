import { chromium } from 'playwright';
import axios from 'axios';

/**
 * Fetch CSV data from data.gov.sg using Playwright to extract the S3 URL
 * @param {string} datasetId - The data.gov.sg dataset ID
 * @returns {Promise<string>} - The S3 URL for the CSV file
 */
export async function getS3UrlFromDataGovSG(datasetId) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const url = `https://data.gov.sg/datasets/${datasetId}/view`;
    console.log(`Navigating to ${url}`);

    // Listen for console messages to capture the download URL
    let downloadUrl = null;
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('download-url')) {
        // Extract the URL from the console log
        const urlMatch = text.match(/(https:\/\/s3[^\s]+)/);
        if (urlMatch) {
          downloadUrl = urlMatch[1];
        }
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the download button to be visible
    console.log('Waiting for download button...');
    await page.waitForSelector('button:has-text("Download CSV")', { timeout: 30000 });

    // Click the download button
    console.log('Clicking download button...');
    await page.click('button:has-text("Download CSV")');

    // Wait for the console log to appear
    await page.waitForTimeout(3000);

    if (!downloadUrl) {
      throw new Error('Failed to extract S3 URL from page');
    }

    console.log(`Extracted S3 URL: ${downloadUrl.substring(0, 100)}...`);
    return downloadUrl;

  } finally {
    await browser.close();
  }
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
  const lines = csvString.split('\n');
  if (lines.length === 0) return [];

  // Get headers from first line
  const headers = lines[0].split(',').map(h => h.trim());

  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    data.push(row);
  }

  return data;
}

/**
 * Main function to fetch and parse data from data.gov.sg
 * @param {string} datasetId - The data.gov.sg dataset ID
 * @returns {Promise<Array<Object>>} - Array of parsed data rows
 */
export async function fetchDataWithPlaywright(datasetId) {
  // Get the S3 URL using Playwright
  const s3Url = await getS3UrlFromDataGovSG(datasetId);

  // Download the CSV from S3
  const csvContent = await downloadCSVFromS3(s3Url);

  // Parse the CSV
  const data = parseCSV(csvContent);

  console.log(`Successfully fetched and parsed ${data.length} records`);
  return data;
}
