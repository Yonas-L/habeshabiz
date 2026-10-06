import React from 'react';
import { Trefoil, Helix, Mirage, Quantum, Squircle } from 'ldrs/react';
import 'ldrs/react/Trefoil.css';
import 'ldrs/react/Helix.css';
import 'ldrs/react/Mirage.css';
import 'ldrs/react/Quantum.css';
import 'ldrs/react/Squircle.css';

export interface CustomPageLoaderProps {
  mode?: 'app' | 'admin';
  fullScreen?: boolean;
  variant?: 'trefoil' | 'helix' | 'mirage' | 'quantum' | 'squircle';
  size?: number;
}

/**
 * Minimal, text-free, high-performance loader powered by LDRS.
 * Clean and responsive on mobile and desktop without clutter or legacy text logos.
 */
export const CustomPageLoader: React.FC<CustomPageLoaderProps> = ({
  mode = 'app',
  fullScreen = true,
  variant = 'trefoil',
  size,
}) => {
  const loaderColor = mode === 'admin' ? '#0ea5e9' : '#10b981';
  const defaultSize = fullScreen ? 44 : 32;
  const activeSize = size || defaultSize;

  return (
    <div
      className={`${
        fullScreen
          ? 'min-h-screen w-full bg-[#f6f8fa] dark:bg-[#0b0f17]'
          : 'min-h-[35vh] w-full flex-1 py-10'
      } flex flex-col items-center justify-center select-none relative overflow-hidden transition-colors duration-200`}
    >
      {/* Soft Ambient Radial Backdrop */}
      <div
        className={`absolute w-48 h-48 sm:w-64 sm:h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          mode === 'admin'
            ? 'bg-sky-500/12 dark:bg-sky-500/10'
            : 'bg-emerald-500/12 dark:bg-emerald-500/10'
        }`}
      />

      {/* Centered Minimalist LDRS Loader */}
      <div className="relative z-10 flex items-center justify-center p-3">
        {variant === 'trefoil' && (
          <Trefoil
            size={activeSize}
            color={loaderColor}
            speed={1.25}
            stroke={3.5}
            strokeLength={0.18}
            bgOpacity={0.12}
          />
        )}
        {variant === 'helix' && (
          <Helix
            size={activeSize}
            color={loaderColor}
            speed={1.6}
          />
        )}
        {variant === 'mirage' && (
          <Mirage
            size={activeSize * 1.2}
            color={loaderColor}
            speed={2.2}
          />
        )}
        {variant === 'quantum' && (
          <Quantum
            size={activeSize}
            color={loaderColor}
            speed={1.5}
          />
        )}
        {variant === 'squircle' && (
          <Squircle
            size={activeSize}
            color={loaderColor}
            speed={1.2}
            stroke={3.5}
            strokeLength={0.25}
            bgOpacity={0.15}
          />
        )}
      </div>
    </div>
  );
};
