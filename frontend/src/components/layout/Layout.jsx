import Header from './Header';
import FilterPanel from '../analytics/FilterPanel';

export default function Layout({ children, dataset, view, onViewChange, searchQuery, onSearchChange, filters, onFiltersChange, isUpdating }) {
  const lastUpdated = dataset?.metadata?.lastUpdated
    ? new Date(dataset.metadata.lastUpdated).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header view={view} onViewChange={onViewChange} searchQuery={searchQuery} onSearchChange={onSearchChange} />
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} isUpdating={isUpdating} />

      <main className="flex-1 w-full max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {children}
      </main>

      <footer className="border-t border-rule">
        <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-5 text-xs text-ink-muted flex flex-wrap gap-x-6 gap-y-1">
          <span>Source: Council for Estate Agencies, Salespersons’ Property Transaction Records (residential), via data.gov.sg</span>
          {lastUpdated && <span>Data refreshed {lastUpdated}</span>}        </div>
      </footer>
    </div>
  );
}
