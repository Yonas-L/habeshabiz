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
    <div className="border-b border-slate-100 dark:border-slate-800/80 pb-4 transition-colors last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">{icon}</span>}
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
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
        <div className="pt-2 animate-collapse-open space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};
