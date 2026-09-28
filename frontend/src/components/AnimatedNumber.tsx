import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  animateOnMount?: boolean;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 600,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  animateOnMount = true,
}) => {
  const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0;

  // Check for user preference for reduced motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // If animateOnMount is true and not reduced motion, start display at 0 for initial count-up
  const [displayValue, setDisplayValue] = useState<number>(() => {
    if (prefersReducedMotion || !animateOnMount) {
      return numericValue;
    }
    return 0;
  });

  const prevValueRef = useRef<number>(prefersReducedMotion || !animateOnMount ? numericValue : 0);
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(numericValue);
      prevValueRef.current = numericValue;
      return;
    }

    const startValue = prevValueRef.current;
    const change = numericValue - startValue;

    if (change === 0) {
      setDisplayValue(numericValue);
      return;
    }

    startTimeRef.current = null;

    // Smooth cubic ease-out
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const current = startValue + change * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(numericValue);
        prevValueRef.current = numericValue;
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [numericValue, duration, prefersReducedMotion]);

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`tabular-nums font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
