# Architectural Decisions: Building a Property Transaction Dashboard

## Overview

Building a dashboard to visualize 1.2 million property transactions required careful architectural decisions around data fetching, storage, serving, and rendering. This document captures the technical decisions made and their rationale.

## Core Architecture

### Stack
- **Backend**: Node.js + Express 5 + SQLite3
- **Frontend**: React + Vite + TailwindCSS + Recharts
- **Data Pipeline**: Playwright (scraping) + GitHub Actions (automation)
- **Deployment**: Render (free tier)

---

## Data Pipeline

### Problem: Accessing Government Data
The Singapore government publishes property transaction data on data.gov.sg, but direct CSV downloads aren't stable URLs—they're S3 pre-signed URLs that expire.

### Decision: Playwright-based Scraping
**Commit**: `1b27aac` - Efficient data pipeline + Render scaffold

Instead of using data.gov.sg API (which has rate limits), use Playwright to:
1. Navigate to data.gov.sg resource page
2. Extract the S3 download URL from the page
3. Download CSV directly from S3

```javascript
// backend/src/fetchers/playwright-fetcher.js
async function getS3UrlFromDataGovSG(datasetId) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`https://data.gov.sg/datasets/${datasetId}/view`);
  const s3Url = await page.evaluate(() => {
    // Extract S3 URL from download button
  });
  return s3Url;
}
```

**Tradeoff**: More complex setup (requires Playwright + Chromium) but reliable access to fresh data.

### Decision: Git LFS for CSV Storage
**Commit**: `32b640f` - add install-lfs target

Store the raw 100MB+ CSV file in Git LFS instead of regenerating it on every deploy.

**Rationale**:
- Avoid re-downloading CSV on every Render deployment (saves time + bandwidth)
- GitHub Actions downloads fresh data daily and commits to LFS
- Deployment just pulls existing CSV from LFS and processes it

**Implementation**:
```yaml
# .github/workflows/data-pipeline.yml
- name: Download fresh data
  run: make download
- name: Commit raw data changes
  uses: stefanzweifel/git-auto-commit-action@v5
```

### Decision: Unified Pipeline (CSV → SQLite)
**Commit**: `d2ea3ce` - Simplify data pipeline

Originally had three stages: CSV → JSON → SQLite. Simplified to two: CSV → SQLite.

**Before**:
```bash
download → parse to JSON → migrate JSON to SQLite
```

**After**:
```bash
download → parse CSV and write directly to SQLite
```

**Benefits**:
- One less file format to maintain
- Faster build times (no intermediate JSON step)
- Simpler code (`main.js` handles both download and migration)

---

## Database Layer

### Problem: Memory Footprint
Initially served data directly from a 400MB JSON file loaded into memory. On Render's free tier (512MB RAM), this left minimal headroom.

### Decision: SQLite3 with Read-Only Mode
**Commit**: `d7962bc` - Implement sqlite3 backend for reducing memory footprint

Migrate from in-memory JSON to SQLite3.

**Results**:
- Memory usage: 422MB → 240MB (43% reduction)
- Database size: ~100MB on disk
- Enables indexed queries (critical for analytics endpoints)

**Implementation**:
```javascript
// backend/src/database.js
const db = new Database(dbPath, { readonly: true });
```

**Why readonly?**
- No writes during runtime (data updates happen via GitHub Actions + redeploy)
- Allows SQLite optimizations (no WAL overhead)
- Prevents accidental corruption

### Decision: Aggressive Indexing
**Commit**: `d7962bc`

Created indexes on all frequently-queried columns:
```sql
CREATE INDEX idx_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_property_type ON transactions(property_type);
CREATE INDEX idx_salesperson_reg_num ON transactions(salesperson_reg_num);
CREATE INDEX idx_town ON transactions(town);
CREATE INDEX idx_transaction_type ON transactions(transaction_type);
```

**Impact**: Sub-100ms query times for most aggregations on 1.2M records.

### Decision: SQL-Native Aggregations
Instead of loading all data into memory and aggregating in JavaScript, push aggregations to SQLite.

**Example - Time Series Endpoint**:
```javascript
// Convert "MMM-YYYY" → "YYYY-MM" in SQL
const monthConversion = `
  CASE substr(transaction_date, 1, 3)
    WHEN 'JAN' THEN '01' WHEN 'FEB' THEN '02' ...
  END
`;

