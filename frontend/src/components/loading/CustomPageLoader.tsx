import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';

interface CustomPageLoaderProps {
  mode?: 'app' | 'admin';
  fullScreen?: boolean;
}

export const CustomPageLoader: React.FC<CustomPageLoaderProps> = ({
  mode = 'app',
  fullScreen = true,
}) => {
  const [progress, setProgress] = useState(16);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 42) return prev + Math.floor(Math.random() * 8 + 4);
        if (prev < 78) return prev + Math.floor(Math.random() * 5 + 3);
        if (prev < 93) return prev + Math.floor(Math.random() * 3 + 1);
        if (prev < 99) return prev + 1;
        return prev;
      });
    }, 110);

    return () => clearInterval(interval);
  }, []);

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={`${
        fullScreen
          ? 'min-h-screen w-full bg-[#f6f8fa] dark:bg-[#0b0f17]'
          : 'min-h-[50vh] w-full flex-1 py-12'
      } flex flex-col items-center justify-center text-slate-900 dark:text-slate-100 select-none relative overflow-hidden animate-page-enter`}
    >
      {/* Soft Ambient Radial Light */}
      <div className="absolute w-72 h-72 rounded-full bg-emerald-500/10 dark:bg-emerald-500/8 blur-3xl pointer-events-none animate-pulse-glow" />

      {/* Floating Minimal Icon Centerpiece */}
      <div className="relative flex flex-col items-center z-10">
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Circular Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-200/80 dark:text-slate-800/80"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              stroke="url(#hb-progress-gradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300 ease-out"
            />
            <defs>
              <linearGradient id="hb-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="60%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>

          {/* Dotted Orbit Spinner */}
          <svg
            className="absolute inset-0 w-full h-full animate-orbit-spin text-slate-300/60 dark:text-slate-700/50 pointer-events-none"
            viewBox="0 0 96 96"
          >
            <circle
              cx="48"
              cy="48"
              r={43}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 6"
            />
          </svg>

          {/* Orbiting Satellite Beacon */}
          <div className="absolute inset-0 animate-orbit-spin pointer-events-none">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] mx-auto -translate-y-1" />
          </div>

          {/* Central Brand Squircle Emblem */}
          <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-500/10 dark:shadow-black/40 relative z-10 animate-float-gentle">
            {mode === 'admin' ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 dark:text-emerald-600" />
            ) : (
              <span className="tracking-tight font-black text-xs">HB</span>
            )}
          </div>
        </div>

        {/* Minimal Micro-Progress Line & Monospace Ticker */}
        <div className="mt-5 flex flex-col items-center gap-1.5">
          <div className="w-24 h-1 rounded-full bg-slate-200/80 dark:bg-slate-800/80 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.7)]"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-progress-shimmer" />
            </div>
          </div>

          <span className="font-mono text-[10px] tabular-nums font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
};
