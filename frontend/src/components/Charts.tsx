import React, { useState, useEffect } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

interface DataPoint {
  day: string;
  revenue: number;
  profit: number;
  orders: number;
}

// 14-day sample derived from December trading patterns
const defaultData: DataPoint[] = [
  { day: 'Dec 01', revenue: 145000, profit: 14200, orders: 2 },
  { day: 'Dec 03', revenue: 220000, profit: 21500, orders: 3 },
  { day: 'Dec 05', revenue: 95000, profit: 9200, orders: 1 },
  { day: 'Dec 08', revenue: 340000, profit: 32000, orders: 4 },
  { day: 'Dec 10', revenue: 180000, profit: 17500, orders: 2 },
  { day: 'Dec 12', revenue: 420000, profit: 39000, orders: 5 },
  { day: 'Dec 15', revenue: 290000, profit: 27000, orders: 3 },
  { day: 'Dec 18', revenue: 380000, profit: 36000, orders: 4 },
  { day: 'Dec 20', revenue: 195000, profit: 18000, orders: 2 },
  { day: 'Dec 22', revenue: 510000, profit: 48000, orders: 6 },
  { day: 'Dec 25', revenue: 280000, profit: 25000, orders: 3 },
  { day: 'Dec 28', revenue: 560000, profit: 52000, orders: 7 },
];

