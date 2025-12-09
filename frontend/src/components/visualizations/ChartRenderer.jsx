import React from 'react';
import { prepareChartData } from '../../utils/chartSelector';
import LineChartComponent from './LineChart';
import BarChartComponent from './BarChart';
import PieChartComponent from './PieChart';
import ScatterPlotComponent from './ScatterPlot';
import DataTable from './DataTable';

export default function ChartRenderer({ recommendation, dataset }) {
  if (!recommendation || !dataset) {
    return (
      <div className="text-center py-12 text-gray-500">
        No visualization available
      </div>
    );
  }

  const { type, config, reasoning } = recommendation;
  const chartData = prepareChartData(recommendation, dataset);

  const renderChart = () => {
    switch (type) {
      case 'line':
        return <LineChartComponent data={chartData} config={config} />;
      case 'bar':
        return <BarChartComponent data={chartData} config={config} />;
      case 'pie':
        return <PieChartComponent data={chartData} config={config} />;
      case 'scatter':
        return <ScatterPlotComponent data={chartData} config={config} />;
      case 'table':
        return <DataTable data={chartData} schema={dataset.schema} />;
      default:
        return (
          <div className="text-center py-12 text-gray-500">
            Unsupported chart type: {type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Chart Title and Reasoning */}
      <div>
        <h4 className="text-md font-semibold text-gray-800">{config.title}</h4>
        {reasoning && (
          <p className="text-sm text-gray-500 mt-1">{reasoning}</p>
        )}
      </div>

      {/* Chart */}
      <div className="bg-gray-50 rounded-lg p-4">
        {renderChart()}
      </div>
    </div>
  );
}
