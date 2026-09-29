import React, { useEffect, useState, useRef } from 'react';

interface TopProgressBarProps {
  isLoading: boolean;
  className?: string;
}

export const TopProgressBar: React.FC<TopProgressBarProps> = ({
  isLoading,
  className = '',
}) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isLoading) {
      setVisible(true);
      setProgress((prev) => (prev > 0 && prev < 90 ? prev : 12));

      // Trickle progress non-linearly
      timerRef.current = setInterval(() => {
        setProgress((current) => {
          if (current < 30) {
            return current + Math.floor(Math.random() * 12 + 6);
          } else if (current < 65) {
            return current + Math.floor(Math.random() * 6 + 3);
          } else if (current < 85) {
            return current + Math.floor(Math.random() * 3 + 1);
          } else if (current < 94) {
            return current + 0.5;
          }
          return current;
        });
      }, 140);
    } else {
      if (visible) {
        setProgress(100);
        const hideTimeout = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 280);

        return () => clearTimeout(hideTimeout);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoading]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[99999] pointer-events-none transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Glow track under bar */}
      <div
        className="h-[2.5px] w-full relative overflow-hidden bg-transparent"
        style={{
          width: '100%',
        }}
      >
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-300 ease-out relative shadow-[0_0_12px_rgba(16,185,129,0.8),0_0_4px_rgba(245,158,11,0.6)]"
          style={{
            width: `${progress}%`,
          }}
        >
          {/* Shimmer light head */}
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-white/70 to-white animate-pulse" />

          {/* Shimmer wave across full length */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full animate-progress-shimmer" />
        </div>
      </div>
    </div>
  );
};
