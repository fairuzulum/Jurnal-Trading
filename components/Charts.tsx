import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { formatCurrency, formatDate } from '../constants';
import { Trade } from '../types';

interface ChartProps {
  data: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const WIN_COLOR = '#10b981'; // emerald-500
const LOSS_COLOR = '#ef4444'; // red-500

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {formatter ? formatter(payload[0].value) : payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export const EquityChart: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  // Sort trades ascending by date for the line chart
  const sortedTrades = [...trades].sort((a, b) => a.date - b.date);
  
  let cumulative = 0;
  const data = sortedTrades.map(t => {
    cumulative += t.profit;
    return {
      date: formatDate(t.date),
      equity: cumulative,
      originalDate: t.date
    };
  });

  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">No data for Equity Curve</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
        <XAxis 
          dataKey="date" 
          stroke="#9ca3af" 
          fontSize={12} 
          tickFormatter={(val) => val} 
          minTickGap={30}
        />
        <YAxis stroke="#9ca3af" fontSize={12} />
        <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
        <Line 
          type="monotone" 
          dataKey="equity" 
          stroke="#0ea5e9" 
          strokeWidth={2} 
          dot={false}
          activeDot={{ r: 6 }} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const DailyPLChart: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const dailyMap = new Map<string, number>();

  trades.forEach(t => {
    const d = formatDate(t.date);
    dailyMap.set(d, (dailyMap.get(d) || 0) + t.profit);
  });

  const data = Array.from(dailyMap.entries()).map(([date, profit]) => ({ date, profit }));
  // Sort by date roughly (parsing string date is tricky, ideally sort by timestamp before map)
  // Let's rely on trades being sorted in parent or sort properly here
  // Ideally, grouping should be done on sorted source.
  
  // Re-sort data by timestamp to be safe
  const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">No data for Daily P/L</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={sortedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
        <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
        <YAxis stroke="#9ca3af" fontSize={12} />
        <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
        <Bar dataKey="profit">
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? WIN_COLOR : LOSS_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const WinRatePieChart: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const wins = trades.filter(t => t.result === 'Win').length;
  const losses = trades.filter(t => t.result === 'Loss').length;
  const be = trades.filter(t => t.result === 'BreakEven').length;

  const data = [
    { name: 'Win', value: wins },
    { name: 'Loss', value: losses },
    { name: 'BreakEven', value: be },
  ].filter(d => d.value > 0);

  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">No data</div>;

  const PIE_COLORS = { 'Win': WIN_COLOR, 'Loss': LOSS_COLOR, 'BreakEven': '#9ca3af' };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};
