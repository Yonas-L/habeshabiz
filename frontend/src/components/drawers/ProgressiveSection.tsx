import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ProgressiveSectionProps {
  title: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const ProgressiveSection: React.FC<ProgressiveSectionProps> = ({
  title,
  badge,
  icon,
  defaultOpen = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-slate-400 dark:text-slate-500 shrink-0">{icon}</span>}
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight truncate">
            {title}
          </span>
          {badge}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/60 animate-collapse-open space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};
