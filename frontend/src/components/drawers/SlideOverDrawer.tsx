import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  widthClass?: string; // Default: 'sm:max-w-xl'
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  headerActions,
  children,
  footerActions,
  widthClass = 'sm:max-w-xl',
}) => {
  const [rendered, setRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      setIsClosing(false);
      // Lock body scroll smoothly
      document.body.style.overflow = 'hidden';
    } else if (rendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setRendered(false);
        setIsClosing(false);
        document.body.style.overflow = '';
      }, 220);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Dimmed subtle backdrop allowing dashboard visibility */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/25 dark:bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100 animate-backdrop-enter'
        }`}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <aside
          className={`pointer-events-auto w-screen ${widthClass} bg-white dark:bg-[#131926] border-l border-slate-200/80 dark:border-slate-800/90 shadow-2xl flex flex-col justify-between overflow-hidden transition-colors ${
            isClosing ? 'animate-drawer-exit' : 'animate-drawer-enter'
          }`}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-4 bg-white/80 dark:bg-[#131926]/80 backdrop-blur-sm z-10 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {title}
                </h2>
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Progressive Disclosure Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {children}
          </div>

          {/* Optional Action Footer */}
          {footerActions && (
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-between gap-3 shrink-0 z-10">
              {footerActions}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
