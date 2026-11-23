import { SearchIcon, CloseIcon } from '../ui/Icons';

const VIEWS = [
  { id: 'agents', label: 'Salespersons' },
  { id: 'market', label: 'Market' },
];

export default function Header({ view, onViewChange, searchQuery, onSearchChange }) {
  return (
    <header className="bg-ink text-white">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center gap-x-8 gap-y-3">
        <span className="text-xl font-bold tracking-tight">CEA-VIZ</span>

        <nav className="flex gap-6 order-3 md:order-none" aria-label="Views">
          {VIEWS.map(item => {
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`py-2 text-[15px] font-semibold border-b-[3px] transition-colors duration-150 ${
                  isActive ? 'border-signal text-white' : 'border-transparent text-[#b8b8b4] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="relative flex-1 min-w-[240px] md:max-w-md md:ml-auto">
          <label htmlFor="agent-search" className="sr-only">Search salespersons by name or registration number</label>
          <SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            id="agent-search"
            type="search"
            value={searchQuery}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Name or registration no."
            autoComplete="off"
            spellCheck={false}
            className="w-full h-11 rounded-full bg-white text-ink pl-11 pr-11 text-[15px] placeholder:text-ink-muted focus:outline-none focus-visible:ring-[3px] focus-visible:ring-signal [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-wash"
              aria-label="Clear search"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
