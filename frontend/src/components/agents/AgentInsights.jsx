import { useState, useEffect, useRef } from 'react';
import { useTopAgents } from '../../hooks/useAnalytics';
import AgentProfile from './AgentProfile';
import PropertyChip from '../ui/PropertyChip';
import { formatLocation, formatNumber, representationLabel, titleCase, transactionLabel } from '../../lib/format';

const LIMIT_OPTIONS = [25, 50, 100, 250];

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function TableSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading salespersons">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="h-14 border-b border-rule flex items-center gap-4">
          <div className="h-4 w-6 bg-wash" />
          <div className="h-4 flex-1 bg-wash" />
          <div className="h-4 w-24 bg-wash" />
        </div>
      ))}
    </div>
  );
}

function AgentRow({ agent, rank, maxTotal, isSelected, onSelect }) {
  const topRepresentation = agent.topRepresentation?.[0];
  const topTransaction = agent.topTransactionType?.[0];

  return (
    <tr
      onClick={() => onSelect(agent.regNum)}
      aria-selected={isSelected}
      className={`border-b border-rule cursor-pointer transition-colors duration-150 ${
        isSelected ? 'bg-signal-wash' : 'hover:bg-wash'
      }`}
    >
      <td className="py-3 pl-2 pr-3 text-sm text-ink-muted tabular w-10 align-top">{rank ?? ''}</td>
      <td className="py-3 pr-4 align-top">
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onSelect(agent.regNum);
          }}
          className="text-left font-semibold hover:underline underline-offset-4 focus-visible:underline"
        >
          {titleCase(agent.name)}
        </button>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-ink-muted tabular">{agent.regNum}</span>
          {agent.topPropertyType?.[0] && (
            <span className="md:hidden"><PropertyChip value={agent.topPropertyType[0]} /></span>
          )}
        </div>
      </td>
      <td className="py-3 pr-4 align-top w-24 sm:w-40">
        <div className="text-right font-bold tabular">{formatNumber(agent.totalTransactions)}</div>
        <div className="mt-1.5 h-1.5 bg-wash hidden sm:block" aria-hidden="true">
          <div className="h-full bg-ink" style={{ width: `${(agent.totalTransactions / maxTotal) * 100}%` }} />
        </div>
      </td>
      <td className="py-3 pr-4 align-top hidden md:table-cell">
        <div className="flex items-center gap-2">
          {agent.topPropertyType?.[0] && <PropertyChip value={agent.topPropertyType[0]} />}
          <span className="text-sm text-ink-soft whitespace-nowrap">
            {topTransaction && transactionLabel(topTransaction)}
            {topRepresentation && ` · ${representationLabel(topRepresentation).toLowerCase()}`}
          </span>
        </div>
      </td>
      <td className="py-3 pr-2 align-top text-sm hidden xl:table-cell whitespace-nowrap" title={formatLocation(agent.topTown?.[0], { full: true })}>
        {agent.topTown?.[0] ? formatLocation(agent.topTown[0]) : <span className="text-ink-muted">Not recorded</span>}
      </td>
    </tr>
  );
}

export default function AgentInsights({ datasetId, filters, searchQuery, marketInsights, onLoadingChange }) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [isProfileOpenOnMobile, setIsProfileOpenOnMobile] = useState(false);
  const profileRef = useRef(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const { data: agentData, loading, error } = useTopAgents(datasetId, displayLimit, filters, debouncedSearch);
  const agents = agentData?.agents || [];
  const isSearching = Boolean(debouncedSearch?.trim());
  const isSelectionVisible = agents.some(agent => agent.regNum === selectedAgent);
  const activeAgent = isSelectionVisible || !agents.length ? selectedAgent : agents[0].regNum;

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  const handleSelect = (regNum) => {
    setSelectedAgent(regNum);
    setIsProfileOpenOnMobile(true);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => profileRef.current?.scrollIntoView({ block: 'start' }));
    }
  };

  const maxTotal = Math.max(...agents.map(agent => agent.totalTransactions), 1);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px] gap-x-10 gap-y-8">
      <section aria-labelledby="ranking-heading" className={isProfileOpenOnMobile ? 'hidden lg:block' : ''}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3 border-b-2 border-ink">
          <div>
            <h1 id="ranking-heading" className="text-2xl font-bold">
              {isSearching ? `Results for “${debouncedSearch.trim()}”` : 'Most active salespersons'}
            </h1>
            {agentData && (
              <p className="text-sm text-ink-muted mt-0.5 tabular">
                {formatNumber(agentData.total)} {isSearching ? 'matching' : 'active'} salespersons
              </p>
            )}
          </div>
          <label className="text-sm text-ink-soft flex items-center gap-2">
            Show
            <select
              value={displayLimit}
              onChange={event => setDisplayLimit(parseInt(event.target.value, 10))}
              className="h-8 border border-[#c9c9c5] bg-white px-2 font-semibold text-ink tabular hover:border-ink"
            >
              {LIMIT_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        {error && !agentData && (
          <p className="py-10 text-ink-soft">Couldn’t load salespersons ({error}). Check your connection and reload.</p>
        )}

        {!agentData && !error && <TableSkeleton />}

        {agentData && agents.length === 0 && (
          <div className="py-12 max-w-md">
            <p className="font-semibold">No salesperson matches “{debouncedSearch}”.</p>
            <p className="text-sm text-ink-soft mt-1">
              Check the spelling, try part of the name, or search the registration number (e.g. R043039D). Filters above also narrow the list.
            </p>
          </div>
        )}

        {agents.length > 0 && (
          <div className={`overflow-x-auto transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-ink-muted border-b border-rule">
                  <th scope="col" className="py-2 pl-2 pr-3 font-semibold"><span className="sr-only">Rank</span>#</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Salesperson</th>
                  <th scope="col" className="py-2 pr-4 font-semibold text-right">Transactions</th>
                  <th scope="col" className="py-2 pr-4 font-semibold hidden md:table-cell">Mostly</th>
                  <th scope="col" className="py-2 pr-2 font-semibold hidden xl:table-cell">Top area</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, index) => (
                  <AgentRow
                    key={agent.regNum}
                    agent={agent}
                    rank={isSearching ? null : index + 1}
                    maxTotal={maxTotal}
                    isSelected={agent.regNum === activeAgent}
                    onSelect={handleSelect}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside
        ref={profileRef}
        aria-label="Salesperson record"
        className={`${isProfileOpenOnMobile ? '' : 'hidden lg:block'} lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-3 panel-scroll`}
      >
        {agents.length > 0 && (
          <AgentProfile
            datasetId={datasetId}
            regNum={activeAgent}
            filters={filters}
            marketInsights={marketInsights}
            onClose={() => setIsProfileOpenOnMobile(false)}
          />
        )}
      </aside>
    </div>
  );
}
