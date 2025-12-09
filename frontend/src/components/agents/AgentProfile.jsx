import { useAgentProfile } from '../../hooks/useAnalytics';
import PieChart from '../visualizations/PieChart';
import LineChart from '../visualizations/LineChart';
import BarChart from '../visualizations/BarChart';

export default function AgentProfile({ datasetId, regNum, onBack }) {
  const { data: profile, loading, error } = useAgentProfile(datasetId, regNum);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading agent profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Profile</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={onBack} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  // Format data for charts
  const propertyTypeChartData = profile.propertyTypes.map(pt => ({
    name: pt.type,
    value: pt.count
  }));

  const transactionTypeChartData = profile.transactionTypes.map(tt => ({
    name: tt.type,
    value: tt.count
  }));

  const representationChartData = profile.representation.map(r => ({
    name: r.type,
    value: r.count
  }));

  const townChartData = profile.topTowns.map(t => ({
    name: t.town,
    count: t.count
  }));

  const activityChartData = profile.monthlyActivity.map(m => ({
    period: m.period,
    count: m.count
  }));

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
      >
        ← Back to All Agents
      </button>

      {/* Agent Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{profile.agent.name}</h2>
            <p className="text-gray-500 mt-1 font-mono">Reg #{profile.agent.regNum}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Transactions</div>
            <div className="text-4xl font-bold text-primary-600">
              {profile.agent.totalTransactions.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Active Period</div>
              <div className="font-semibold">
                {profile.dateRange.start} - {profile.dateRange.end}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Most Common Property Type</div>
              <div className="font-semibold">{profile.propertyTypes[0].type}</div>
              <div className="text-sm text-gray-600">{profile.propertyTypes[0].percentage}% of transactions</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Primary Transaction Type</div>
              <div className="font-semibold">{profile.transactionTypes[0].type}</div>
              <div className="text-sm text-gray-600">{profile.transactionTypes[0].percentage}% of transactions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Over Time */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Transaction Activity Over Time</h3>
        <LineChart
          data={activityChartData}
          xKey="period"
          lines={['count']}
          title="Monthly Transaction Volume"
        />
      </div>

      {/* Distribution Charts */}
      <div>
        <h3 className="text-xl font-bold mb-4">Transaction Breakdown</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <PieChart
              data={propertyTypeChartData}
              dataKey="value"
              nameKey="name"
              title="Property Types"
            />
          </div>
          <div className="card">
            <PieChart
              data={transactionTypeChartData}
              dataKey="value"
              nameKey="name"
              title="Transaction Types"
            />
          </div>
          <div className="card">
            <PieChart
              data={representationChartData}
              dataKey="value"
              nameKey="name"
              title="Representation"
            />
          </div>
        </div>
      </div>

      {/* Top Towns */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Top 10 Towns by Activity</h3>
        <BarChart
          data={townChartData}
          xKey="name"
          yKey="count"
          title="Transaction Count by Town"
        />
      </div>

      {/* Detailed Statistics Tables */}
      <div>
        <h3 className="text-xl font-bold mb-4">Detailed Statistics</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Property Types Table */}
          <div className="card">
            <h4 className="font-semibold mb-3">Property Type Distribution</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-right py-2 text-sm font-semibold text-gray-700">Count</th>
                    <th className="text-right py-2 text-sm font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.propertyTypes.map((pt, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 text-sm">{pt.type}</td>
                      <td className="py-2 text-sm text-right font-medium">{pt.count}</td>
                      <td className="py-2 text-sm text-right text-primary-600">{pt.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction Types Table */}
          <div className="card">
            <h4 className="font-semibold mb-3">Transaction Type Distribution</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-right py-2 text-sm font-semibold text-gray-700">Count</th>
                    <th className="text-right py-2 text-sm font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.transactionTypes.map((tt, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 text-sm">{tt.type}</td>
                      <td className="py-2 text-sm text-right font-medium">{tt.count}</td>
                      <td className="py-2 text-sm text-right text-primary-600">{tt.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Representation Table */}
          <div className="card">
            <h4 className="font-semibold mb-3">Representation Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-right py-2 text-sm font-semibold text-gray-700">Count</th>
                    <th className="text-right py-2 text-sm font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.representation.map((r, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 text-sm">{r.type}</td>
                      <td className="py-2 text-sm text-right font-medium">{r.count}</td>
                      <td className="py-2 text-sm text-right text-primary-600">{r.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Towns Table */}
          <div className="card">
            <h4 className="font-semibold mb-3">Top Towns</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-semibold text-gray-700">Town</th>
                    <th className="text-right py-2 text-sm font-semibold text-gray-700">Count</th>
                    <th className="text-right py-2 text-sm font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.topTowns.map((t, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 text-sm">{t.town}</td>
                      <td className="py-2 text-sm text-right font-medium">{t.count}</td>
                      <td className="py-2 text-sm text-right text-primary-600">{t.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
