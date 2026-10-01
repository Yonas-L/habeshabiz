import React, { useState, useEffect, useRef } from 'react';
import {
  adminApi,
  getAdminToken,
  removeAdminToken,
  type AdminUser,
} from '../../api/adminClient';
import { AdminTenantsView } from './AdminTenantsView';
import { AdminWhitelistView } from './AdminWhitelistView';
import { AdminWaitlistView } from './AdminWaitlistView';
import { AdminSignupAttemptsView } from './AdminSignupAttemptsView';
import {
  Building2,
  ShieldCheck,
  Users,
  Activity,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { CustomPageLoader } from '../../components/loading/CustomPageLoader';
import { TopProgressBar } from '../../components/loading/TopProgressBar';
import { toast } from 'sonner';

export type AdminTab = 'tenants' | 'whitelist' | 'waitlist' | 'signup-attempts';

interface AdminLayoutProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogoutSuccess?: () => void;
}

const NAV_ITEMS: {
  id: AdminTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  accentBg: string;
}[] = [
  {
    id: 'tenants',
    label: 'Tenants',
    description: 'Registered stores',
    icon: Building2,
    accent: 'text-sky-400',
    accentBg: 'bg-sky-500/10',
  },
  {
    id: 'whitelist',
    label: 'Whitelist',
    description: 'Pre-authorized emails',
    icon: ShieldCheck,
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
  },
  {
    id: 'waitlist',
    label: 'Waitlist',
    description: 'Merchant leads',
    icon: Users,
    accent: 'text-indigo-400',
    accentBg: 'bg-indigo-500/10',
  },
  {
    id: 'signup-attempts',
    label: 'Signup Attempts',
    description: 'Registration audit',
    icon: Activity,
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
  },
];

const PAGE_TITLES: Record<AdminTab, string> = {
  tenants: 'Tenant Management',
  whitelist: 'Whitelist Management',
  waitlist: 'Waitlist Submissions',
  'signup-attempts': 'Signup Attempts',
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  theme,
  onToggleTheme,
  onLogoutSuccess,
}) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const getTabFromPath = (): AdminTab => {
    if (typeof window === 'undefined') return 'tenants';
    const path = window.location.pathname;
    if (path.includes('/admin/whitelist')) return 'whitelist';
    if (path.includes('/admin/waitlist')) return 'waitlist';
    if (path.includes('/admin/signup-attempts')) return 'signup-attempts';
    return 'tenants';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getTabFromPath);
  const [isTabLoading, setIsTabLoading] = useState(false);

  useEffect(() => {
    const handlePopState = () => setActiveTab(getTabFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Close sidebar on outside click (mobile)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isSidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarOpen]);

  // Lock body scroll when mobile sidebar open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isSidebarOpen]);

  const handleTabChange = (tab: AdminTab) => {
    setIsTabLoading(true);
    setActiveTab(tab);
    setIsSidebarOpen(false);
    const targetPath = tab === 'tenants' ? '/admin' : `/admin/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setTimeout(() => setIsTabLoading(false), 220);
  };

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      if (typeof window !== 'undefined') window.location.href = '/admin/login';
      return;
    }
    adminApi
      .getMe()
      .then((res) => setAdminUser(res.admin))
      .catch((err) => {
        console.error('Failed fetching admin user:', err);
        removeAdminToken();
        if (typeof window !== 'undefined') window.location.href = '/admin/login';
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // ignore network errors
    } finally {
      removeAdminToken();
      toast.success('Logged out from Admin Dashboard');
      if (onLogoutSuccess) {
        onLogoutSuccess();
      } else if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
    }
  };

  if (loading) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <CustomPageLoader mode="admin" />
      </div>
    );
  }

  const activeItem = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex selection:bg-emerald-500/30 selection:text-emerald-200">
      <TopProgressBar isLoading={isTabLoading} />

      {/* ── Mobile backdrop ── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          aria-hidden="true"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════
          LEFT SIDEBAR
      ══════════════════════════════════════════ */}
      <aside
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 h-full z-50 w-64
          bg-[#0f1623]/95 backdrop-blur-xl
          border-r border-white/[0.06]
          flex flex-col
          transition-transform duration-300 ease-out
          lg:translate-x-0 lg:z-30
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* ── Brand header ── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-emerald-900/40 shrink-0">
            HB
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-white truncate">
                HabeshaBiz
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Shield className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/80">
                Superadmin
              </span>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors lg:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-label="Admin Navigation">
          <p className="px-2 mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">
            Platform
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                  transition-all duration-150 cursor-pointer group
                  ${isActive
                    ? 'bg-white/[0.07] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }
                `}
              >
                {/* Icon pill */}
                <span className={`
                  w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                  transition-colors duration-150
                  ${isActive ? `${item.accentBg} ${item.accent}` : 'bg-white/[0.05] text-slate-500 group-hover:text-slate-300'}
                `}>
                  <Icon className="w-3.5 h-3.5" />
                </span>

                {/* Label + description */}
                <div className="min-w-0 flex-1">
                  <span className={`block text-xs font-semibold truncate ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </span>
                  <span className="block text-[10px] text-slate-600 truncate leading-tight mt-0.5">
                    {item.description}
                  </span>
                </div>

                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── User footer ── */}
        <div className="px-3 py-3 border-t border-white/[0.06] space-y-1">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors cursor-pointer group"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0 group-hover:bg-white/[0.08] transition-colors">
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-300" />
              )}
            </span>
            <span className="text-xs font-medium">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/[0.08] transition-colors cursor-pointer group"
          >
            <span className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0 group-hover:bg-rose-500/[0.12] transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-medium">Sign Out</span>
          </button>

          {/* Admin user identity */}
          {adminUser && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shrink-0 text-[10px] font-black text-slate-200 uppercase">
                {adminUser.name?.charAt(0) ?? 'A'}
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold text-slate-200 truncate">
                  {adminUser.name}
                </span>
                <span className="block text-[9px] text-slate-500 font-mono truncate">
                  {adminUser.email}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MAIN AREA (offset by sidebar width on lg+)
      ══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">

        {/* ── Topbar ── */}
        <header className="sticky top-0 z-20 h-14 flex items-center gap-3 px-4 sm:px-6 bg-[#0b0f17]/90 backdrop-blur-md border-b border-white/[0.05]">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-1 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors lg:hidden cursor-pointer"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb / page title */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <Shield className="w-3 h-3 text-amber-500/70" />
              <span>Superadmin</span>
              <span className="text-slate-700">/</span>
            </span>
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-md flex items-center justify-center ${activeItem.accentBg} shrink-0`}>
                <activeItem.icon className={`w-3 h-3 ${activeItem.accent}`} />
              </span>
              <h1 className="text-sm font-bold text-white truncate">
                {PAGE_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-400">Platform Live</span>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 px-4 sm:px-6 py-6">
          {isTabLoading ? (
            <CustomPageLoader mode="admin" fullScreen={false} />
          ) : (
            <>
              {activeTab === 'tenants' && <AdminTenantsView />}
              {activeTab === 'whitelist' && <AdminWhitelistView />}
              {activeTab === 'waitlist' && <AdminWaitlistView />}
              {activeTab === 'signup-attempts' && <AdminSignupAttemptsView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
