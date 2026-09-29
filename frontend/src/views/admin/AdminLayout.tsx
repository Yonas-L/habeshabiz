import React, { useState, useEffect } from 'react';
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

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  theme,
  onToggleTheme,
  onLogoutSuccess,
}) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Tab detection from path
  const getTabFromPath = (): AdminTab => {
    if (typeof window === 'undefined') return 'tenants';
    const path = window.location.pathname;
    if (path.includes('/admin/whitelist')) return 'whitelist';
    if (path.includes('/admin/waitlist')) return 'waitlist';
    if (path.includes('/admin/signup-attempts')) return 'signup-attempts';
    return 'tenants';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getTabFromPath);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [isTabLoading, setIsTabLoading] = useState(false);

  const handleTabChange = (tab: AdminTab) => {
    setIsTabLoading(true);
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    const targetPath = tab === 'tenants' ? '/admin' : `/admin/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setTimeout(() => {
      setIsTabLoading(false);
    }, 250);
  };

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
      return;
    }

    adminApi
      .getMe()
      .then((res) => {
        setAdminUser(res.admin);
      })
      .catch((err) => {
        console.error('Failed fetching admin user:', err);
        removeAdminToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/admin/login';
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch (e) {
      // Ignore network errors on logout
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

  const navItems: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'tenants', label: 'Tenants', icon: Building2 },
    { id: 'whitelist', label: 'Whitelist', icon: ShieldCheck },
    { id: 'waitlist', label: 'Waitlist', icon: Users },
    { id: 'signup-attempts', label: 'Signup Attempts', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-slate-900 selection:text-white">
      <TopProgressBar isLoading={isTabLoading} />
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#131926] border-b border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-xs shadow-xs tracking-tight">
              HB
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  HabeshaBiz
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[9px] font-bold uppercase tracking-wider">
                  <Shield className="w-2.5 h-2.5" />
                  Superadmin
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Platform Operations & Governance
              </p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/70 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User & Actions */}
          <div className="flex items-center gap-3">
            {/* Admin User Info */}
            {adminUser && (
              <div className="hidden sm:block text-right">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {adminUser.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block">
                  {adminUser.email}
                </span>
              </div>
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 text-xs font-medium transition-colors cursor-pointer"
              title="Sign out of Admin Dashboard"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
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
  );
};
