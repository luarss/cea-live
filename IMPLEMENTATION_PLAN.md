# CEA-VIZ: Live Data Pipeline Implementation Plan

## Overview
Build a live data pipeline hosted on GitHub Pages with automatic data updates via GitHub Actions, smart adaptive visualizations, and a modern React UI.

## Architecture Summary

**Data Flow:**
```
External CSV/JSON → GitHub Actions (scheduled) → Fetch & Analyze → Process → Commit → Deploy → React UI
```

**Tech Stack:**
- **Frontend**: React 18 + Vite 5 + TailwindCSS + Recharts
- **Pipeline**: Node.js 20 + papaparse + simple-statistics
- **Automation**: GitHub Actions (scheduled every 6 hours)
- **Hosting**: GitHub Pages

## Project Structure

```
cea-viz/
├── .github/workflows/
│   ├── data-pipeline.yml       # Scheduled data fetching (every 6 hours)
│   └── deploy.yml              # GitHub Pages deployment
├── data/
│   ├── processed/              # Processed JSON data for frontend
│   │   ├── datasets.json       # Catalog of all datasets
│   │   └── [dataset].json      # Individual processed datasets
│   └── sources.config.json     # Data source configuration
├── pipeline/
│   ├── package.json
│   └── src/
│       ├── fetchers/           # CSV/JSON data fetchers
│       ├── processors/         # Data analysis & transformation
│       │   ├── analyzer.js     # Type detection & statistics
│       │   └── transformer.js  # Data cleaning & normalization
│       └── main.js             # Pipeline orchestrator
├── src/                        # React frontend
│   ├── components/
│   │   ├── layout/             # Header, Sidebar, Layout
│   │   ├── visualizations/     # Chart components
│   │   │   ├── ChartRenderer.jsx    # Smart chart selector
│   │   │   ├── LineChart.jsx
│   │   │   ├── BarChart.jsx
│   │   │   ├── PieChart.jsx
│   │   │   └── DataTable.jsx
│   │   └── analysis/           # StatsSummary, TrendIndicator
│   ├── hooks/
│   │   ├── useDataLoader.js    # Data loading & caching
│   │   └── useDataAnalysis.js  # Frontend data analysis
│   ├── utils/
│   │   ├── chartSelector.js    # Chart type selection algorithm
│   │   └── dataAnalyzer.js     # Data pattern detection
│   ├── App.jsx
│   └── main.jsx
├── public/
├── package.json
├── vite.config.js              # Vite config with GH Pages base
└── tailwind.config.js
```

## Implementation Steps

### Phase 1: Foundation Setup

**1.1 Project Initialization**
- Create directory structure
- Initialize `package.json` (root + pipeline)
- Set up `.gitignore` (node_modules, dist, data/raw, logs)

**1.2 Install Dependencies**

Root `package.json`:
```json
{
  "name": "cea-viz",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.0",
    "date-fns": "^3.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

Pipeline `package.json`:
```json
{
  "name": "cea-viz-pipeline",
  "type": "module",
  "scripts": {
    "pipeline": "node src/main.js"
  },
  "dependencies": {
    "papaparse": "^5.4.0",
    "axios": "^1.6.0",
    "date-fns": "^3.0.0",
    "simple-statistics": "^7.8.0"
  }
}
```

**1.3 Configure Build Tools**

Create `vite.config.js`:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/cea-viz/',  // Match your GitHub repo name
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
```

Create `tailwind.config.js`:
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { 500: '#0ea5e9', 700: '#0369a1' }
      }
    }
  },
  plugins: []
}
```

Create `postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

**1.4 Create Data Source Config**

Create `data/sources.config.json`:
```json
{
  "version": "1.0",
  "datasets": [
    {
      "id": "example-dataset",
      "name": "Example Dataset",
      "source": {
        "type": "csv",
        "url": "https://example.com/data.csv"
      },
      "refresh": {
        "enabled": true,
        "schedule": "0 */6 * * *"
      }
    }
  ]
}
```

### Phase 2: Data Pipeline Implementation

**2.1 Core Pipeline Files**

**Critical File #1: `pipeline/src/main.js`** - Pipeline orchestrator
```javascript
// Reads sources.config.json
// For each dataset:
//   1. Fetch data using appropriate fetcher
//   2. Analyze data (detect types, calculate stats)
//   3. Transform and clean data
//   4. Generate visualization recommendations
//   5. Write processed JSON to data/processed/
// Update datasets.json catalog
```

