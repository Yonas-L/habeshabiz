import React from 'react';
import { Trefoil, Helix, Mirage, Quantum, Squircle, Ring2, LineSpinner, DotSpinner } from 'ldrs/react';
import 'ldrs/react/Trefoil.css';
import 'ldrs/react/Helix.css';
import 'ldrs/react/Mirage.css';
import 'ldrs/react/Quantum.css';
import 'ldrs/react/Squircle.css';
import 'ldrs/react/Ring2.css';
import 'ldrs/react/LineSpinner.css';
import 'ldrs/react/DotSpinner.css';

export interface LdrsSpinnerProps {
  size?: number | string;
  color?: string;
  speed?: number | string;
  stroke?: number | string;
  variant?: 'trefoil' | 'helix' | 'mirage' | 'quantum' | 'squircle' | 'ring2' | 'line' | 'dots';
  className?: string;
}

/**
 * Universal lightweight LDRS spinner for buttons, inline states, and micro-loaders.
 */
export const LdrsSpinner: React.FC<LdrsSpinnerProps> = ({
  size = 16,
  color = 'currentColor',
  speed = 1.2,
  stroke = 2.5,
  variant = 'trefoil',
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center justify-center shrink-0 leading-none ${className}`}>
      {variant === 'trefoil' && (
        <Trefoil size={size} color={color} speed={speed} stroke={stroke} strokeLength={0.18} bgOpacity={0.12} />
      )}
      {variant === 'helix' && (
        <Helix size={size} color={color} speed={speed} />
      )}
      {variant === 'mirage' && (
        <Mirage size={size} color={color} speed={speed} />
      )}
      {variant === 'quantum' && (
        <Quantum size={size} color={color} speed={speed} />
      )}
      {variant === 'squircle' && (
        <Squircle size={size} color={color} speed={speed} stroke={stroke} strokeLength={0.25} bgOpacity={0.15} />
      )}
      {variant === 'ring2' && (
        <Ring2 size={size} color={color} speed={speed} stroke={stroke} strokeLength={0.25} bgOpacity={0.15} />
      )}
      {variant === 'line' && (
        <LineSpinner size={size} color={color} speed={speed} stroke={stroke} />
      )}
      {variant === 'dots' && (
        <DotSpinner size={size} color={color} speed={speed} />
      )}
    </span>
  );
};
