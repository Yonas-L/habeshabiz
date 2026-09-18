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
import { Header } from './components/Header';
import { Navigation, type NavTab } from './components/Navigation';
import { OverviewView } from './views/OverviewView';
import { CounterView } from './views/CounterView';
import { InventoryView } from './views/InventoryView';
import { SalesHistoryView } from './views/SalesHistoryView';
import { DebtsView } from './views/DebtsView';
import { TreasuryView } from './views/TreasuryView';
import { ExpensesView } from './views/ExpensesView';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
    } catch (err: any) {
      setAuthError(err.message || 'Invalid credentials. Please try again.');
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
    } catch (err) {
      console.error('Quick switch failed:', err);
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
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
          <span className="text-sm font-medium tracking-tight">Connecting to HabeshaBiz...</span>
        </div>
      </div>
    );
  }

  // Not authenticated view
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-lg mb-3 shadow-xs">
              HB
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">HabeshaBiz</h1>
            <p className="text-xs text-slate-500 mt-1">Addis Ababa Retail & Small Business OS</p>
          </div>

          {authError && (
            <div className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200/60 text-xs text-rose-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {isSubmittingAuth ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-3 text-center">
              Quick Switch Demo Roles
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setEmail('yoni@boletech.et');
                  setPassword('password123');
                  handleQuickSwitchUser('yoni@boletech.et');
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="text-xs font-medium text-slate-900">Yoni (Owner)</div>
                <div className="text-[10px] text-slate-500">Full capital & margins</div>
              </button>
              <button
                onClick={() => {
                  setEmail('husa@boletech.et');
                  setPassword('password123');
                  handleQuickSwitchUser('husa@boletech.et');
                }}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="text-xs font-medium text-slate-900">Husa (Sales)</div>
                <div className="text-[10px] text-slate-500">Cost-masked counter</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const netCapital = dashboardData?.capital_overview?.net_capital ?? null;
  const openReceivablesCount = dashboardData?.counts?.open_receivables ?? 0;
  const openPayablesCount = dashboardData?.counts?.open_payables ?? 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Header bar */}
      <Header
        user={user}
        tenant={tenant}
        netCapital={netCapital}
        onLogout={handleLogout}
        onQuickSwitchUser={handleQuickSwitchUser}
      />

      {/* Main navigation */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        openReceivablesCount={openReceivablesCount}
        openPayablesCount={openPayablesCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
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

      {/* Footer info */}
      <footer className="border-t border-slate-200/80 bg-white py-4 px-4 lg:px-8 text-xs text-slate-400 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>HabeshaBiz Small Business Management OS &copy; 2026</span>
          <span className="text-[11px] text-slate-500">
            PostgreSQL 17 &bull; Laravel 13 &bull; React 19 &bull; Addis Ababa, Ethiopia
          </span>
        </div>
      </footer>
    </div>
  );
}
