import { BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function BarChart({ data, xKey, yKey, title, color = '#0ea5e9' }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div>
      {title && <h4 className="text-lg font-semibold mb-4">{title}</h4>}
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBar data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={yKey} fill={color} />
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  );
}
