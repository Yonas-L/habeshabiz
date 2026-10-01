import React from 'react';
import { createPortal } from 'react-dom';
import type { User, Tenant } from '../api/client';
import { resolveImageUrl } from '../api/client';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  CreditCard,
  Landmark,
  DollarSign,
  LogOut,
  Search,
  Users,
  Settings,
  Handshake,
  ScrollText,
  X,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'counter'
  | 'inventory'
  | 'sales'
  | 'partners'
  | 'debts'
  | 'treasury'
  | 'expenses'
  | 'staff'
  | 'logs'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  user: User | null;
  tenant: Tenant | null;
  netCapital: number | null;
  openDebtsCount: number;
  onLogout: () => void;
  onQuickSwitchUser?: (email: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenProfile?: () => void;
  onOpenQuickSearch?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  user,
  tenant,
  openDebtsCount,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  onOpenProfile,
  onOpenQuickSearch,
  theme,
  onToggleTheme,
}) => {
  const isOwner = user?.role === 'owner';

  const businessInitials = React.useMemo(() => {
    if (!tenant?.name) return 'HB';
    const words = tenant.name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [tenant?.name]);

  const rawLogoUrl = tenant?.settings?.logo_url || (tenant as any)?.logo_url || null;

  const [logoLoadFailed, setLogoLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setLogoLoadFailed(false);
  }, [rawLogoUrl]);

  const resolvedLogoUrl = React.useMemo(() => {
    return resolveImageUrl(rawLogoUrl);
  }, [rawLogoUrl]);

  const mainNav: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    shortcut?: string;
  }[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
    { id: 'counter', label: 'Sales', icon: ShoppingCart, shortcut: '⌘2' },
    { id: 'inventory', label: 'Stock', icon: Package, shortcut: '⌘3' },
    { id: 'sales', label: 'Sales History', icon: Receipt, shortcut: '⌘4' },
    ...(isOwner
      ? [
          { id: 'partners' as NavTab, label: 'Vendors', icon: Handshake, shortcut: '⌘5' },
          { id: 'staff' as NavTab, label: 'Staff', icon: Users, shortcut: '⌘9' },
        ]
      : []),
  ];

  const financeNav: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    shortcut?: string;
  }[] = [
    { id: 'debts', label: 'Receivable & Payable', icon: CreditCard, badge: openDebtsCount, shortcut: '⌘6' },
    { id: 'treasury', label: 'Bank Accounts', icon: Landmark, shortcut: '⌘7' },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, shortcut: '⌘8' },
  ];

  const sidebarInner = (
    <aside className="w-64 h-full bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between select-none p-3.5 transition-colors">
      <div>
        {/* Brand Header */}
        <div className="px-2 py-2.5 flex items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-10 h-10 aspect-square rounded-full shrink-0 flex items-center justify-center overflow-hidden border shadow-xs transition-colors ${
                resolvedLogoUrl && !logoLoadFailed
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 p-0.5'
                  : 'bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 border-slate-700/30 text-white font-bold text-xs tracking-tight'
              }`}
            >
              {resolvedLogoUrl && !logoLoadFailed ? (
                <img
                  src={resolvedLogoUrl}
                  alt={tenant?.name || 'Business Logo'}
                  className="w-full h-full object-contain rounded-full"
                  onError={() => setLogoLoadFailed(true)}
                />
              ) : (
                businessInitials
              )}
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <div
                className="font-bold text-slate-900 dark:text-white text-xs tracking-tight truncate"
                title={tenant?.name || 'HabeshaBiz'}
              >
                {tenant?.name || 'HabeshaBiz'}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                Business Management
              </div>
            </div>
          </div>

          <span
            className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/60 shrink-0"
            title="System Online"
          />
        </div>

        {/* Quick Search Trigger */}
        <div className="my-3 px-1">
          <button
            type="button"
            onClick={onOpenQuickSearch}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 transition-colors cursor-pointer group select-none text-left"
          >
            <div className="flex items-center gap-2">
              <Search className="size-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              <span className="text-[11px] group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">Quick search...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-[10px] font-mono border border-slate-200 dark:border-slate-700 text-slate-500 shadow-xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation Group 1: MAIN MENU */}
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
            Main Menu
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                <span className={`text-[10px] font-mono ${isActive ? 'text-slate-400 dark:text-slate-600' : 'text-slate-300 dark:text-slate-600'}`}>
                  {item.shortcut}
                </span>
              </button>
            );
          })}
        </div>

        {/* Navigation Group 2: FINANCE & LEDGERS (Owner only) */}
        {isOwner && (
          <div className="space-y-0.5 mt-3 pt-3 border-t border-slate-100/80 dark:border-slate-800/80">
            <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
              Treasury & Ledger
            </div>
            {financeNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onChangeTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                          isActive
                            ? 'bg-emerald-500 dark:bg-emerald-600 text-white'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <span className={`text-[10px] font-mono ${isActive ? 'text-slate-400 dark:text-slate-600' : 'text-slate-300 dark:text-slate-600'}`}>
                      {item.shortcut}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Navigation Group 3: SECURITY & AUDIT (Owner only) */}
        {isOwner && (
          <div className="space-y-0.5 mt-3 pt-3 border-t border-slate-100/80 dark:border-slate-800/80">
            <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
              System & Security
            </div>
            <button
              onClick={() => {
                onChangeTab('logs');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'logs'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ScrollText className={`size-4 ${activeTab === 'logs' ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>Audit Logs</span>
              </div>
              <span className={`text-[10px] font-mono ${activeTab === 'logs' ? 'text-slate-400 dark:text-slate-600' : 'text-slate-300 dark:text-slate-600'}`}>
                ⌘0
              </span>
            </button>

            <button
              onClick={() => {
                onChangeTab('settings');
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className={`size-4 ${activeTab === 'settings' ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>Settings</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Bottom User Profile */}
      <div className="pt-3 border-t border-slate-100/80 dark:border-slate-800/80">
        {/* Current User Card */}
        <div className="flex items-center justify-between px-1">
          <div
            onClick={isOwner ? () => onChangeTab('settings') : onOpenProfile}
            title={isOwner ? 'Business Settings & Profile' : 'Account Settings & Profile'}
            className="flex items-center gap-2 cursor-pointer group flex-1 mr-2 min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center text-xs font-bold uppercase shadow-xs group-hover:bg-slate-800 transition-colors">
              {user?.name?.slice(0, 2) || 'HB'}
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {user?.name}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium capitalize">
                {user?.role === 'owner' ? 'Owner' : 'Sales Staff'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isOwner ? (
              <button
                onClick={() => onChangeTab('settings')}
                title="Business Settings"
                className={`w-7 h-7 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
                  activeTab === 'settings'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'border-slate-200/80 dark:border-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            ) : onOpenProfile ? (
              <button
                onClick={onOpenProfile}
                title="Account Settings"
                className="w-7 h-7 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <button
              onClick={onLogout}
              title="Sign out"
              className="w-7 h-7 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  const mobileDrawer = isOpenMobile ? (
    <div className="fixed inset-0 z-[100] md:hidden flex overflow-hidden">
      {/* Native Backdrop Blur Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-300 animate-backdrop-enter"
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      {/* Native Drawer Sheet */}
      <aside
        aria-label="Mobile Navigation Menu"
        className="relative z-10 w-[86vw] max-w-[340px] h-full bg-white dark:bg-[#0f141f] border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between shadow-2xl animate-sidebar-slide-in select-none"
      >
        {/* Top Header: Business Branding & Close */}
        <div className="pt-[calc(1.1rem+env(safe-area-inset-top,0px))] px-4 pb-3.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`w-10 h-10 aspect-square rounded-full shrink-0 flex items-center justify-center overflow-hidden border shadow-xs transition-colors ${
                  resolvedLogoUrl && !logoLoadFailed
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 p-0.5'
                    : 'bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 border-slate-700/40 text-white font-black text-xs tracking-tight'
                }`}
              >
                {resolvedLogoUrl && !logoLoadFailed ? (
                  <img
                    src={resolvedLogoUrl}
                    alt={tenant?.name || 'Business Logo'}
                    className="w-full h-full object-contain rounded-full"
                    onError={() => setLogoLoadFailed(true)}
                  />
                ) : (
                  businessInitials
                )}
              </div>
              <div className="leading-tight min-w-0 flex-1">
                <div
                  className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight truncate"
                  title={tenant?.name || 'HabeshaBiz'}
                >
                  {tenant?.name || 'HabeshaBiz'}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-400/40 animate-pulse shrink-0" />
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                    Live System
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseMobile}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Search Tap Bar */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onOpenQuickSearch?.();
            }}
            className="w-full h-10 px-3.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-500 dark:text-slate-400">Search transactions, catalog...</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 shadow-2xs">
              Quick
            </span>
          </button>
        </div>

        {/* Scrollable Nav Sections */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-4">
          {/* Main Workspace Navigation */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
              Workspace
            </div>
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onChangeTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full min-h-[46px] flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 active:scale-[0.98] font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-white/10 dark:bg-slate-900/10'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : ''}`} />
                    </div>
                    <span className="text-xs">{item.label}</span>
                  </div>
                  {isActive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-600 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Finance & Ledgers (Owner Only) */}
          {isOwner && (
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                Treasury & Ledgers
              </div>
              {financeNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onChangeTab(item.id);
                      onCloseMobile();
                    }}
                    className={`w-full min-h-[46px] flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 active:scale-[0.98] font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-white/10 dark:bg-slate-900/10'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : ''}`} />
                      </div>
                      <span className="text-xs">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                            isActive
                              ? 'bg-emerald-500 dark:bg-emerald-600 text-white'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-600 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* System & Management (Owner Only) */}
          {isOwner && (
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                System & Control
              </div>
              <button
                onClick={() => {
                  onChangeTab('logs');
                  onCloseMobile();
                }}
                className={`w-full min-h-[46px] flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 active:scale-[0.98] font-semibold'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      activeTab === 'logs'
                        ? 'bg-white/10 dark:bg-slate-900/10'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <ScrollText className={`w-4 h-4 ${activeTab === 'logs' ? 'text-emerald-400 dark:text-emerald-600' : ''}`} />
                  </div>
                  <span className="text-xs">Audit Logs</span>
                </div>
                {activeTab === 'logs' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-600 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                )}
              </button>

              <button
                onClick={() => {
                  onChangeTab('settings');
                  onCloseMobile();
                }}
                className={`w-full min-h-[46px] flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 active:scale-[0.98] font-semibold'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      activeTab === 'settings'
                        ? 'bg-white/10 dark:bg-slate-900/10'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-emerald-400 dark:text-emerald-600' : ''}`} />
                  </div>
                  <span className="text-xs">Business Settings</span>
                </div>
                {activeTab === 'settings' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-600 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Drawer Bottom: Profile & Quick Utilities */}
        <div className="p-3 px-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 shrink-0 pb-[calc(1.1rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex items-center justify-between gap-2">
            {/* User Info with tap to profile/settings */}
            <div
              onClick={() => {
                onCloseMobile();
                if (isOwner) {
                  onChangeTab('settings');
                } else if (onOpenProfile) {
                  onOpenProfile();
                }
              }}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group active:scale-[0.98] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-700/30 text-white flex items-center justify-center text-xs font-bold uppercase shadow-2xs shrink-0">
                {user?.name?.slice(0, 2) || 'HB'}
              </div>
              <div className="leading-tight min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user?.name}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold capitalize mt-0.5">
                  {user?.role === 'owner' ? 'Owner' : 'Sales Staff'}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Theme Toggle Button */}
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  className="w-8 h-8 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-600" />
                  )}
                </button>
              )}

              {/* Profile / Settings Button */}
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  if (isOwner) {
                    onChangeTab('settings');
                  } else if (onOpenProfile) {
                    onOpenProfile();
                  }
                }}
                title={isOwner ? 'Business Settings' : 'Account Settings'}
                className="w-8 h-8 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onLogout();
                }}
                title="Sign Out"
                className="w-8 h-8 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <>
      {/* Desktop Persistent Sidebar - completely intact */}
      <div className="hidden md:block shrink-0 w-64 h-[calc(100vh-2rem)] sticky top-4 my-4 ml-4 animate-fluid-sidebar">
        {sidebarInner}
      </div>

      {/* Native Mobile Navigation Drawer (Portaled to document.body at z-[100]) */}
      {mobileDrawer && createPortal(mobileDrawer, document.body)}
    </>
  );
};