const sql = `
  SELECT
    substr(transaction_date, -4) || '-' || ${monthConversion} as period,
    COUNT(*) as count
  FROM transactions
  WHERE transaction_date IS NOT NULL
  GROUP BY period
  ORDER BY period
`;
```

**Rationale**: SQLite's query planner is faster than JavaScript loops for these operations.

### Optimization: Batch Queries for N+1 Problem
**Commit**: `d7962bc` - fix N+1 query in topAgents analytics

**Before**: Looping through top 100 agents and querying property types individually (100 queries).

**After**: Single batch query using window functions:
```sql
WITH ranked AS (
  SELECT
    salesperson_reg_num,
    property_type,
    COUNT(*) as count,
    ROW_NUMBER() OVER (PARTITION BY salesperson_reg_num ORDER BY COUNT(*) DESC) as rank
  FROM transactions
  WHERE salesperson_reg_num IN (?, ?, ..., ?)
  GROUP BY salesperson_reg_num, property_type
)
SELECT * FROM ranked WHERE rank = 1
```

**Impact**: 100 queries → 4 queries (property type, transaction type, representation, town).

---

## API Design

### Decision: Express 5
**Commit**: `78babc1` - express 5 compat

Migrated to Express 5 for better async error handling and modern middleware support.

**Breaking Change Handled**:
```javascript
// Express 5: Catch-all must be middleware, not route
app.use((req, res) => {
  res.sendFile(join(frontendDistPath, 'index.html'));
});
```

### Decision: Comprehensive CORS Configuration
**Commit**: `83ec80c` - fix CORS: add prod domain

Explicit origin whitelist for local dev and production:
```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',     // Vite dev
  'http://localhost:3003',     // Same-origin
  'https://cea-viz.onrender.com',  // Production
];
```

**Rationale**: Prevent unauthorized frontend domains from hitting API while supporting all dev environments.

### Decision: Parameterized Analytics Endpoints
Instead of hardcoding chart types, expose flexible analytics endpoints:

1. **Multi-dimensional analytics**: `/api/datasets/:id/analytics?dimension1=X&dimension2=Y`
2. **Time-series**: `/api/datasets/:id/timeseries?period=month&groupBy=property_type`
3. **Market insights**: `/api/datasets/:id/insights` (precalculated summary stats)
4. **Agent rankings**: `/api/datasets/:id/agents/top?limit=100&search=John`

**Benefit**: Frontend can compose any visualization without backend changes.

### Decision: Filter Syntax (JSON in Query String)
```javascript
GET /api/datasets/:id/data?filters={"property_type":"HDB","town":"Punggol"}
```

**Alternative Considered**: Multiple query params (`?property_type=HDB&town=Punggol`).

**Chosen Approach**: JSON string because:
- Supports array filters: `{"town":["Punggol","Sengkang"]}`
- Single parameter to parse
- Type-safe (can validate against schema)

**Implementation**:
```javascript
function parseFilters(filtersString) {
  try {
    return JSON.parse(filtersString);
  } catch {
    return { __parseError: true };
  }
}
```

---

## Deployment Architecture

### Decision: Monorepo Structure
```
cea-live/
├── backend/          # Node.js API + data pipeline
├── frontend/         # React SPA
├── data/             # CSV + SQLite (Git LFS)
└── Makefile          # Build orchestration
```

**Rationale**:
- Single deploy on Render (backend serves frontend static files)
- Shared data directory (backend builds SQLite, serves it at runtime)
- Atomic deployments (frontend + backend always in sync)

### Decision: Static File Serving from Backend
**Commit**: `84c38e9` - fix: update static file serving

Express serves Vite-built frontend:
```javascript
const frontendDistPath = join(ROOT_DIR, 'frontend', 'dist');
if (existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath, { index: 'index.html' }));
}
```

**Deployment Flow**:
1. Render runs `make build`:
   - Installs backend deps
   - Runs data pipeline (CSV → SQLite)
   - Builds frontend (Vite → `frontend/dist`)
2. Render runs `make start` → Express serves API + static frontend

**Alternative Considered**: Separate Render services for frontend/backend.
**Rejected Because**: Free tier doesn't support multiple services; monolith is simpler.

### Decision: Build-Time Data Processing
**Commit**: `d2ea3ce`

Process data during build, not at runtime:
```yaml
# render.yaml
buildCommand: make install-lfs && make build
startCommand: make start
```

**Rationale**:
- SQLite database is built once during deploy
- Runtime only reads (fast startup)
- No data processing overhead on server spin-up

### Decision: Git LFS for Large Files
**Commit**: `32b640f`

Track CSV and SQLite in Git LFS:
```
# .gitattributes
*.csv filter=lfs diff=lfs merge=lfs -text
*.db filter=lfs diff=lfs merge=lfs -text
```

**Benefit**: Render can pull data without re-downloading from data.gov.sg.

**Custom LFS Install for Render**:
```makefile
install-lfs:
	curl -L https://github.com/git-lfs/git-lfs/releases/.../git-lfs-linux-amd64.tar.gz | tar xz
	mkdir -p ./bin
	mv git-lfs-3.4.1/git-lfs ./bin/
	./bin/git-lfs install --force
	./bin/git-lfs pull
