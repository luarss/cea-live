import { useState, useEffect } from 'react';
import { useTopAgents } from '../../hooks/useAnalytics';
import AgentProfile from './AgentProfile';
import FilterPanel from '../analytics/FilterPanel';

export default function AgentInsights({ datasetId }) {
  const [filters, setFilters] = useState({});
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query with shorter delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: agentData, loading } = useTopAgents(datasetId, displayLimit, filters, debouncedSearch);

  // Use the agents from the API response (backend already applies search filter)
  const filteredAgents = agentData?.agents || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading agent insights...</div>
      </div>
    );
  }

  if (!agentData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">No agent data available</div>
      </div>
    );
  }

  // If an agent is selected, show their profile
  if (selectedAgent) {
    return (
      <AgentProfile
        datasetId={datasetId}
        regNum={selectedAgent}
        onBack={() => setSelectedAgent(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Panel */}
      <FilterPanel filters={filters} onFiltersChange={setFilters} />

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by agent name or registration number..."
            className="w-full px-4 py-3 pl-10 pr-4 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Total Agents</div>
          <div className="text-2xl font-bold">{agentData.total.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Showing Results</div>
          <div className="text-2xl font-bold">{filteredAgents.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Display Limit</div>
          <select
            value={displayLimit}
            onChange={(e) => setDisplayLimit(parseInt(e.target.value))}
            className="mt-1 text-lg font-semibold border-none bg-transparent focus:outline-none cursor-pointer"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>
      </div>

      {/* Top Agents Leaderboard */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Top Agents by Transaction Volume</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Agent Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Registration #</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Transactions</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Top Property Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Top Transaction Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Primary Role</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent, index) => (
                <tr
                  key={agent.regNum}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      {index < 3 ? (
                        <span className="text-2xl">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="font-semibold text-gray-600">#{index + 1}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{agent.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-500 font-mono">{agent.regNum}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-bold text-primary-600">{agent.totalTransactions.toLocaleString()}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm">
                      <div className="font-medium">{agent.topPropertyType[0]}</div>
                      <div className="text-gray-500">{agent.topPropertyType[1]} txns</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm">
                      <div className="font-medium">{agent.topTransactionType[0]}</div>
                      <div className="text-gray-500">{agent.topTransactionType[1]} txns</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm">
                      <div className="font-medium">{agent.topRepresentation[0]}</div>
                      <div className="text-gray-500">
                        {((agent.topRepresentation[1] / agent.totalTransactions) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedAgent(agent.regNum)}
                      className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                    >
                      View Profile →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution Insights */}
      {filteredAgents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 Agents Chart */}
          <div className="card">
            <h4 className="font-semibold mb-4">Top 10 Agents by Volume</h4>
            <div className="space-y-3">
              {filteredAgents.slice(0, 10).map((agent, index) => (
              <div key={agent.regNum} className="flex items-center gap-3">
                <div className="w-8 text-sm font-semibold text-gray-600">#{index + 1}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-sm font-medium truncate">{agent.name}</div>
                    <div className="text-sm font-bold text-primary-600 ml-2">
                      {agent.totalTransactions}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(agent.totalTransactions / filteredAgents[0].totalTransactions) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Coverage */}
        <div className="card">
          <h4 className="font-semibold mb-4">Market Coverage Statistics</h4>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Average Transactions per Agent</div>
              <div className="text-2xl font-bold">
                {agentData.statistics.averageTransactions.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Top Agent Market Share</div>
              <div className="text-2xl font-bold text-primary-600">
                {agentData.statistics.topAgentMarketShare}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Top 10 Combined Market Share</div>
              <div className="text-2xl font-bold text-primary-600">
                {agentData.statistics.top10MarketShare}%
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
