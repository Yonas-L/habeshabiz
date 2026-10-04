import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { NavTab } from './Sidebar';
import type { User, InventoryUnit, Contact, SalesOrder, FinancialAccount } from '../api/client';
import { api } from '../api/client';
import {
  Search,
  X,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Handshake,
  CreditCard,
  Landmark,
  DollarSign,
  FileBarChart,
  Users,
  ScrollText,
  Plus,
  Tag,
  Loader2,
  CornerDownLeft,
  Wallet,
} from 'lucide-react';

export interface NavigationPayload {
  tab: NavTab;
  unit?: InventoryUnit;
  order?: SalesOrder;
  partnerId?: string;
  account?: FinancialAccount;
  action?: 'new_sale' | 'stock_intake' | 'new_expense';
}

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  accounts?: FinancialAccount[];
  onNavigate: (payload: NavigationPayload) => void;
}

interface SearchItem {
  id: string;
  type: 'navigation' | 'action' | 'inventory' | 'contact' | 'sale' | 'account';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.FC<{ className?: string }>;
  shortcut?: string;
  onSelect: () => void;
}

interface CachedRemoteResults {
  inventory: InventoryUnit[];
  contacts: Contact[];
  sales: SalesOrder[];
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  user,
  accounts = [],
  onNavigate,
}) => {
  const isOwner = user?.role === 'owner';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Live remote search results
  const [inventoryResults, setInventoryResults] = useState<InventoryUnit[]>([]);
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [salesResults, setSalesResults] = useState<SalesOrder[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  // In-memory query cache & request sequence tracker for optimal performance and debounce safety
  const cacheRef = useRef<Map<string, CachedRemoteResults>>(new Map());
  const requestSeqRef = useRef<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto focus input on open & clear state
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setInventoryResults([]);
      setContactResults([]);
      setSalesResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Live search debounced with in-memory caching and request cancellation
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setInventoryResults([]);
      setContactResults([]);
      setSalesResults([]);
      setIsSearchingRemote(false);
      return;
    }

    const lowerQuery = trimmed.toLowerCase();

    // Check instant cache first (0ms latency for backspaces / repeated terms)
    if (cacheRef.current.has(lowerQuery)) {
      const cached = cacheRef.current.get(lowerQuery)!;
      setInventoryResults(cached.inventory);
      setContactResults(cached.contacts);
      setSalesResults(cached.sales);
      setIsSearchingRemote(false);
      return;
    }

    setIsSearchingRemote(true);
    const seq = ++requestSeqRef.current;

    const timer = setTimeout(async () => {
      try {
        const promises: [Promise<InventoryUnit[]>, Promise<any>, Promise<Contact[]>?] = [
          api.getInventoryUnits({ search: trimmed }),
          api.getSales({ search: trimmed }),
        ];

        if (isOwner) {
          promises.push(api.getContacts({ search: trimmed }));
        }

        const [invRes, salesRes, contactsRes] = await Promise.all(promises);

        // If another query has been fired in the meantime, discard stale result
        if (seq !== requestSeqRef.current) return;

        const inventory = (invRes || []).slice(0, 6);
        const sales = (salesRes || []).slice(0, 5);
        const contacts = isOwner && contactsRes ? (contactsRes || []).slice(0, 5) : [];

        // Save into cache
        cacheRef.current.set(lowerQuery, { inventory, contacts, sales });

        setInventoryResults(inventory);
        setSalesResults(sales);
        setContactResults(contacts);
      } catch (err) {
        if (seq === requestSeqRef.current) {
          console.error('Quick search error:', err);
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setIsSearchingRemote(false);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOwner]);

  // Static navigation routes
  const navigationItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [
      {
        id: 'nav-overview',
        type: 'navigation',
        title: 'Dashboard Overview',
        subtitle: 'Capital, performance & financial snapshot',
        icon: LayoutDashboard,
        shortcut: '⌘1',
        onSelect: () => onNavigate({ tab: 'overview' }),
      },
      {
        id: 'nav-counter',
        type: 'navigation',
        title: 'Sales Counter (POS)',
        subtitle: 'Create a sale, retail checkout & customer invoices',
        icon: ShoppingCart,
        shortcut: '⌘2',
        onSelect: () => onNavigate({ tab: 'counter' }),
      },
      {
        id: 'nav-inventory',
        type: 'navigation',
        title: 'Stock & Inventory',
        subtitle: 'Device serials, IMEIs, warehouse units & intake',
        icon: Package,
        shortcut: '⌘3',
        onSelect: () => onNavigate({ tab: 'inventory' }),
      },
      {
        id: 'nav-sales',
        type: 'navigation',
        title: 'Sales History',
        subtitle: 'Past transactions, profit margins & receipts',
        icon: Receipt,
        shortcut: '⌘4',
        onSelect: () => onNavigate({ tab: 'sales' }),
      },
    ];

    if (isOwner) {
      items.push(
        {
          id: 'nav-partners',
          type: 'navigation',
          title: 'Vendors & Partners',
          subtitle: 'Peer shops, suppliers, bilateral statements & ledgers',
          icon: Handshake,
          shortcut: '⌘5',
          onSelect: () => onNavigate({ tab: 'partners' }),
        },
        {
          id: 'nav-debts',
          type: 'navigation',
          title: 'Receivable & Payable',
          subtitle: 'Customer credit, vendor payouts & bilateral net holdings',
          icon: CreditCard,
          shortcut: '⌘6',
          onSelect: () => onNavigate({ tab: 'debts' }),
        },
        {
          id: 'nav-treasury',
          type: 'navigation',
          title: 'Treasury & Cash',
          subtitle: 'Bank accounts, mobile wallets, cash drawer & reserves',
          icon: Landmark,
          shortcut: '⌘7',
          onSelect: () => onNavigate({ tab: 'treasury' }),
        },
        {
          id: 'nav-expenses',
          type: 'navigation',
          title: 'Expenses & Overhead',
          subtitle: 'Operating costs, rent, vendor wires & owner draws',
          icon: DollarSign,
          shortcut: '⌘8',
          onSelect: () => onNavigate({ tab: 'expenses' }),
        },
        {
          id: 'nav-reports',
          type: 'navigation',
          title: 'Business Reports',
          subtitle: 'Profit, sales trends, stock, repairs and vendor activity',
          icon: FileBarChart,
          shortcut: '⌘R',
          onSelect: () => onNavigate({ tab: 'reports' }),
        },
        {
          id: 'nav-staff',
          type: 'navigation',
          title: 'Staff & Team',
          subtitle: 'Manage team permissions, commissions & credentials',
          icon: Users,
          shortcut: '⌘9',
          onSelect: () => onNavigate({ tab: 'staff' }),
        },
        {
          id: 'nav-logs',
          type: 'navigation',
          title: 'Audit & System Logs',
          subtitle: 'Immutable security tracking, data diffs & change events',
          icon: ScrollText,
          shortcut: '⌘0',
          onSelect: () => onNavigate({ tab: 'logs' }),
        }
      );
    }

    return items;
  }, [isOwner, onNavigate]);

  // Quick Action items
  const actionItems: SearchItem[] = useMemo(() => {
    const list: SearchItem[] = [
      {
        id: 'act-new-sale',
        type: 'action',
        title: 'Record a New Sale',
        subtitle: 'Open POS register to ring up a device',
        icon: Plus,
        onSelect: () => onNavigate({ tab: 'counter', action: 'new_sale' }),
      },
      {
        id: 'act-stock-intake',
        type: 'action',
        title: 'Add Stock',
        subtitle: 'Receive devices or accessories into inventory',
        icon: Package,
        onSelect: () => onNavigate({ tab: 'inventory', action: 'stock_intake' }),
      },
    ];

    if (isOwner) {
      list.push({
        id: 'act-new-expense',
        type: 'action',
        title: 'Record Expense',
        subtitle: 'Log operational expense, rent, transfer or draw',
        icon: DollarSign,
        onSelect: () => onNavigate({ tab: 'expenses', action: 'new_expense' }),
      });
    }

    return list;
  }, [isOwner, onNavigate]);

  // Accounts filter (In-memory instantaneous search)
  const accountItems: SearchItem[] = useMemo(() => {
    if (!isOwner || !accounts.length) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const matched = accounts.filter(
      (acc) =>
        acc.name.toLowerCase().includes(q) ||
        (acc.account_number && acc.account_number.toLowerCase().includes(q)) ||
        acc.type.toLowerCase().includes(q)
    );

    return matched.slice(0, 4).map((acc) => ({
      id: `acc-${acc.id}`,
      type: 'account',
      title: acc.name,
      subtitle: `${acc.account_number ? `Acc: ${acc.account_number} · ` : ''}${Number(acc.current_balance).toLocaleString()} ETB · ${acc.type.toUpperCase()}`,
      badge: acc.type,
      icon: acc.type === 'cash' ? Wallet : Landmark,
      onSelect: () => onNavigate({ tab: 'treasury', account: acc }),
    }));
  }, [isOwner, accounts, query, onNavigate]);

  // Build combined searchable list
  const combinedItems: SearchItem[] = useMemo(() => {
    const q = query.toLowerCase().trim();

    // 1. Navigation items filtered by query
    const filteredNav = q
      ? navigationItems.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(q))
        )
      : navigationItems;

    // 2. Action items filtered by query
    const filteredActions = q
      ? actionItems.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(q))
        )
      : actionItems;

    // 3. Remote Inventory items
    const inventoryItemsList: SearchItem[] = inventoryResults.map((unit) => {
      const model = unit.variant?.product?.name || 'Device';
      const variantDesc = [unit.variant?.storage, unit.variant?.color].filter(Boolean).join(' ');
      const title = `${model} ${variantDesc}`.trim();
      const statusLabel = unit.status.replace(/_/g, ' ').toUpperCase();
      return {
        id: `inv-${unit.id}`,
        type: 'inventory',
        title,
        subtitle: `SN / IMEI: ${unit.imei_or_serial || 'N/A'} · Status: ${statusLabel}`,
        badge: unit.status,
        icon: Tag,
        onSelect: () => onNavigate({ tab: 'inventory', unit }),
      };
    });

    // 4. Remote Contact items
    const contactItemsList: SearchItem[] = contactResults.map((c) => ({
      id: `con-${c.id}`,
      type: 'contact',
      title: c.name,
      subtitle: `${c.phone || 'No phone'} · ${c.roles?.join(', ') || 'Partner'}`,
      badge: c.roles?.[0] || 'Contact',
      icon: Handshake,
      onSelect: () => onNavigate({ tab: 'partners', partnerId: c.id }),
    }));

    // 5. Remote Sales items
    const salesItemsList: SearchItem[] = salesResults.map((s) => ({
      id: `sale-${s.id}`,
      type: 'sale',
      title: `Order #${s.order_number}`,
      subtitle: `${s.customer?.name || 'Walk-in'} · ${Number(s.total_amount).toLocaleString()} ETB · ${s.order_date ? new Date(s.order_date).toLocaleDateString() : ''}`,
      badge: s.payment_status,
      icon: Receipt,
      onSelect: () => onNavigate({ tab: 'sales', order: s }),
    }));

    return [
      ...inventoryItemsList,
      ...contactItemsList,
      ...salesItemsList,
      ...accountItems,
      ...filteredActions,
      ...filteredNav,
    ];
  }, [
    query,
    navigationItems,
    actionItems,
    accountItems,
    inventoryResults,
    contactResults,
    salesResults,
    onNavigate,
  ]);

  // Clamp selection index
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, combinedItems.length - 1)));
  }, [combinedItems.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < combinedItems.length - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : combinedItems.length - 1));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (combinedItems[selectedIndex]) {
          combinedItems[selectedIndex].onSelect();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, combinedItems, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 md:p-20 flex justify-center items-start pt-14 sm:pt-20">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/70 backdrop-blur-xs transition-opacity animate-backdrop-enter"
      />

      {/* Spotlight Dialog */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter flex flex-col z-10 transition-colors">
        {/* Search Input Bar */}
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Search className="size-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, commands, IMEIs, partners..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-0 outline-none text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          {isSearchingRemote && (
            <Loader2 className="size-4 text-emerald-500 animate-spin shrink-0" />
          )}
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="size-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 flex flex-col gap-1">
          {combinedItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Search className="size-8 text-slate-300 dark:text-slate-700" />
              <span>No results found for "{query}"</span>
              <span className="text-[11px] text-slate-400">Try searching for an IMEI, customer name, bank account, or menu item</span>
            </div>
          ) : (
            combinedItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  data-active={isSelected}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                        item.type === 'inventory'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : item.type === 'contact'
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                          : item.type === 'sale'
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                          : item.type === 'account'
                          ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400'
                          : item.type === 'action'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-200/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <span className="text-[11px] text-slate-400 truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 shadow-2xs">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="size-3.5 text-slate-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Hints */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between text-[11px] text-slate-400">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">↑</kbd>
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">↵</kbd>
              <span>to open drawer / action</span>
            </span>
          </div>
          <span className="text-[10px] font-mono">Spotlight Search</span>
        </div>
      </div>
    </div>
  );
};