```

**Why?** Render doesn't have Git LFS pre-installed on free tier.

---

## Frontend Architecture

### Decision: Vite + React
**Commit**: `df6d317` - Frontend + Integration

**Why Vite over CRA?**
- Faster dev server (ESBuild)
- Faster builds
- Better tree-shaking

### Decision: Component Structure
```
components/
├── layout/          # Header, Sidebar, Layout
├── analytics/       # AnalyticsDashboard, FilterPanel
├── agents/          # AgentInsights, AgentProfile
├── visualizations/  # ChartRenderer, PieChart, LineChart, BarChart
└── ui/              # ErrorBoundary
```

**Pattern**: Container/Presentation split
- Containers (`DatasetView`, `AgentInsights`) fetch data
- Presentations (`PieChart`, `BarChart`) render props

### Decision: Custom Hooks for Data Fetching
```javascript
// hooks/useDataLoader.js
export function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  // ... fetch logic
}

export function useDataLoader(datasetId) {
  // ... fetch dataset metadata
}
```

**Rationale**: Reusable data fetching logic without Redux overhead.

### Decision: Recharts for Visualizations
**Why Recharts?**
- Declarative API (fits React model)
- Responsive by default
- Supports time-series, bar, pie, line charts

**Alternative Considered**: D3.js
**Rejected Because**: Too low-level, longer dev time for standard charts.

### Decision: TailwindCSS for Styling
**Why Tailwind?**
- Utility-first (fast prototyping)
- Tiny bundle (PurgeCSS removes unused styles)
- Consistent design system

**Config**:
```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: {...},
      secondary: {...}
    }
  }
}
```

---

## Optimizations (In-Progress Branch)

The following optimizations are implemented on a side branch (`189e7c2`, `b92aabc`, `a4113f8`) but not yet merged to main:

### LRU Cache
**Commit**: `189e7c2` - add lru cache

Implemented in-memory LRU cache with TTL:
- API endpoints: 50 entries, 10 min TTL
- Stats endpoints: 200 entries, 30 min TTL

**Expected Impact**: 60-80% reduction in repeated query load.

### Response Compression
**Commit**: `b92aabc` - backend optimisations

Added `compression` middleware:
```javascript
app.use(compression({
  filter: (req, res) => {
    return compression.filter(req, res);
  },
  level: 6
}));
```

**Measured**: 60-80% payload reduction on JSON responses.

### Precomputed Aggregation Tables
**Commit**: `b92aabc`

Create materialized aggregation tables during build:
```sql
CREATE TABLE agg_property_type_monthly AS
SELECT
  property_type,
  period,
  COUNT(*) as count
FROM transactions
GROUP BY property_type, period;
```

**Benefit**: O(1) reads instead of O(n) aggregations for common queries.

### Docker Benchmarking Suite
**Commit**: `a4113f8` - add docker stuff

Created Docker-based load testing:
```bash
# Dockerfile.benchmark
FROM node:20-slim
COPY backend/ /app
RUN npm install

# Run load tests
CMD ["node", "src/loadTest.js"]
```

**Purpose**: Validate optimization impact before merging.

---

## Data Flow Summary

### Build Time (GitHub Actions + Render)
```
1. GitHub Actions (Daily)
   ├─ Playwright scrapes data.gov.sg → downloads CSV
   └─ Commits CSV to Git LFS

2. Render Deploy
   ├─ Pull repo (including LFS)
   ├─ Install dependencies
   ├─ Parse CSV → Insert into SQLite (with indexes)
   ├─ Build frontend (Vite)
   └─ Deploy Express server
