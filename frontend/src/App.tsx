import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  User,
  Tenant,
  DashboardData,
  FinancialAccount,
  Contact,
  InventoryUnit,
  SalesOrder,
} from './api/client';
import {
  api,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
} from './api/client';
import { Sidebar, type NavTab } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { OverviewView } from './views/OverviewView';
import { CounterView } from './views/CounterView';
import { InventoryView } from './views/InventoryView';
import { SalesHistoryView } from './views/SalesHistoryView';
import { DebtsView } from './views/DebtsView';
import { TreasuryView } from './views/TreasuryView';
import { ExpensesView } from './views/ExpensesView';
import { ReportsView } from './views/ReportsView';
import { StaffView } from './views/StaffView';
import { StaffOverviewView } from './views/StaffOverviewView';
import { PartnersView } from './views/PartnersView';
import { LogsView } from './views/LogsView';
import { SettingsView } from './views/SettingsView';
import { OnboardingView } from './views/OnboardingView';
import { PublicStatementView } from './views/PublicStatementView';
import { SuspendedView } from './views/SuspendedView';
import { AdminLoginView } from './views/admin/AdminLoginView';
import { AdminLayout } from './views/admin/AdminLayout';
import { getAdminToken } from './api/adminClient';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { QuickSearchModal, type NavigationPayload } from './components/QuickSearchModal';
import { MobileBottomNav } from './components/navigation/MobileBottomNav';
import { SpeedDialFAB } from './components/navigation/SpeedDialFAB';
import { CustomPageLoader } from './components/loading/CustomPageLoader';
import { TopProgressBar } from './components/loading/TopProgressBar';
import { Toaster, toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';

export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);

  const handleNavigateTab = useCallback((tab: NavTab) => {
    if (tab === activeTab) return;
    setIsPageLoading(true);
    setActiveTab(tab);
    setTimeout(() => {
      setIsPageLoading(false);
    }, 320);
  }, [activeTab]);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState<boolean>(false);
  const [navContext, setNavContext] = useState<{
    unit?: InventoryUnit | null;
    order?: SalesOrder | null;
    partnerId?: string | null;
    account?: FinancialAccount | null;
    showIntake?: boolean;
    showRecordExpense?: boolean;
  }>({});
  const resolveCurrentPath = () => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.startsWith('#/admin') || hash.startsWith('#admin')) return '/admin';
      if (hash.startsWith('#/onboard') || hash.startsWith('#onboard')) return '/onboard';
      return window.location.pathname;
    }
    return '/';
  };

  const [currentPath, setCurrentPath] = useState<string>(resolveCurrentPath);

  const [isOnboarding, setIsOnboarding] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return resolveCurrentPath() === '/onboard';
    }
    return false;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const p = resolveCurrentPath();
      setCurrentPath(p);
      setIsOnboarding(p === '/onboard');
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleClearNavContext = useCallback(() => {
    setNavContext({});
  }, []);

  const handleQuickSearchNavigate = useCallback((payload: NavigationPayload) => {
    setNavContext({
      unit: payload.unit || null,
      order: payload.order || null,
      partnerId: payload.partnerId || null,
      account: payload.account || null,
      showIntake: payload.action === 'stock_intake',
      showRecordExpense: payload.action === 'new_expense',
    });
    setActiveTab(payload.tab);
    setIsQuickSearchOpen(false);
  }, []);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('habeshabiz_theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('habeshabiz_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);

  // Load app data when user is authenticated
  const refreshData = useCallback(async (monthOverride?: string) => {
    try {
      const targetMonth = monthOverride !== undefined ? monthOverride : selectedMonth;
      const [dashRes, accountsRes, contactsRes] = await Promise.all([
        api.getDashboardSummary(targetMonth),
        api.getAccounts({ month: targetMonth }),
        api.getContacts(),
      ]);

      setDashboardData(dashRes);
      const combinedAccounts = [
        ...(accountsRes.treasury_accounts || []),
        ...(accountsRes.asset_accounts || []),
      ];
      setAccounts(combinedAccounts);
      setContacts(contactsRes);
    } catch (err) {
      console.error('Failed refreshing workspace data:', err);
    }
  }, [selectedMonth]);

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    refreshData(newMonth);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const key = e.key;
        const isOwner = user?.role === 'owner';
        const tabMap: Record<string, NavTab> = {
          '1': 'overview',
          '2': 'counter',
          '3': 'inventory',
          '4': 'sales',
          ...(isOwner
            ? {
                '5': 'partners',
                '6': 'debts',
                '7': 'treasury',
                '8': 'expenses',
                'r': 'reports',
                'R': 'reports',
                '9': 'staff',
                '0': 'logs',
                ',': 'settings',
              }
            : {}),
        };
        if (key === 'k' || key === 'K') {
          e.preventDefault();
          setIsQuickSearchOpen((prev) => !prev);
          return;
        }

        if (tabMap[key]) {
          e.preventDefault();
          setActiveTab(tabMap[key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  // Fallback to overview if active tab is restricted for non-owner role
  useEffect(() => {
    if (user && user.role !== 'owner') {
      const ownerOnlyTabs: NavTab[] = ['partners', 'debts', 'treasury', 'expenses', 'reports', 'staff', 'logs', 'settings'];
      if (ownerOnlyTabs.includes(activeTab)) {
        setActiveTab('overview');
      }
    }
  }, [user, activeTab]);

  // Refresh dashboard whenever overview tab becomes active
  useEffect(() => {
    if (activeTab === 'overview' && user) {
      refreshData();
    }
  }, [activeTab, user, refreshData]);

  // Check existing session on boot (no hardcoded auto-login)
  useEffect(() => {
    const initSession = async () => {
      if (typeof window !== 'undefined') {
        const p = window.location.pathname;
        if (p.startsWith('/admin') || p === '/suspended' || p.startsWith('/statement/')) {
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      const token = getAuthToken();

      if (token) {
        try {
          const me = await api.getMe();
          setUser(me.user);
          setTenant(me.tenant);
          await refreshData();
          setLoading(false);
          return;
        } catch {
          removeAuthToken();
        }
      }

      setLoading(false);
    };

    initSession();
  }, [refreshData]);

  // Handle manual login
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    try {
      const res = await api.login({ email, password });
      setAuthToken(res.token);
      await refreshData();
      setUser(res.user);
      setTenant(res.tenant);
      toast.success(`Welcome back, ${res.user.name}`);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid credentials. Please try again.');
      toast.error('Sign in failed', { description: err.message });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      removeAuthToken();
      setUser(null);
      setTenant(null);
      setDashboardData(null);
      toast.info('Signed out');
    }
  };

  // Public statement link routing (e.g. /statement/{token} or ?statement_token={token})
  const publicStatementToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.startsWith('/statement/')) {
      const parts = path.split('/');
      return parts[2] || null;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('statement_token') || null;
  }, []);

  if (publicStatementToken) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <PublicStatementView token={publicStatementToken} />
        <Toaster position="bottom-right" richColors closeButton theme={theme} />
      </div>
    );
  }

  // Suspended account view
  if (currentPath === '/suspended') {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <Toaster position="bottom-right" richColors closeButton theme={theme} />
        <SuspendedView
          onBackToLogin={() => {
            setCurrentPath('/');
            if (typeof window !== 'undefined' && window.history.pushState) {
              window.history.pushState({}, '', '/');
            }
          }}
        />
      </div>
    );
  }

  // Platform Admin portal
  if (currentPath.startsWith('/admin')) {
    const adminToken = getAdminToken();
    if (!adminToken || currentPath === '/admin/login') {
      return (
        <div className={theme === 'dark' ? 'dark' : ''}>
          <Toaster position="bottom-right" richColors closeButton theme={theme} />
          <AdminLoginView
            onSuccess={() => {
              setCurrentPath('/admin');
              if (typeof window !== 'undefined' && window.history.pushState) {
                window.history.pushState({}, '', '/admin');
              }
            }}
            onBackToStore={() => {
              setCurrentPath('/');
              if (typeof window !== 'undefined' && window.history.pushState) {
                window.history.pushState({}, '', '/');
              }
            }}
          />
        </div>
      );
    }

    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <Toaster position="bottom-right" richColors closeButton theme={theme} />
        <AdminLayout
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onLogoutSuccess={() => {
            setCurrentPath('/admin/login');
            if (typeof window !== 'undefined' && window.history.pushState) {
              window.history.pushState({}, '', '/admin/login');
            }
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <CustomPageLoader mode="app" />
      </div>
    );
  }

  // Not authenticated view (Elevated Apple Enterprise / Finova sign-in or Onboarding)
  if (!user) {
    if (isOnboarding) {
      return (
        <div className={theme === 'dark' ? 'dark' : ''}>
          <Toaster position="bottom-right" richColors closeButton theme={theme} />
          <OnboardingView
            onSuccess={async (token, newUser, newTenant) => {
              setAuthToken(token);
              await refreshData();
              setUser(newUser);
              setTenant(newTenant);
              setIsOnboarding(false);
              setCurrentPath('/');
              if (typeof window !== 'undefined' && window.history.pushState) {
                window.history.pushState({}, '', '/');
              }
            }}
            onCancelToLogin={() => {
              setIsOnboarding(false);
              setCurrentPath('/');
              if (typeof window !== 'undefined' && window.history.pushState) {
                window.history.pushState({}, '', '/');
              }
            }}
          />
        </div>
      );
    }

    return (
      <div className="auth-shell min-h-screen flex flex-col items-center justify-center p-4 selection:bg-emerald-300 selection:text-emerald-950 transition-colors duration-200">
        <Toaster position="bottom-right" richColors closeButton theme={theme} />
        <div className="auth-panel w-full max-w-sm bg-white dark:bg-[#131926] rounded-2xl border border-white/70 dark:border-emerald-100/10 p-7 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 mx-auto flex items-center justify-center font-bold text-xs mb-3 shadow-xs tracking-tight">
              HB
            </div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">HabeshaBiz</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Store & Inventory Management
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-400">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full h-10 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {isSubmittingAuth ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsOnboarding(true);
                setCurrentPath('/onboard');
                if (typeof window !== 'undefined' && window.history.pushState) {
                  window.history.pushState({}, '', '/onboard');
                }
              }}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>New business? Set up your workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const netCapital = dashboardData?.capital_overview?.net_capital ?? null;
  const openDebtsCount = (dashboardData?.counts?.open_receivables ?? 0) + (dashboardData?.counts?.open_payables ?? 0);

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 flex font-sans selection:bg-slate-900 selection:text-white transition-colors duration-200">
      <TopProgressBar isLoading={isPageLoading} />
      <Toaster position="bottom-right" richColors closeButton theme={theme} />

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        onChangeTab={handleNavigateTab}
        user={user}
        tenant={tenant}
        netCapital={netCapital}
        openDebtsCount={openDebtsCount}
        onLogout={handleLogout}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Header */}
        <Topbar
          activeTab={activeTab}
          user={user}
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onQuickAction={() => handleNavigateTab('counter')}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* View Surface */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto pb-28 md:pb-8 flex flex-col">
          {isPageLoading ? (
            <CustomPageLoader mode="app" fullScreen={false} />
          ) : (
            <>
              {activeTab === 'overview' && (
                user?.role === 'owner' ? (
                  <OverviewView
                    data={dashboardData}
                    user={user}
                    accounts={accounts}
                    selectedMonth={selectedMonth}
                    onNavigateTab={handleNavigateTab}
                    onRefreshData={refreshData}
                  />
                ) : (
                  <StaffOverviewView
                    user={user}
                    onNavigateTab={handleNavigateTab}
                  />
                )
              )}

              {activeTab === 'counter' && (
                <CounterView
                  user={user}
                  accounts={accounts}
                  contacts={contacts}
                  onSaleSuccess={refreshData}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryView
                  user={user}
                  onInventoryChange={refreshData}
                  initialSelectedUnit={navContext.unit}
                  initialShowIntake={navContext.showIntake}
                  onClearInitialContext={handleClearNavContext}
                />
              )}

              {activeTab === 'sales' && (
                <SalesHistoryView
                  user={user}
                  tenant={tenant}
                  initialSelectedOrder={navContext.order}
                  onClearInitialContext={handleClearNavContext}
                />
              )}

              {/* Owner-only Tabs */}
              {activeTab === 'partners' && user?.role === 'owner' && (
                <PartnersView
                  user={user}
                  onNavigateTab={handleNavigateTab}
                  onRefreshContacts={refreshData}
                  initialSelectedPartnerId={navContext.partnerId}
                  onClearInitialContext={handleClearNavContext}
                />
              )}
              {activeTab === 'debts' && user?.role === 'owner' && (
                <DebtsView accounts={accounts} />
              )}

              {activeTab === 'treasury' && user?.role === 'owner' && (
                <TreasuryView
                  accounts={accounts}
                  initialSelectedAccount={navContext.account}
                  onClearInitialContext={handleClearNavContext}
                />
              )}

              {activeTab === 'expenses' && user?.role === 'owner' && (
                <ExpensesView
                  accounts={accounts}
                  user={user}
                  initialShowRecordExpense={navContext.showRecordExpense}
                  onClearInitialContext={handleClearNavContext}
                />
              )}

              {activeTab === 'reports' && user?.role === 'owner' && (
                <ReportsView tenant={tenant} selectedMonth={selectedMonth} />
              )}

              {activeTab === 'staff' && user?.role === 'owner' && (
                <StaffView currentUser={user} />
              )}

              {activeTab === 'logs' && user?.role === 'owner' && (
                <LogsView currentUser={user} />
              )}

              {activeTab === 'settings' && user?.role === 'owner' && (
                <SettingsView
                  user={user}
                  tenant={tenant}
                  onProfileUpdated={(updatedTenant, updatedUser) => {
                    setTenant(updatedTenant);
                    setUser(updatedUser);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Profile & Password Management Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUserUpdated={(updatedUser) => {
          setUser((prev) => (prev ? { ...prev, ...updatedUser } : updatedUser));
        }}
      />

      {/* Global Quick Search & Command Palette (⌘K) */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        user={user}
        accounts={accounts}
        onNavigate={handleQuickSearchNavigate}
      />

      {/* Mobile Floating Action Button (Speed Dial) - hidden on counter so it never obstructs checkout */}
      {activeTab !== 'counter' && (
        <SpeedDialFAB
          onNewSale={() => handleNavigateTab('counter')}
          onRecordExpense={() => {
            setNavContext({ showRecordExpense: true });
            handleNavigateTab('expenses');
          }}
          onStockIntake={() => {
            setNavContext({ showIntake: true });
            handleNavigateTab('inventory');
          }}
          isOwner={user?.role === 'owner'}
        />
      )}

      {/* Mobile Native Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onChangeTab={handleNavigateTab}
        onOpenDrawer={() => setIsMobileSidebarOpen(true)}
        openDebtsCount={openDebtsCount}
      />
    </div>
  );
}
