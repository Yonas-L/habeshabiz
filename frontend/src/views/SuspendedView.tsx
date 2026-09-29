import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import { removeAuthToken } from '../api/client';

interface SuspendedViewProps {
  onBackToLogin?: () => void;
}

export const SuspendedView: React.FC<SuspendedViewProps> = ({ onBackToLogin }) => {
  const lockReason = typeof window !== 'undefined'
    ? localStorage.getItem('habeshabiz_lock_reason')
    : null;

  const handleSignOut = () => {
    removeAuthToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('habeshabiz_lock_reason');
      if (onBackToLogin) {
        onBackToLogin();
      } else {
        window.location.href = '/';
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center p-4 selection:bg-rose-500 selection:text-white">
      <div className="w-full max-w-md bg-[#131926] rounded-2xl border border-rose-950/60 p-8 shadow-2xl text-center space-y-6 animate-page-enter">
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        {/* Heading (Bilingual) */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Account Suspended
          </h1>
          <h2 className="text-base font-semibold text-rose-400 font-sans">
            መለያዎ ታግዷል
          </h2>
        </div>

        {/* Subtext (Bilingual) */}
        <div className="space-y-1.5 text-xs text-slate-400 leading-relaxed">
          <p>Your account has been suspended. Please contact support to resolve this.</p>
          <p className="text-slate-500 font-sans">መለያዎ ታግዷል። ይህን ለመፍታት ድጋፍን ያግኙ።</p>
        </div>

        {/* Lock Reason if available */}
        {lockReason && (
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Suspension Note
            </span>
            <p className="text-xs text-slate-300 font-mono">
              Reason: {lockReason}
            </p>
          </div>
        )}

        {/* Action to switch account */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>← Sign in with a different account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
