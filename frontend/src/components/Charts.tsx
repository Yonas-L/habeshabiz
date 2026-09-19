import React, { useState } from 'react';

interface DataPoint {
  label: string;
  revenue: number;
  profit: number;
  count: number;
}

interface RevenueTrendChartProps {
  data?: DataPoint[];
  currency?: string;
}

// Default 14-day sample trend based on December 2025 activity
const defaultTrend: DataPoint[] = [
  { label: 'Dec 01', revenue: 145000, profit: 12000, count: 2 },
  { label: 'Dec 03', revenue: 210000, profit: 18000, count: 3 },
  { label: 'Dec 05', revenue: 95000, profit: 8500, count: 1 },
  { label: 'Dec 08', revenue: 320000, profit: 26000, count: 4 },
  { label: 'Dec 10', revenue: 180000, profit: 15000, count: 2 },
  { label: 'Dec 12', revenue: 410000, profit: 34000, count: 5 },
  { label: 'Dec 15', revenue: 290000, profit: 24000, count: 3 },
  { label: 'Dec 18', revenue: 360000, profit: 31000, count: 4 },
  { label: 'Dec 20', revenue: 175000, profit: 14000, count: 2 },
  { label: 'Dec 22', revenue: 490000, profit: 42000, count: 6 },
  { label: 'Dec 25', revenue: 260000, profit: 21000, count: 3 },
  { label: 'Dec 28', revenue: 530000, profit: 46000, count: 6 },
];

export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  data = defaultTrend,
  currency = 'ETB',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 100000);
  const chartHeight = 160;
  const chartWidth = 600;
  const paddingX = 20;
  const paddingY = 20;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  // Calculate coordinates
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * usableWidth;
    const y = chartHeight - paddingY - (d.revenue / maxRevenue) * usableHeight;
    return { x, y, ...d };
  });

  // SVG path for line
  const linePath = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  // SVG path for area fill
  const areaPath = `${linePath} L ${points[points.length - 1].x},${chartHeight - paddingY} L ${points[0].x},${chartHeight - paddingY} Z`;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            14-Day Sales Trajectory
          </span>
          <div className="text-xl font-semibold text-slate-900 font-mono tracking-tight mt-0.5">
            {activePoint.revenue.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
        </div>
        <div className="text-right text-xs">
          <span className="text-slate-500 font-medium">{activePoint.label}</span>
          <span className="text-slate-400 text-[11px] block">
            {activePoint.count} sales &bull; +{activePoint.profit.toLocaleString()} ETB Margin
          </span>
        </div>
      </div>

      <div className="relative w-full h-[160px] bg-slate-50/50 rounded-md border border-slate-100 overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Hairline Grid Lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={chartWidth - paddingX}
            y2={paddingY}
            stroke="#e2e8f0"
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={chartHeight / 2}
            x2={chartWidth - paddingX}
            y2={chartHeight / 2}
            stroke="#e2e8f0"
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={chartHeight - paddingY}
            x2={chartWidth - paddingX}
            y2={chartHeight - paddingY}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#revenueGradient)" />

          {/* Curve Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#0f172a"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((pt, i) => (
            <g key={i}>
              {hoveredIdx === i && (
                <line
                  x1={pt.x}
                  y1={paddingY}
                  x2={pt.x}
                  y2={chartHeight - paddingY}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredIdx === i ? 4.5 : 2.5}
                fill={hoveredIdx === i ? '#0f172a' : '#ffffff'}
                stroke="#0f172a"
                strokeWidth="1.5"
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-1 font-mono">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};

interface CapitalCompositionProps {
  stock: number;
  receivables: number;
  cashAndBanks: number;
  customAssets: number;
  payables: number;
}

export const CapitalCompositionBar: React.FC<CapitalCompositionProps> = ({
  stock,
  receivables,
  cashAndBanks,
  customAssets,
  payables,
}) => {
  const positiveTotal = stock + receivables + cashAndBanks + customAssets;

  const stockPct = positiveTotal > 0 ? (stock / positiveTotal) * 100 : 0;
  const recPct = positiveTotal > 0 ? (receivables / positiveTotal) * 100 : 0;
  const cashPct = positiveTotal > 0 ? (cashAndBanks / positiveTotal) * 100 : 0;
  const assetPct = positiveTotal > 0 ? (customAssets / positiveTotal) * 100 : 0;

  return (
    <div className="w-full space-y-3">
      {/* Proportion Bar */}
      <div className="h-3 w-full bg-slate-100 rounded flex overflow-hidden border border-slate-200/80">
        <div
          style={{ width: `${stockPct}%` }}
          className="bg-slate-800 hover:opacity-90 transition-all cursor-pointer"
          title={`Stock: ${stock.toLocaleString()} ETB (${stockPct.toFixed(1)}%)`}
        />
        <div
          style={{ width: `${recPct}%` }}
          className="bg-emerald-600 hover:opacity-90 transition-all cursor-pointer"
          title={`Receivables: ${receivables.toLocaleString()} ETB (${recPct.toFixed(1)}%)`}
        />
        <div
          style={{ width: `${cashPct}%` }}
          className="bg-sky-600 hover:opacity-90 transition-all cursor-pointer"
          title={`Cash & Banks: ${cashAndBanks.toLocaleString()} ETB (${cashPct.toFixed(1)}%)`}
        />
        <div
          style={{ width: `${assetPct}%` }}
          className="bg-amber-500 hover:opacity-90 transition-all cursor-pointer"
          title={`Gold & FX: ${customAssets.toLocaleString()} ETB (${assetPct.toFixed(1)}%)`}
        />
      </div>

      {/* Legend & Breakdown with zero nesting */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-slate-800 shrink-0" />
          <div className="truncate">
            <span className="text-slate-500 block text-[11px]">Stock</span>
            <span className="font-semibold text-slate-900 font-mono">{stock.toLocaleString()} ETB</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shrink-0" />
          <div className="truncate">
            <span className="text-slate-500 block text-[11px]">Customer Debts</span>
            <span className="font-semibold text-emerald-700 font-mono">+{receivables.toLocaleString()} ETB</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 shrink-0" />
          <div className="truncate">
            <span className="text-slate-500 block text-[11px]">Bank & Wallets</span>
            <span className="font-semibold text-slate-900 font-mono">+{cashAndBanks.toLocaleString()} ETB</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
          <div className="truncate">
            <span className="text-slate-500 block text-[11px]">Gold & FX</span>
            <span className="font-semibold text-slate-900 font-mono">+{customAssets.toLocaleString()} ETB</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 shrink-0" />
          <div className="truncate">
            <span className="text-slate-500 block text-[11px]">Payables</span>
            <span className="font-semibold text-rose-700 font-mono">-{payables.toLocaleString()} ETB</span>
          </div>
        </div>
      </div>
    </div>
  );
};
