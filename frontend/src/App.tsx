import React, { useState, useEffect, useCallback } from 'react';
import type {
  User,
  Tenant,
  DashboardData,
  FinancialAccount,
  Contact,
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
import { Toaster, toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
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
  const [email, setEmail] = useState('yoni@boletech.et');
  const [password, setPassword] = useState('password123');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);

  // Load app data when user is authenticated
  const refreshData = useCallback(async () => {
    try {
      const [dashRes, accountsRes, contactsRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getAccounts(),
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
  }, []);

  // Keyboard navigation shortcuts (⌘1 - ⌘7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const key = e.key;
        const tabMap: Record<string, NavTab> = {
          '1': 'overview',
          '2': 'counter',
          '3': 'inventory',
          '4': 'sales',
          '5': 'debts',
          '6': 'treasury',
          '7': 'expenses',
        };
        if (tabMap[key]) {
          e.preventDefault();
          setActiveTab(tabMap[key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check existing session or perform initial login
  useEffect(() => {
    const initSession = async () => {
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

      // Auto-authenticate with seeded owner credentials for instant experience
      try {
        const res = await api.login({ email: 'yoni@boletech.et', password: 'password123' });
        setAuthToken(res.token);
        setUser(res.user);
        setTenant(res.tenant);
        await refreshData();
      } catch {
        // Fallback to manual login screen if backend isn't seeded yet
      } finally {
        setLoading(false);
      }
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
      setUser(res.user);
      setTenant(res.tenant);
      await refreshData();
      toast.success(`Welcome back, ${res.user.name}`);
    } catch (err: any) {
      setAuthError(err.message || 'Invalid credentials. Please try again.');
      toast.error('Sign in failed', { description: err.message });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Switch between Yoni (owner) and Husa (salesperson)
  const handleQuickSwitchUser = async (targetEmail: string) => {
    setLoading(true);
    try {
      const res = await api.login({ email: targetEmail, password: 'password123' });
      setAuthToken(res.token);
      setUser(res.user);
      setTenant(res.tenant);
      await refreshData();
      toast.info(`Switched view to ${res.user.name} (${res.user.role})`);
    } catch (err: any) {
      toast.error('Persona switch failed', { description: err.message });
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fa] flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2.5 text-slate-700 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
          <span className="text-xs font-medium tracking-tight">Syncing HabeshaBiz workspace...</span>
        </div>
      </div>
    );
  }

  // Not authenticated view (Elevated Apple Enterprise / Finova sign-in)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0b0f17] flex flex-col items-center justify-center p-4 selection:bg-slate-900 selection:text-white transition-colors duration-200">
        <Toaster position="bottom-right" richColors closeButton theme={theme} />
        <div className="w-full max-w-md bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)]">
          <div className="text-center mb-7">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 text-white mx-auto flex items-center justify-center font-extrabold text-base mb-3.5 shadow-md ring-4 ring-slate-50 dark:ring-slate-800">
              HB
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">HabeshaBiz</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
              Retail & Electronics Store Management
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-400">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-600 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-600 shadow-2xs"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full h-11 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-[0.98]"
            >
              {isSubmittingAuth ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Personas */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 text-center">
              Quick Switch Demo Personas
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setEmail('yoni@boletech.et');
                  setPassword('password123');
                  handleQuickSwitchUser('yoni@boletech.et');
                }}
                className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 hover:border-slate-900/20 dark:hover:border-slate-500 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-black dark:group-hover:text-white">Yoni</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                    Owner
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Full capital & margins</div>
              </button>

              <button
                onClick={() => {
                  setEmail('husa@boletech.et');
                  setPassword('password123');
                  handleQuickSwitchUser('husa@boletech.et');
                }}
                className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 hover:border-slate-900/20 dark:hover:border-slate-500 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-black dark:group-hover:text-white">Husa</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                    Sales
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Cost-masked counter</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const netCapital = dashboardData?.capital_overview?.net_capital ?? null;
  const openDebtsCount = (dashboardData?.counts?.open_receivables ?? 0) + (dashboardData?.counts?.open_payables ?? 0);

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 flex font-sans selection:bg-slate-900 selection:text-white transition-colors duration-200">
      <Toaster position="bottom-right" richColors closeButton theme={theme} />

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        user={user}
        tenant={tenant}
        netCapital={netCapital}
        openDebtsCount={openDebtsCount}
        onLogout={handleLogout}
        onQuickSwitchUser={handleQuickSwitchUser}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Header */}
        <Topbar
          activeTab={activeTab}
          user={user}
          netCapital={netCapital}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onQuickAction={() => setActiveTab('counter')}
        />

        {/* View Surface */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              data={dashboardData}
              user={user}
              accounts={accounts}
              onNavigateTab={setActiveTab}
              onRefreshData={refreshData}
            />
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
            <InventoryView user={user} />
          )}

          {activeTab === 'sales' && (
            <SalesHistoryView user={user} />
          )}

          {activeTab === 'debts' && (
            <DebtsView accounts={accounts} />
          )}

          {activeTab === 'treasury' && (
            <TreasuryView />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView accounts={accounts} />
          )}
        </main>
      </div>
    </div>
  );
}
