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

  // Not authenticated view (Squarish, clean Apple Enterprise sign-in)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f6f8fa] flex flex-col items-center justify-center p-4">
        <Toaster position="bottom-right" richColors closeButton />
        <div className="w-full max-w-sm bg-white rounded-lg border border-slate-200/90 p-6 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-10 h-10 rounded-md bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-sm mb-2.5 shadow-xs">
              HB
            </div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">HabeshaBiz</h1>
            <p className="text-xs text-slate-400 mt-0.5">Addis Ababa Retail & Small Business OS</p>
          </div>

          {authError && (
            <div className="mb-4 p-2.5 rounded-md bg-rose-50 border border-rose-200/70 text-xs text-rose-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full h-8 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 active:scale-[0.98]"
            >
              {isSubmittingAuth ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-2 text-center">
              Quick Switch Demo Personas
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  setEmail('yoni@boletech.et');
                  setPassword('password123');
                  handleQuickSwitchUser('yoni@boletech.et');
                }}
                className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="text-xs font-semibold text-slate-900">Yoni (Owner)</div>
                <div className="text-[10px] text-slate-400">Full capital & margins</div>
              </button>
              <button
                onClick={() => {
                  setEmail('husa@boletech.et');
                  setPassword('password123');
                  handleQuickSwitchUser('husa@boletech.et');
                }}
                className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="text-xs font-semibold text-slate-900">Husa (Sales)</div>
                <div className="text-[10px] text-slate-400">Cost-masked counter</div>
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
    <div className="min-h-screen bg-[#f6f8fa] text-slate-900 flex font-sans selection:bg-slate-900 selection:text-white">
      <Toaster position="bottom-right" richColors closeButton />

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
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onQuickAction={() => setActiveTab('counter')}
        />

        {/* View Surface */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              data={dashboardData}
              user={user}
              onNavigateTab={setActiveTab}
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
