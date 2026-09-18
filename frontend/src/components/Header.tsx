import React from 'react';
import type { User, Tenant } from '../api/client';
import { LogOut, Wallet } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  tenant: Tenant | null;
  netCapital: number | null;
  onLogout: () => void;
  onQuickSwitchUser: (email: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  tenant,
  netCapital,
  onLogout,
  onQuickSwitchUser,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Active Workspace */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-sm shadow-sm">
            HB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm tracking-tight">
                {tenant?.name || 'HabeshaBiz'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Live
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-normal">Addis Ababa Retail & Trading OS</p>
          </div>
        </div>

        {/* Center Live Capital Pill */}
        {netCapital !== null && (
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
            <Wallet className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-medium">Net Capital:</span>
            <span className="font-semibold text-slate-900 font-mono">
              {netCapital.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ETB
            </span>
          </div>
        )}

        {/* User Role & Quick Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Role Switcher for Design Partner testing */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100/80 rounded-lg p-1 border border-slate-200/60">
            <span className="px-1.5 text-[11px] font-medium text-slate-400">View as:</span>
            <button
              onClick={() => onQuickSwitchUser('yoni@boletech.et')}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                user?.role === 'owner' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yoni (Owner)
            </button>
            <button
              onClick={() => onQuickSwitchUser('husa@boletech.et')}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                user?.role === 'salesperson' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Husa (Sales)
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          {/* Active User Pill */}
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-slate-900 leading-tight">{user?.name}</div>
              <div className="text-[11px] text-slate-500 capitalize">{user?.role}</div>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
