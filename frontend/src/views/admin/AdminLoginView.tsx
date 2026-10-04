import React, { useState } from 'react';
import { ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { adminApi, setAdminToken } from '../../api/adminClient';

interface AdminLoginViewProps {
  onSuccess: () => void;
  onBackToStore?: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({ onSuccess, onBackToStore }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await adminApi.login({
        email: email.trim().toLowerCase(),
        password,
      });

      setAdminToken(res.token);
      onSuccess();
    } catch (err: any) {
      if (err.status === 429) {
        setError('Too many attempts. Please wait a minute.');
      } else if (err.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Login failed. Please verify credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell min-h-screen flex flex-col items-center justify-center p-4 selection:bg-emerald-300 selection:text-emerald-950">
      <div className="auth-panel w-full max-w-sm bg-[#131926] rounded-2xl border border-emerald-100/10 p-7 shadow-2xl space-y-6 animate-page-enter">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              HabeshaBiz Platform
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Superadmin Access Control
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@platform.com"
              className="w-full h-10 px-3.5 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              className="w-full h-10 px-3.5 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Sign In to Superadmin</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              </>
            )}
          </button>

          {onBackToStore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onBackToStore}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <span>&larr; Return to Store App</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
