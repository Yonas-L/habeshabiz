import React, { useState } from 'react';

interface DataPoint {
  day: string;
  revenue: number;
  profit: number;
  orders: number;
}

// 14-day sample derived from December 2025 actual trading patterns
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

export const InteractiveSalesWaveChart: React.FC<{ data?: DataPoint[]; currency?: string }> = ({
  data = defaultData,
  currency = 'ETB',
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [metric, setMetric] = useState<'revenue' | 'profit'>('revenue');

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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sales & Profit Wave
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              +24.8% vs last month
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight mt-0.5">
            {activePoint.val.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500 font-sans">{currency}</span>
          </div>
        </div>

        {/* Metric Selector Pills */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-medium self-start sm:self-auto">
          <button
            onClick={() => setMetric('revenue')}
            className={`px-3 py-1 rounded-lg transition-all ${
              metric === 'revenue'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Gross Sales
          </button>
          <button
            onClick={() => setMetric('profit')}
            className={`px-3 py-1 rounded-lg transition-all ${
              metric === 'profit'
                ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Gross Margin
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full h-[180px] bg-gradient-to-b from-slate-50/70 to-transparent rounded-xl border border-slate-100/90 overflow-hidden">
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
            stroke="#e2e8f0"
            strokeWidth="0.8"
            strokeDasharray="4 4"
          />
          <line
            x1={padX}
            y1={height / 2}
            x2={width - padX}
            y2={height / 2}
            stroke="#e2e8f0"
            strokeWidth="0.8"
            strokeDasharray="4 4"
          />
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Shaded Area */}
          <path d={areaPath} fill={metric === 'revenue' ? 'url(#indigoWave)' : 'url(#emeraldWave)'} />

          {/* Bezier Stroke Curve */}
          <path
            d={curvePath}
            fill="none"
            stroke={metric === 'revenue' ? '#4f46e5' : '#059669'}
            strokeWidth="2.5"
            strokeLinecap="round"
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
                r={hoverIndex === i ? 5.5 : 3}
                fill={hoverIndex === i ? (metric === 'revenue' ? '#4f46e5' : '#059669') : '#ffffff'}
                stroke={metric === 'revenue' ? '#4f46e5' : '#059669'}
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
            className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-xl text-xs font-mono whitespace-nowrap animate-modal-enter"
            style={{
              left: `${(points[hoverIndex].x / width) * 100}%`,
              top: `${Math.max(points[hoverIndex].y - 12, 10)}px`,
            }}
          >
            <div className="font-semibold">{points[hoverIndex].val.toLocaleString()} ETB</div>
            <div className="text-[10px] text-slate-300 font-sans flex items-center gap-1.5">
              <span>{points[hoverIndex].day}</span>
              <span>&bull;</span>
              <span>{points[hoverIndex].orders} sales</span>
            </div>
          </div>
        )}
      </div>

      {/* Axis Labels */}
      <div className="flex justify-between text-[11px] text-slate-400 mt-2 px-1 font-mono">
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
      ? 'bg-emerald-500'
      : color === 'indigo'
      ? 'bg-indigo-500'
      : color === 'amber'
      ? 'bg-amber-500'
      : color === 'blue'
      ? 'bg-blue-500'
      : color === 'purple'
      ? 'bg-purple-500'
      : 'bg-slate-700';

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

// Donut Chart for Capital Composition
export const DonutCapitalChart: React.FC<{
  stock: number;
  receivables: number;
  treasury: number;
  assets: number;
}> = ({ stock, receivables, treasury, assets }) => {
  const total = stock + receivables + treasury + assets;
  const radius = 42;
  const stroke = 12;
  const circum = 2 * Math.PI * radius;

  const stockPct = total > 0 ? stock / total : 0;
  const recPct = total > 0 ? receivables / total : 0;
  const treasPct = total > 0 ? treasury / total : 0;
  const assetPct = total > 0 ? assets / total : 0;

  const stockOffset = 0;
  const recOffset = circum * stockPct;
  const treasOffset = circum * (stockPct + recPct);
  const assetOffset = circum * (stockPct + recPct + treasPct);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG Ring */}
      <div className="relative w-32 h-32 shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={stroke}
          />
          {/* Stock segment */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#0f172a"
            strokeWidth={stroke}
            strokeDasharray={`${circum * stockPct} ${circum}`}
            strokeDashoffset={-stockOffset}
            className="transition-all duration-500"
          />
          {/* Receivables segment */}
          <circle
            cx="60"
            cy="60"
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
            cx="60"
            cy="60"
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
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={stroke}
            strokeDasharray={`${circum * assetPct} ${circum}`}
            strokeDashoffset={-assetOffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Assets</span>
          <span className="text-xs font-bold font-mono text-slate-900">
            {((total / 1000000)).toFixed(2)}M
          </span>
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs w-full">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[10px]">Stock ({(stockPct * 100).toFixed(0)}%)</span>
            <span className="font-semibold text-slate-900 font-mono">{stock.toLocaleString()} ETB</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[10px]">Debts ({(recPct * 100).toFixed(0)}%)</span>
            <span className="font-semibold text-emerald-700 font-mono">+{receivables.toLocaleString()} ETB</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[10px]">Treasury ({(treasPct * 100).toFixed(0)}%)</span>
            <span className="font-semibold text-slate-900 font-mono">+{treasury.toLocaleString()} ETB</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <div className="truncate">
            <span className="text-slate-400 block text-[10px]">Gold/FX ({(assetPct * 100).toFixed(0)}%)</span>
            <span className="font-semibold text-slate-900 font-mono">+{assets.toLocaleString()} ETB</span>
          </div>
        </div>
      </div>
    </div>
  );
};
