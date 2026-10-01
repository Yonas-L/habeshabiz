import React, { useState, useEffect, useRef } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { BarChart3, LineChart } from 'lucide-react';


export interface DataPoint {
  day: string;
  revenue: number;
  profit: number;
  orders: number;
  date?: string;
}

export const InteractiveSalesWaveChart: React.FC<{
  data?: DataPoint[];
  currency?: string;
  canViewCost?: boolean;
  totalRevenue?: number;
  totalProfit?: number;
}> = ({
  data = [],
  currency = 'ETB',
  canViewCost = true,
  totalRevenue,
  totalProfit,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [metric, setMetric] = useState<'revenue' | 'profit'>('revenue');
  const [chartType, setChartType] = useState<'wave' | 'bar'>('wave');
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      const raf = requestAnimationFrame(() => {
        const t = setTimeout(() => {
          setIsLoaded(true);
          hasMountedRef.current = true;
        }, 50);
        return () => clearTimeout(t);
      });
      return () => cancelAnimationFrame(raf);
    }
    setIsLoaded(true);
  }, [data, metric, chartType]);

  const width = 640;
  const height = 180;
  const padX = 24;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const values = data.map((d) => (metric === 'revenue' ? d.revenue : d.profit));
  const maxVal = Math.max(...values, 10000);

  // Generate smooth cubic bezier curve points
  const points = data.map((d, i) => {
    const val = metric === 'revenue' ? d.revenue : d.profit;
    const x = padX + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
    const y = height - padY - (val / maxVal) * chartH;
    return { x, y, ...d, val };
  });

  // Calculate smooth SVG path
  let curvePath = '';
  let areaPath = '';
  if (points.length >= 2) {
    curvePath = points.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x},${pt.y}`;
      const prev = arr[i - 1];
      const cpx1 = prev.x + (pt.x - prev.x) / 2;
      const cpy1 = prev.y;
      const cpx2 = prev.x + (pt.x - prev.x) / 2;
      const cpy2 = pt.y;
      return `${acc} C ${cpx1},${cpy1} ${cpx2},${cpy2} ${pt.x},${pt.y}`;
    }, '');
    areaPath = `${curvePath} L ${points[points.length - 1].x},${height - padY} L ${points[0].x},${height - padY} Z`;
  } else if (points.length === 1) {
    curvePath = `M ${padX},${points[0].y} L ${width - padX},${points[0].y}`;
    areaPath = `${curvePath} L ${width - padX},${height - padY} L ${padX},${height - padY} Z`;
  }

  const sumValues = data.reduce((s, d) => s + (metric === 'revenue' ? d.revenue : d.profit), 0);
  const totalVal = metric === 'revenue'
    ? (totalRevenue !== undefined ? totalRevenue : sumValues)
    : (totalProfit !== undefined ? totalProfit : sumValues);

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;
  const displayVal = activePoint !== null ? activePoint.val : totalVal;

  const handlePointerInteraction = (clientX: number) => {
    if (!containerRef.current || points.length === 0) return;
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const paddingOffset = (padX / width) * rect.width;
    const usableW = rect.width - paddingOffset * 2;
    if (usableW <= 0) return;
    const pct = Math.max(0, Math.min(1, (relX - paddingOffset) / usableW));
    const targetIdx = Math.round(pct * (points.length - 1));
    if (targetIdx >= 0 && targetIdx < points.length) {
      setHoverIndex(targetIdx);
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      setHoverIndex(null);
    }, 2200);
  };

  return (
    <div className="w-full">
      {/* Top Bar of Chart */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {activePoint !== null
                ? `${activePoint.day} ${metric === 'revenue' ? 'Sales' : 'Margin'}`
                : (metric === 'revenue' ? 'Sales Trajectory' : 'Gross Margin Trend')}
            </span>
            {activePoint !== null && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                {activePoint.orders} {activePoint.orders === 1 ? 'order' : 'orders'}
              </span>
            )}
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
            <AnimatedNumber value={displayVal} />{' '}
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-sans">{currency}</span>
          </div>
        </div>

        {/* View Switcher: Bar vs Wave & Metric Selector Pills */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Chart View Toggle: Bar vs Wave */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs shadow-2xs">
            <button
              onClick={() => setChartType('bar')}
              title="Bar Chart Histogram"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('wave')}
              title="Wave Area Curve"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === 'wave'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Metric Selector Pills */}
          {canViewCost && (
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-medium shadow-2xs">
              <button
                onClick={() => {
                  setMetric('revenue');
                  setHoverIndex(null);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  metric === 'revenue'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sales
              </button>
              <button
                onClick={() => {
                  setMetric('profit');
                  setHoverIndex(null);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  metric === 'profit'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Margin
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div
        ref={containerRef}
        onTouchStart={(e) => {
          if (e.touches[0]) handlePointerInteraction(e.touches[0].clientX);
        }}
        onTouchMove={(e) => {
          if (e.touches[0]) handlePointerInteraction(e.touches[0].clientX);
        }}
        onTouchEnd={handleTouchEnd}
        onMouseMove={(e) => handlePointerInteraction(e.clientX)}
        onMouseLeave={() => setHoverIndex(null)}
        className="relative w-full h-[170px] sm:h-[180px] bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-800/20 dark:to-transparent rounded-xl border border-slate-100/90 dark:border-slate-800/80 overflow-hidden touch-none select-none cursor-crosshair"
      >
        {points.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-400 font-medium z-10">
            <span>No sales recorded for this month</span>
            <span className="text-[10px] text-slate-400/70 mt-0.5 font-sans">Recorded sales will plot a real trend wave here</span>
          </div>
        )}

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
            <clipPath id="salesWaveReveal">
              <rect
                x="0"
                y="0"
                width={isLoaded ? width : 0}
                height={height}
                style={{
                  transition: 'width 1000ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </clipPath>
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

          {/* Wave Mode: Synchronously Clipped Area & Bezier Curve */}
          {chartType === 'wave' && (
            <g clipPath="url(#salesWaveReveal)">
              {areaPath && (
                <path
                  d={areaPath}
                  fill={metric === 'revenue' ? 'url(#indigoWave)' : 'url(#emeraldWave)'}
                  className="transition-opacity duration-300"
                />
              )}
              {curvePath && (
                <path
                  d={curvePath}
                  fill="none"
                  stroke={metric === 'revenue' ? '#6366f1' : '#10b981'}
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-opacity duration-300"
                />
              )}
            </g>
          )}

          {/* Wave Mode: Interactive Guides & Points */}
          {chartType === 'wave' && points.map((pt, i) => (
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
                style={{
                  transformOrigin: `${pt.x}px ${pt.y}px`,
                  transition: 'transform 300ms ease-out, opacity 400ms ease-out',
                }}
                className={`cursor-pointer ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            </g>
          ))}

          {/* Bar Mode: Interactive Modern Rounded Bar Columns */}
          {chartType === 'bar' && points.map((pt, i) => {
            const barCount = Math.max(points.length, 1);
            const barW = Math.max(6, Math.min(22, (chartW / barCount) * 0.72));
            const barH = Math.max(4, (pt.val / maxVal) * chartH);
            const barY = height - padY - barH;
            const barX = pt.x - barW / 2;
            const isHovered = hoverIndex === i;
            const isRev = metric === 'revenue';

            return (
              <g key={i}>
                {isHovered && (
                  <line
                    x1={pt.x}
                    y1={padY}
                    x2={pt.x}
                    y2={height - padY}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    className="opacity-70"
                  />
                )}
                <rect
                  x={barX}
                  y={isLoaded ? barY : height - padY}
                  width={barW}
                  height={isLoaded ? barH : 0}
                  rx={Math.min(barW / 2.5, 4)}
                  fill={isHovered ? (isRev ? '#6366f1' : '#10b981') : (isRev ? '#818cf8' : '#34d399')}
                  opacity={hoverIndex === null ? 0.85 : isHovered ? 1 : 0.35}
                  style={{
                    transition: 'all 280ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Pill */}
        {hoverIndex !== null && points[hoverIndex] && (
          <div
            className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full bg-slate-900 dark:bg-slate-800 text-white px-3 py-1.5 rounded-xl shadow-xl text-xs font-mono whitespace-nowrap animate-modal-enter border border-slate-700/50"
            style={{
              left: `${Math.max(12, Math.min(88, (points[hoverIndex].x / width) * 100))}%`,
              top: `${Math.max(points[hoverIndex].y - 12, 10)}px`,
            }}
          >
            <div className="font-bold">{points[hoverIndex].val.toLocaleString()} ETB</div>
            <div className="text-[10px] text-slate-300 font-sans flex items-center gap-1.5 mt-0.5">
              <span>{points[hoverIndex].day}</span>
              <span>&bull;</span>
              <span>{points[hoverIndex].orders} {points[hoverIndex].orders === 1 ? 'order' : 'orders'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Axis Labels */}
      {data.length > 0 ? (
        <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2 px-1 font-mono font-medium">
          <span>{data[0]?.day}</span>
          {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.day}</span>}
          {data.length > 1 && <span>{data[data.length - 1]?.day}</span>}
        </div>
      ) : (
        <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-mono">
          No sales activity in this period
        </div>
      )}
    </div>
  );
};

// Mini Sparkline component for KPI cards
export const MiniSparkline: React.FC<{
  data?: number[];
  values?: number[];
  color?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'purple' | 'blue' | 'slate';
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
      : color === 'slate'
      ? '#64748b'
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
  color?: 'emerald' | 'indigo' | 'amber' | 'slate' | 'blue' | 'purple' | 'rose';
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
      : color === 'rose'
      ? 'bg-rose-500 dark:bg-rose-400'
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
  liquidFinance?: number;
  forexAssets?: number;
  goldAssets?: number;
  otherAssets?: number;
  payables?: number;
  netCapital: number;
  showLegend?: boolean;
}> = ({
  stock,
  receivables,
  treasury,
  assets,
  liquidFinance,
  forexAssets = 0,
  goldAssets = 0,
  otherAssets,
  payables = 0,
  netCapital,
  showLegend = true,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      const raf = requestAnimationFrame(() => {
        const t = setTimeout(() => {
          setIsLoaded(true);
          hasMountedRef.current = true;
        }, 50);
        return () => clearTimeout(t);
      });
      return () => cancelAnimationFrame(raf);
    }
    setIsLoaded(true);
  }, [stock, receivables, treasury, assets, payables, liquidFinance, forexAssets, goldAssets, otherAssets]);

  const hasGranularAssets = forexAssets > 0 || goldAssets > 0;
  const liquidVal = liquidFinance !== undefined ? liquidFinance : treasury;
  const forexVal = forexAssets;
  const goldVal = goldAssets;
  const otherVal = otherAssets !== undefined ? otherAssets : Math.max(0, assets - forexVal - goldVal);

  const grossAssets = hasGranularAssets
    ? stock + receivables + liquidVal + forexVal + goldVal + otherVal
    : stock + receivables + treasury + assets;
  const total = grossAssets + payables;
  const radius = 58;
  const stroke = 15;
  const circum = 2 * Math.PI * radius;

  const stockPct = total > 0 ? stock / total : 0;
  const recPct = total > 0 ? receivables / total : 0;
  const treasPct = total > 0 ? (hasGranularAssets ? liquidVal : treasury) / total : 0;
  const forexPct = total > 0 && hasGranularAssets ? forexVal / total : 0;
  const goldPct = total > 0 && hasGranularAssets ? goldVal / total : 0;
  const otherPct = total > 0 && hasGranularAssets ? otherVal / total : (total > 0 ? assets / total : 0);
  const payablePct = total > 0 ? payables / total : 0;

  let currentOffset = 0;
  const stockOffset = currentOffset; currentOffset += circum * stockPct;
  const recOffset = currentOffset; currentOffset += circum * recPct;
  const treasOffset = currentOffset; currentOffset += circum * treasPct;
  const forexOffset = currentOffset; currentOffset += circum * forexPct;
  const goldOffset = currentOffset; currentOffset += circum * goldPct;
  const otherOffset = currentOffset; currentOffset += circum * otherPct;
  const payableOffset = currentOffset;

  const segmentTransition = 'stroke-dasharray 900ms cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <div className={showLegend ? "flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-center gap-5 sm:gap-6" : "flex items-center justify-center"}>
      {/* SVG Ring (Enlarged) */}
      <div className={`relative ${showLegend ? 'w-44 h-44 sm:w-48 sm:h-48' : 'w-40 h-40 sm:w-44 sm:h-44'} shrink-0`}>
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full transition-all duration-700 ease-out"
          style={{
            transform: isLoaded ? 'rotate(-90deg) scale(1)' : 'rotate(-90deg) scale(0.95)',
            opacity: isLoaded ? 1 : 0,
            transformOrigin: 'center center',
          }}
        >
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
            strokeDasharray={isLoaded ? `${circum * stockPct} ${circum}` : `0 ${circum}`}
            strokeDashoffset={isLoaded ? -stockOffset : 0}
            style={{ transition: segmentTransition }}
          />
          {/* Receivables segment */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth={stroke}
            strokeDasharray={isLoaded ? `${circum * recPct} ${circum}` : `0 ${circum}`}
            strokeDashoffset={isLoaded ? -recOffset : 0}
            style={{ transition: segmentTransition }}
          />
          {/* Treasury / Liquid segment */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={stroke}
            strokeDasharray={isLoaded ? `${circum * treasPct} ${circum}` : `0 ${circum}`}
            strokeDashoffset={isLoaded ? -treasOffset : 0}
            style={{ transition: segmentTransition }}
          />
          {/* Forex segment (if granular and > 0) */}
          {hasGranularAssets && forexPct > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#6366f1"
              strokeWidth={stroke}
              strokeDasharray={isLoaded ? `${circum * forexPct} ${circum}` : `0 ${circum}`}
              strokeDashoffset={isLoaded ? -forexOffset : 0}
              style={{ transition: segmentTransition }}
            />
          )}
          {/* Gold segment (if granular and > 0) */}
          {hasGranularAssets && goldPct > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#eab308"
              strokeWidth={stroke}
              strokeDasharray={isLoaded ? `${circum * goldPct} ${circum}` : `0 ${circum}`}
              strokeDashoffset={isLoaded ? -goldOffset : 0}
              style={{ transition: segmentTransition }}
            />
          )}
          {/* Assets / Other segment */}
          {otherPct > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={hasGranularAssets ? "#f97316" : "#f59e0b"}
              strokeWidth={stroke}
              strokeDasharray={isLoaded ? `${circum * otherPct} ${circum}` : `0 ${circum}`}
              strokeDashoffset={isLoaded ? -otherOffset : 0}
              style={{ transition: segmentTransition }}
            />
          )}
          {/* Payables segment */}
          {payables > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#f43f5e"
              strokeWidth={stroke}
              strokeDasharray={isLoaded ? `${circum * payablePct} ${circum}` : `0 ${circum}`}
              strokeDashoffset={isLoaded ? -payableOffset : 0}
              style={{ transition: segmentTransition }}
            />
          )}
        </svg>

        {/* Center Readout: Net Capital */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none transition-all duration-700 delay-300 ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
            Net Capital
          </span>
          <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white tracking-tight mt-0.5">
            {(netCapital / 1000000).toFixed(2)}M
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            ETB
          </span>
        </div>
      </div>

      {/* Legend Grid */}
      {showLegend && (
        <div className="grid grid-cols-2 gap-2 sm:gap-x-4 sm:gap-y-3 text-xs w-full">
          <div className="flex items-start gap-2 p-2 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100 dark:border-slate-800/50 sm:border-0">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0 mt-1 sm:mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium truncate">
                Stock ({(stockPct * 100).toFixed(0)}%)
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs truncate block mt-0.5">
                <AnimatedNumber value={stock} /> <span className="text-[10px] font-normal text-slate-400">ETB</span>
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100 dark:border-slate-800/50 sm:border-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1 sm:mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium truncate">
                Receivables ({(recPct * 100).toFixed(0)}%)
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs truncate block mt-0.5">
                +<AnimatedNumber value={receivables} /> <span className="text-[10px] font-normal text-slate-400">ETB</span>
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100 dark:border-slate-800/50 sm:border-0">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1 sm:mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium truncate">
                {hasGranularAssets ? 'Liquid Finance' : 'Cash'} ({(treasPct * 100).toFixed(0)}%)
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs truncate block mt-0.5">
                +<AnimatedNumber value={liquidVal} /> <span className="text-[10px] font-normal text-slate-400">ETB</span>
              </span>
            </div>
          </div>

          {hasGranularAssets && forexVal > 0 && (
            <div className="flex items-start gap-2 p-2 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100 dark:border-slate-800/50 sm:border-0">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 mt-1 sm:mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium truncate">
                  Forex Reserves ({(forexPct * 100).toFixed(0)}%)
                </span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-xs truncate block mt-0.5">
                  +<AnimatedNumber value={forexVal} /> <span className="text-[10px] font-normal text-slate-400">ETB</span>
                </span>
              </div>
            </div>
          )}

          {hasGranularAssets && goldVal > 0 && (
            <div className="flex items-start gap-2 p-2 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100 dark:border-slate-800/50 sm:border-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-1 sm:mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium truncate">
                  Other Assets ({(goldPct * 100).toFixed(0)}%)
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-xs truncate block mt-0.5">
                  +<AnimatedNumber value={goldVal} /> <span className="text-[10px] font-normal text-slate-400">ETB</span>
                </span>
              </div>
            </div>
          )}

          {(!hasGranularAssets || otherVal > 0) && (
            <div className="flex items-start gap-2 p-2 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100 dark:border-slate-800/50 sm:border-0">
              <span className={`w-2.5 h-2.5 rounded-full ${hasGranularAssets ? 'bg-orange-500' : 'bg-amber-500'} shrink-0 mt-1 sm:mt-0.5`} />
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium truncate">
                  Other Assets ({(otherPct * 100).toFixed(0)}%)
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs truncate block mt-0.5">
                  +<AnimatedNumber value={hasGranularAssets ? otherVal : assets} /> <span className="text-[10px] font-normal text-slate-400">ETB</span>
                </span>
              </div>
            </div>
          )}

          {payables > 0 && (
            <div className="flex items-start gap-2 p-2 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100 dark:border-slate-800/50 sm:border-0 col-span-2 sm:col-span-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-1 sm:mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-medium truncate">
                  Payables ({payables > 0 ? (payablePct * 100).toFixed(0) : '0'}%)
                </span>
                <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-xs truncate block mt-0.5">
                  −<AnimatedNumber value={payables} /> <span className="text-[10px] font-normal text-slate-400">ETB</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