```

### Runtime (User Request)
```
1. User visits https://cea-viz.onrender.com
   └─ Served: frontend/dist/index.html

2. React App Mounts
   ├─ GET /api/datasets → Load catalog
   └─ GET /api/datasets/:id → Load dataset metadata

3. User Interacts with Dashboard
   ├─ Apply filters → GET /api/datasets/:id/analytics?filters={...}
   ├─ View time-series → GET /api/datasets/:id/timeseries?period=month
   └─ Search agents → GET /api/datasets/:id/agents/top?search=John

4. Express API Layer
   ├─ Parse query params
   ├─ Build SQL query with filters
   ├─ Execute against SQLite (indexed queries)
   └─ Return JSON

5. Frontend Renders
   └─ Recharts visualizes data
```

---

## Key Tradeoffs

### Tradeoff 1: Build-Time Processing vs Runtime Flexibility
**Decision**: Process data at build time.
**Benefit**: Fast runtime, no CPU overhead.
**Cost**: Data updates require redeploy (acceptable for daily updates).

### Tradeoff 2: SQLite vs PostgreSQL
**Decision**: SQLite.
**Benefit**: Zero-config, embedded, perfect for read-heavy workloads.
**Cost**: Limited concurrency (not an issue on free tier with low traffic).
**When to switch**: If concurrent writes are needed or traffic exceeds ~100 QPS.

### Tradeoff 3: Monorepo vs Microservices
**Decision**: Monorepo (backend serves frontend).
**Benefit**: Single deploy, always in sync.
**Cost**: Can't scale frontend/backend independently.
**When to switch**: If frontend needs CDN or backend needs horizontal scaling.

### Tradeoff 4: Git LFS vs Object Storage
**Decision**: Git LFS for data files.
**Benefit**: Version-controlled, simple deploy.
**Cost**: LFS bandwidth limits (1GB/month on free tier).
**When to switch**: If data updates frequently or grows beyond 1GB.

---

## Performance Characteristics

### Current Metrics (Main Branch)
- **Database Size**: ~100MB SQLite
- **Memory Usage**: 240MB (down from 422MB)
- **Build Time**: ~3 minutes (LFS pull + CSV parse + frontend build)
- **API Response Time**: 50-200ms (indexed queries)
- **Bundle Size**: Frontend ~300KB gzipped

### Expected with Optimizations (Side Branch)
- **Response Time**: 10-50ms (with LRU cache)
- **Payload Size**: 60-80% smaller (with compression)
- **Query Time**: <10ms (with precomputed aggregations)

---

## Lessons Learned

1. **SQLite is underrated** for read-heavy applications. Window functions and indexes make it competitive with PostgreSQL for analytics.

2. **Build-time processing** is a superpower on PaaS with slow cold starts. Pre-process everything you can.

3. **Git LFS** works surprisingly well for small datasets (<1GB). Free tier limits are fine for daily updates.

4. **Playwright** is more reliable than API scraping when URLs change. Tradeoff is slower + heavier.

5. **Monorepo + static serving** is the simplest deploy model for full-stack apps on free tiers.

6. **Express 5** catch-all routes require middleware pattern, not route handlers.

7. **N+1 queries** hurt even with SQLite. Batch with window functions wherever possible.

8. **Recharts** is perfect for declarative React charts. D3 is overkill unless you need custom interactions.

---

## Future Work

### Potential Improvements
1. **Merge optimization branch**: LRU cache + compression + aggregation tables
2. **Client-side caching**: Service workers for offline support
3. **Incremental updates**: Only fetch new transactions instead of full CSV
4. **Advanced filters**: Date range pickers, multi-select dropdowns
5. **Export functionality**: Allow users to download filtered datasets
6. **PWA**: Installable app with offline mode
7. **Geospatial viz**: Map view of transactions by town/district

### Scaling Considerations
If traffic grows beyond free tier capacity:
1. Migrate to PostgreSQL with read replicas
2. Add Redis for distributed caching
3. CDN for frontend (Cloudflare)
4. Horizontal scale backend (multiple Render instances + load balancer)
5. Move to S3/R2 for data storage (eliminate Git LFS)

---

## References

- **Commits**: See git log for implementation details
- **Database Schema**: `backend/src/main.js:101-122`
- **API Endpoints**: `backend/src/server.js:100-917`
- **Frontend Components**: `frontend/src/components/`
- **Data Pipeline**: `.github/workflows/data-pipeline.yml`
