import { useState } from 'react';
import { useMarketInsights, useMultiDimensionalAnalytics, useTimeSeriesData } from '../../hooks/useAnalytics';
import PieChart from '../visualizations/PieChart';
import BarChart from '../visualizations/BarChart';
import LineChart from '../visualizations/LineChart';
import FilterPanel from './FilterPanel';

export default function AnalyticsDashboard({ datasetId }) {
  const [filters, setFilters] = useState({});

  const { data: insights, loading: insightsLoading } = useMarketInsights(datasetId, filters);
  const { data: transactionTypeData } = useMultiDimensionalAnalytics(datasetId, 'transaction_type', null, filters);
  const { data: representedData } = useMultiDimensionalAnalytics(datasetId, 'represented', null, filters);
  const { data: propertyTypeData } = useMultiDimensionalAnalytics(datasetId, 'property_type', null, filters);
  const { data: timeSeriesData } = useTimeSeriesData(datasetId, 'month', null, filters);

  if (insightsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">No analytics data available</div>
      </div>
    );
  }

  // Use chart-ready data from backend
  const transactionTypeChartData = transactionTypeData?.chartData || [];
  const representedChartData = representedData?.chartData || [];
  const propertyTypeChartData = propertyTypeData?.data?.slice(0, 5).map(item => ({
    name: item[propertyTypeData.dimensions[0]],
    count: item.count
  })) || [];
  const timeSeriesChartData = timeSeriesData?.chartData || [];

  return (
    <div className="space-y-8">
      {/* Filter Panel */}
      <FilterPanel filters={filters} onFiltersChange={setFilters} />

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Total Transactions</div>
          <div className="text-2xl font-bold">{insights.summary.totalTransactions.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Date Range</div>
          <div className="text-2xl font-bold text-sm">
            {insights.summary.dateRange.start} to {insights.summary.dateRange.end}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Monthly Average</div>
          <div className="text-2xl font-bold">{insights.trends.monthlyAverage.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Yearly Growth</div>
          <div className={`text-2xl font-bold ${parseFloat(insights.trends.yearlyGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {insights.trends.yearlyGrowth}
          </div>
        </div>
      </div>

      {/* Transaction Patterns Section */}
      <div>
        <h3 className="text-xl font-bold mb-4">Transaction Patterns</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              data={representedChartData}
              dataKey="value"
              nameKey="name"
              title="Buyer vs Seller Representation"
            />
          </div>
        </div>
      </div>

      {/* Temporal Trends Section */}
      <div>
        <h3 className="text-xl font-bold mb-4">Transaction Volume Over Time</h3>
        <div className="card">
          <LineChart
            data={timeSeriesChartData}
            xKey="period"
            lines={['count']}
            title="Monthly Transactions (Last 24 Months)"
          />
        </div>
      </div>

      {/* Market Composition Section */}
      <div>
        <h3 className="text-xl font-bold mb-4">Market Composition</h3>
        <div className="card">
          <BarChart
            data={propertyTypeChartData}
            xKey="name"
            yKey="count"
            title="Top Property Types"
          />
        </div>
      </div>

      {/* Distribution Tables */}
      <div>
        <h3 className="text-xl font-bold mb-4">Detailed Distributions</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <h4 className="font-semibold mb-3">Property Types</h4>
            <div className="space-y-2">
              {insights.distributions.propertyTypes.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-semibold">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h4 className="font-semibold mb-3">Transaction Types</h4>
            <div className="space-y-2">
              {insights.distributions.transactionTypes.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-semibold">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h4 className="font-semibold mb-3">Representation</h4>
            <div className="space-y-2">
              {insights.distributions.represented.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-semibold">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