**Critical File #2: `pipeline/src/processors/analyzer.js`** - Data intelligence
```javascript
// Functions to implement:
// - detectColumnType(values) → 'numeric' | 'datetime' | 'categorical' | 'text'
// - calculateStatistics(values, type) → { min, max, mean, median, stdDev, unique }
// - detectTemporalColumn(schema) → column name or null
// - recommendVisualizations(schema, data) → array of viz configs
```

Key algorithm for type detection:
1. Check if >90% values are numeric → 'numeric'
2. Check if >80% values are dates → 'datetime'
3. Check if cardinality <50% and unique <50 → 'categorical'
4. Otherwise → 'text'

**2.2 Fetchers**

`pipeline/src/fetchers/csv-fetcher.js`:
- Use papaparse to parse CSV from URL
- Handle errors and retries
- Return array of objects

`pipeline/src/fetchers/json-fetcher.js`:
- Use axios to fetch JSON
- Handle authentication if needed
- Return parsed data

**2.3 Output Format**

Processed data format (`data/processed/[dataset-id].json`):
```json
{
  "id": "dataset-id",
  "name": "Dataset Name",
  "metadata": {
    "lastUpdated": "2025-12-09T12:00:00Z",
    "rowCount": 1000,
    "columnCount": 5
  },
  "schema": {
    "columns": [
      {
        "name": "date",
        "type": "datetime",
        "stats": { "min": "...", "max": "...", "unique": 365 }
      },
      {
        "name": "value",
        "type": "numeric",
        "stats": { "min": 0, "max": 100, "mean": 50, "stdDev": 15 }
      }
    ],
    "temporalColumn": "date"
  },
  "visualizationRecommendations": [
    {
      "type": "line",
      "priority": 1,
      "config": { "xAxis": "date", "yAxis": "value" },
      "reasoning": "Temporal data with numeric values"
    }
  ],
  "data": [ /* actual data rows */ ]
}
```

### Phase 3: GitHub Actions Workflows

**3.1 Data Pipeline Workflow**

**Critical File #3: `.github/workflows/data-pipeline.yml`**
```yaml
name: Data Pipeline

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  fetch-and-process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'pipeline/package-lock.json'

      - run: cd pipeline && npm ci

      - run: cd pipeline && npm run pipeline
        env:
          NODE_ENV: production

      - name: Check for changes
        id: git-check
        run: |
          git diff --exit-code data/processed || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Commit processed data
        if: steps.git-check.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/processed
          git commit -m "Update data - $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
          git push
```

**3.2 Deployment Workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
    paths:
      - 'src/**'
      - 'data/processed/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

### Phase 4: React Frontend - Core

**4.1 App Structure**

`src/main.jsx`:
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/App.jsx`:
```javascript
// Main app component
// - Fetch datasets.json on mount
// - Provide dataset selection
// - Route to DatasetView for each dataset
// - Handle loading and error states
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**4.2 Data Loading Hook**

`src/hooks/useDataLoader.js`:
```javascript
// Custom hook for loading dataset
// - Fetch from /data/processed/[id].json
// - Cache results in memory
// - Handle loading/error states
// - Return { data, loading, error }
```

**4.3 Layout Components**

`src/components/layout/Layout.jsx`:
- Header with branding
- Sidebar with dataset selector
- Main content area

### Phase 5: React Frontend - Visualizations

**5.1 Smart Chart Selection**

**Critical File #4: `src/utils/chartSelector.js`** - Visualization intelligence
```javascript
// selectOptimalChart(column, dataset) algorithm:
//
// If column is numeric:
//   - Has temporal data? → 'line' (time series)
//   - High cardinality (>50% unique)? → 'histogram' (distribution)
//   - Otherwise → 'bar' (aggregated)
//
// If column is categorical:
//   - Low cardinality (<10% unique)? → 'pie'
//   - Otherwise → 'bar'
//
// If column is datetime:
//   - → 'timeline'
//
// For column pairs:
//   - Two numeric → 'scatter' (correlation)
//   - Numeric + categorical → 'bar' (grouped)
```

**Critical File #5: `src/components/visualizations/ChartRenderer.jsx`**
```javascript
// Smart component that:
// 1. Receives dataset and selected columns
// 2. Uses chartSelector to determine optimal chart type
// 3. Renders appropriate chart component (Line, Bar, Pie, etc.)
// 4. Provides chart switching UI
// 5. Passes data in correct format to chart library
```

**5.2 Chart Components**