export const InteractiveSalesWaveChart: React.FC<{
  data?: DataPoint[];
  currency?: string;
  canViewCost?: boolean;
}> = ({
  data = defaultData,
  currency = 'ETB',
  canViewCost = true,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [metric, setMetric] = useState<'revenue' | 'profit'>('revenue');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(t);
  }, []);

  const width = 640;
  const height = 180;
  const padX = 24;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const values = data.map((d) => (metric === 'revenue' ? d.revenue : d.profit));
  const maxVal = Math.max(...values, 10000);

  // Generate smooth cubic bezier curve
  const points = data.map((d, i) => {
    const val = metric === 'revenue' ? d.revenue : d.profit;
    const x = padX + (i / (data.length - 1)) * chartW;
    const y = height - padY - (val / maxVal) * chartH;
    return { x, y, ...d, val };
  });

  // Calculate smooth SVG path
  const curvePath = points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = arr[i - 1];
    const cpx1 = prev.x + (pt.x - prev.x) / 2;
    const cpy1 = prev.y;
    const cpx2 = prev.x + (pt.x - prev.x) / 2;
    const cpy2 = pt.y;
    return `${acc} C ${cpx1},${cpy1} ${cpx2},${cpy2} ${pt.x},${pt.y}`;
  }, '');

  const areaPath = `${curvePath} L ${points[points.length - 1].x},${height - padY} L ${points[0].x},${height - padY} Z`;
  const activePoint = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1];

  return (
    <div className="w-full">
      {/* Top Bar of Chart */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Sales
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
            <AnimatedNumber value={activePoint.val} />{' '}
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-sans">{currency}</span>
          </div>
        </div>

        {/* Metric Selector Pills */}
        {canViewCost && (
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-medium self-start sm:self-auto">
            <button
              onClick={() => setMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metric === 'revenue'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Gross Sales
            </button>
            <button
              onClick={() => setMetric('profit')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                metric === 'profit'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Gross Margin
            </button>
          </div>
        )}
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full h-[180px] bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-800/20 dark:to-transparent rounded-xl border border-slate-100/90 dark:border-slate-800/80 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="emeraldWave" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="indigoWave" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Dotted Horizontal Guide Lines */}
          <line
            x1={padX}
            y1={padY}
            x2={width - padX}
            y2={padY}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="0.8"
            strokeDasharray="4 4"
          />
          <line
            x1={padX}
            y1={height / 2}
            x2={width - padX}
            y2={height / 2}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="0.8"
            strokeDasharray="4 4"
          />
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-700"
            strokeWidth="1"
          />

          {/* Shaded Area */}
          <path
            d={areaPath}
            fill={metric === 'revenue' ? 'url(#indigoWave)' : 'url(#emeraldWave)'}
            className={`transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Bezier Stroke Curve */}
          <path
            d={curvePath}
            fill="none"
            stroke={metric === 'revenue' ? '#6366f1' : '#10b981'}
            strokeWidth="2.5"
            strokeLinecap="round"
            className={`transition-all duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Interactive Guides & Points */}
          {points.map((pt, i) => (
            <g key={i}>
              {hoverIndex === i && (
                <line
                  x1={pt.x}
                  y1={padY}
                  x2={pt.x}
                  y2={height - padY}
                  stroke="#94a3b8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoverIndex === i ? 6 : 3.5}
                fill={hoverIndex === i ? (metric === 'revenue' ? '#6366f1' : '#10b981') : '#ffffff'}
                stroke={metric === 'revenue' ? '#6366f1' : '#10b981'}
                strokeWidth="2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          ))}
        </svg>

        {/* Floating Tooltip Pill */}
        {hoverIndex !== null && (
          <div
            className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full bg-slate-900 dark:bg-slate-800 text-white px-3 py-1.5 rounded-xl shadow-xl text-xs font-mono whitespace-nowrap animate-modal-enter border border-slate-700/50"
            style={{
              left: `${(points[hoverIndex].x / width) * 100}%`,
              top: `${Math.max(points[hoverIndex].y - 12, 10)}px`,
            }}
          >
            <div className="font-bold">{points[hoverIndex].val.toLocaleString()} ETB</div>
            <div className="text-[10px] text-slate-300 font-sans flex items-center gap-1.5 mt-0.5">
              <span>{points[hoverIndex].day}</span>
              <span>&bull;</span>
              <span>{points[hoverIndex].orders} orders</span>
            </div>
          </div>
        )}
      </div>

      {/* Axis Labels */}
      <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2 px-1 font-mono font-medium">
        <span>{data[0]?.day}</span>
        <span>{data[Math.floor(data.length / 2)]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
};

// Mini Sparkline component for KPI cards
export const MiniSparkline: React.FC<{
  data?: number[];
  values?: number[];
  color?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'purple' | 'blue';
}> = ({ data, values, color = 'emerald' }) => {
  const chartData = data ?? values ?? [10, 20, 15, 30];
  const w = 72;
  const h = 28;
  const max = Math.max(...chartData, 1);
  const min = Math.min(...chartData, 0);
  const range = max - min || 1;

  const points = chartData
    .map((v, i) => {
      const x = (i / (chartData.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeColor =
    color === 'emerald'
      ? '#10b981'
      : color === 'indigo'
      ? '#6366f1'
      : color === 'amber'
      ? '#f59e0b'
      : color === 'rose'
      ? '#f43f5e'
      : color === 'purple'
      ? '#a855f7'
      : '#3b82f6';

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

// Mini Bar Histogram for KPI cards
export const MiniBarHistogram: React.FC<{
  bars?: number[];
  values?: number[];
  color?: 'emerald' | 'indigo' | 'amber' | 'slate' | 'blue' | 'purple';
}> = ({ bars, values, color = 'emerald' }) => {
  const chartBars = bars ?? values ?? [10, 20, 30, 40];
  const max = Math.max(...chartBars, 1);
  const bgClass =
    color === 'emerald'
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : color === 'indigo'
      ? 'bg-indigo-500 dark:bg-indigo-400'
      : color === 'amber'
      ? 'bg-amber-500 dark:bg-amber-400'
      : color === 'blue'
      ? 'bg-blue-500 dark:bg-blue-400'
      : color === 'purple'
      ? 'bg-purple-500 dark:bg-purple-400'
      : 'bg-slate-700 dark:bg-slate-400';

  return (
    <div className="flex items-end gap-1 h-7">
      {chartBars.map((v, i) => {
        const heightPct = Math.max((v / max) * 100, 15);
        return (
          <div
            key={i}
            style={{ height: `${heightPct}%` }}
            className={`w-1.5 rounded-t-xs ${bgClass} transition-all duration-300 opacity-80 hover:opacity-100`}
          />
        );
      })}
    </div>
  );
};

// Donut Chart for Capital Composition & Asset Allocation
export const DonutCapitalChart: React.FC<{
  stock: number;
  receivables: number;
  treasury: number;
  assets: number;
  payables?: number;
  netProfit?: number;
}> = ({ stock, receivables, treasury, assets, payables = 0, netProfit }) => {
  const grossAssets = stock + receivables + treasury + assets;
  const total = grossAssets + payables;
  const radius = 58;
  const stroke = 15;
  const circum = 2 * Math.PI * radius;

  const stockPct = total > 0 ? stock / total : 0;
  const recPct = total > 0 ? receivables / total : 0;
  const treasPct = total > 0 ? treasury / total : 0;
  const assetPct = total > 0 ? assets / total : 0;
  const payablePct = total > 0 ? payables / total : 0;

  const stockOffset = 0;
  const recOffset = circum * stockPct;
  const treasOffset = circum * (stockPct + recPct);
  const assetOffset = circum * (stockPct + recPct + treasPct);
  const payableOffset = circum * (stockPct + recPct + treasPct + assetPct);

  return (
    <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-5 sm:gap-6">
      {/* SVG Ring (Enlarged) */}
      <div className="relative w-44 h-44 sm:w-48 sm:h-48 shrink-0">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            strokeWidth={stroke}
          />
          {/* Stock segment */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#64748b"
            strokeWidth={stroke}
            strokeDasharray={`${circum * stockPct} ${circum}`}
            strokeDashoffset={-stockOffset}
            className="transition-all duration-500"
          />
          {/* Receivables segment */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth={stroke}
            strokeDasharray={`${circum * recPct} ${circum}`}
            strokeDashoffset={-recOffset}
            className="transition-all duration-500"
          />
          {/* Treasury segment */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={stroke}
            strokeDasharray={`${circum * treasPct} ${circum}`}
            strokeDashoffset={-treasOffset}
            className="transition-all duration-500"
          />
          {/* Assets segment */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={stroke}
            strokeDasharray={`${circum * assetPct} ${circum}`}
            strokeDashoffset={-assetOffset}
            className="transition-all duration-500"
          />
          {/* Payables segment */}
          {payables > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#f43f5e"
              strokeWidth={stroke}
              strokeDasharray={`${circum * payablePct} ${circum}`}
              strokeDashoffset={-payableOffset}
              className="transition-all duration-500"
            />
          )}
        </svg>

        {/* Center Readout: Net Profit */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none px-2">
          <span className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
            Net Profit
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight mt-0.5">
            +{(netProfit ?? 0) >= 1000000
              ? `${((netProfit ?? 0) / 1000000).toFixed(2)}M`
              : (netProfit ?? 0).toLocaleString()}{' '}
            <span className="text-xs font-sans font-bold text-slate-400">ETB</span>
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            Active Period
          </span>
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs w-full">
        <div className="flex items-start gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium">
              Stock ({(stockPct * 100).toFixed(0)}%)
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs truncate block">
              <AnimatedNumber value={stock} /> ETB
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium">
              Receivables ({(recPct * 100).toFixed(0)}%)
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs truncate block">
              +<AnimatedNumber value={receivables} /> ETB
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium">
              Cash ({(treasPct * 100).toFixed(0)}%)
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs truncate block">
              +<AnimatedNumber value={treasury} /> ETB
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium">
              Gold/FX ({(assetPct * 100).toFixed(0)}%)
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs truncate block">
              +<AnimatedNumber value={assets} /> ETB
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 col-span-2 sm:col-span-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium">
              Payables ({payables > 0 ? (payablePct * 100).toFixed(0) : '0'}%)
            </span>
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-xs truncate block">
              −<AnimatedNumber value={payables} /> ETB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