Using Recharts library, create:
- `LineChart.jsx` - Time series and trends
- `BarChart.jsx` - Category comparisons
- `PieChart.jsx` - Composition (low cardinality categories)
- `ScatterPlot.jsx` - Correlation between numeric columns
- `DataTable.jsx` - Interactive sortable/filterable table

Each component:
- Accepts standardized props (data, config)
- Responsive design
- Interactive tooltips
- Consistent styling

**5.3 Analysis Components**

`src/components/analysis/StatsSummary.jsx`:
- Display key statistics from schema.columns[].stats
- Show data quality metrics
- Highlight interesting patterns

`src/components/analysis/TrendIndicator.jsx`:
- For time series, show trend direction
- Calculate simple moving averages
- Display rate of change

### Phase 6: UI Polish

**6.1 Styling**
- Consistent color palette from tailwind.config.js
- Card components for visualization containers
- Smooth animations (fade-in, slide-up)
- Responsive grid layouts
- Mobile-friendly navigation

**6.2 UX Enhancements**
- Skeleton loaders during data fetch
- Empty states for no data
- Error boundaries with user-friendly messages
- Tooltips for data points
- Export buttons (download CSV/PNG)

**6.3 Accessibility**
- Semantic HTML
- ARIA labels for charts
- Keyboard navigation
- Sufficient color contrast
- Screen reader support

### Phase 7: Testing & Deployment

**7.1 Local Testing**
```bash
# Install dependencies
npm install
cd pipeline && npm install && cd ..

# Test pipeline locally
cd pipeline && npm run pipeline

# Run dev server
npm run dev

# Build for production
npm run build
npm run preview
```

**7.2 GitHub Setup**
- Push code to GitHub repository
- Enable GitHub Pages in Settings → Pages
- Source: GitHub Actions
- Trigger data-pipeline workflow manually first
- Verify deployment at https://[username].github.io/cea-viz/

**7.3 Documentation**

Create `README.md` with:
- Project overview and demo link
- How to configure data sources
- How to add new datasets
- Local development setup
- Architecture diagram
- Screenshots

## Critical Files to Create

1. **`pipeline/src/main.js`** - Core pipeline orchestrator (ETL process)
2. **`pipeline/src/processors/analyzer.js`** - Data analysis engine (type detection, statistics, viz recommendations)
3. **`.github/workflows/data-pipeline.yml`** - Scheduled data fetching automation
4. **`src/utils/chartSelector.js`** - Smart chart selection algorithm
5. **`src/components/visualizations/ChartRenderer.jsx`** - Main visualization component

## Key Features

✅ **Automated Updates**: GitHub Actions fetches data every 6 hours
✅ **Smart Visualizations**: Auto-detects data types and selects optimal charts
✅ **Modern UI**: React + Vite + TailwindCSS + Recharts
✅ **Responsive Design**: Works on desktop and mobile
✅ **Easy Configuration**: JSON config for adding new data sources
✅ **Zero Backend**: Fully static, hosted on GitHub Pages
✅ **Type Safety**: Automatic type detection for columns
✅ **Statistical Analysis**: Min, max, mean, median, std dev calculated automatically

## Example Dataset Configuration

To add a new data source, edit `data/sources.config.json`:
```json
{
  "datasets": [
    {
      "id": "my-dataset",
      "name": "My Dataset",
      "source": {
        "type": "csv",
        "url": "https://example.com/data.csv"
      },
      "refresh": {
        "enabled": true,
        "schedule": "0 */6 * * *"
      }
    }
  ]
}
```

The pipeline will automatically:
1. Fetch the CSV
2. Detect column types (numeric, date, categorical, text)
3. Calculate statistics
4. Generate visualization recommendations
5. Commit processed data
6. Trigger deployment

The frontend will automatically:
1. Load the new dataset
2. Analyze the structure
3. Select appropriate visualizations
4. Render interactive charts

## Timeline Estimate

- **Phase 1 (Foundation)**: 2-3 hours
- **Phase 2 (Pipeline)**: 4-6 hours
- **Phase 3 (GitHub Actions)**: 1-2 hours
- **Phase 4 (React Core)**: 3-4 hours
- **Phase 5 (Visualizations)**: 5-7 hours
- **Phase 6 (Polish)**: 2-3 hours
- **Phase 7 (Testing & Deploy)**: 1-2 hours

**Total**: 18-27 hours of focused development

Working prototype (Phases 1-4) possible in 10-15 hours.
