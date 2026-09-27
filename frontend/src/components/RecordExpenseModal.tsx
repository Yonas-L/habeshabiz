import React, { useState, useEffect } from 'react';
import type { Contact, FinancialAccount, InventoryUnit } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  X,
  Receipt,
  Wrench,
  ChevronDown,
  Loader2,
  Handshake,
} from 'lucide-react';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  initialUnitId?: string;
  initialUnit?: InventoryUnit;
  initialCategory?: string;
  onSuccess?: () => void;
}

export const RecordExpenseModal: React.FC<RecordExpenseModalProps> = ({
  isOpen,
  onClose,
  accounts,
  initialUnitId,
  initialUnit,
  initialCategory,
  onSuccess,
}) => {
  const [category, setCategory] = useState(initialCategory || 'ride');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isOwnerDraw, setIsOwnerDraw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Vendor Payout state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedVendorContactId, setSelectedVendorContactId] = useState('');

  // Device Maintenance state
  const [maintenanceUnits, setMaintenanceUnits] = useState<InventoryUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnitId || initialUnit?.id || '');
  const [vendorBilling, setVendorBilling] = useState<'shop' | 'vendor_deduct' | 'vendor_reimburse'>('shop');
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Available cash/bank accounts (excluding gold/custom assets)
  const availableAccounts = accounts.filter((a) => !a.is_custom_asset);

  useEffect(() => {
    if (isOpen) {
      if (initialCategory) {
        setCategory(initialCategory);
        setIsOwnerDraw(initialCategory === 'personal_owner_draw');
      }
      const targetUid = initialUnitId || initialUnit?.id;
      if (targetUid) {
        setSelectedUnitId(targetUid);
      }
      if (initialUnit) {
        setMaintenanceUnits((prev) => {
          if (!prev.some((u) => u.id === initialUnit.id)) {
            return [initialUnit, ...prev];
          }
          return prev;
        });
        const pName = initialUnit.variant?.product?.name || 'Device';
        const imei = initialUnit.imei_or_serial ? ` (IMEI: ${initialUnit.imei_or_serial})` : '';
        setDescription(`Maintenance / repair for ${pName}${imei}`);
      }
      if (availableAccounts.length > 0 && !accountId) {
        setAccountId(availableAccounts[0].id);
      }
    }
  }, [isOpen, initialCategory, initialUnitId, initialUnit, availableAccounts, accountId]);

  // Load contacts for vendor payouts
  useEffect(() => {
    if (isOpen) {
      api.getContacts()
        .then((res) => setContacts(res.filter((c) => c.is_active !== false)))
        .catch(() => {});
    }
  }, [isOpen]);

  // Load returned/damaged devices when category is maintenance
  useEffect(() => {
    if (isOpen && category === 'maintenance') {
      setLoadingUnits(true);
      Promise.all([
        api.getInventoryUnits({ status: 'returned' }),
        api.getInventoryUnits({ status: 'fixed' }),
        api.getInventoryUnits({ status: 'damaged' }),
      ])
        .then(([returnedRes, fixedRes, damagedRes]) => {
          const combined = [
            ...(initialUnit ? [initialUnit] : []),
            ...(returnedRes || []),
            ...(fixedRes || []),
            ...(damagedRes || []),
          ];
          const unique = Array.from(new Map(combined.map((u) => [u.id, u])).values());
          setMaintenanceUnits(unique.filter(u => u.status === 'returned' || u.status === 'fixed' || u.status === 'damaged'));
        })
        .catch(() => {
          setMaintenanceUnits(initialUnit ? [initialUnit] : []);
        })
        .finally(() => {
          setLoadingUnits(false);
        });
    } else if (!isOpen) {
      setSelectedUnitId('');
    }
  }, [isOpen, category, initialUnit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedUnit = maintenanceUnits.find((u) => u.id === selectedUnitId);
  const hasVendor = Boolean(selectedUnit?.supplier_contact_id || selectedUnit?.source_type === 'consignment');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !accountId) return;
    if (category === 'vendor_payout' && !selectedVendorContactId) {
      toast.error('Please select the partner or vendor receiving this wire payout');
      return;
    }

    try {
      setSubmitting(true);
      const isDraw = isOwnerDraw || category === 'personal_owner_draw';
      const finalVendorContactId = category === 'vendor_payout'
        ? selectedVendorContactId
        : category === 'maintenance' && selectedUnit?.supplier_contact_id
        ? selectedUnit.supplier_contact_id
        : selectedVendorContactId || undefined;

      await api.recordExpense({
        financial_account_id: accountId,
        inventory_unit_id: category === 'maintenance' && selectedUnitId ? selectedUnitId : undefined,
        category,
        amount: parseFloat(amount),
        is_owner_draw: isDraw,
        vendor_billing: category === 'maintenance' && selectedUnitId && hasVendor ? vendorBilling : 'shop',
        vendor_contact_id: finalVendorContactId || undefined,
        description,
      });

      toast.success(
        isDraw
          ? 'Owner Personal Draw Recorded'
          : category === 'vendor_payout'
          ? 'Vendor Wire Payout Recorded (Debts Auto-Settled)'
          : vendorBilling === 'vendor_deduct' && hasVendor
          ? 'Vendor-Deductible Repair Logged (Offset on Debt)'
          : vendorBilling === 'vendor_reimburse' && hasVendor
          ? 'Vendor Reimbursement Claim Created (Receivable)'
          : 'Operating Expense Recorded',
        {
          description: `${parseFloat(amount).toLocaleString()} ETB • ${description}`,
        }
      );

      setAmount('');
      setDescription('');
      setSelectedUnitId('');
      setSelectedVendorContactId('');
      setIsOwnerDraw(false);
      setCategory('ride');
      setVendorBilling('shop');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      toast.error('Failed to record expense', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      <div className="relative z-10 bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl ring-1 ring-black/5 max-w-lg w-full p-6 space-y-4 animate-modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-none">
                Record Expense / Outflow
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Wire payouts to vendors, operating overhead &amp; owner draws
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Expense Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                const cat = e.target.value;
                setCategory(cat);
                setIsOwnerDraw(cat === 'personal_owner_draw');
                if (cat === 'vendor_payout' && !description) {
                  setDescription('Wire transfer payout to vendor');
                }
              }}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600 cursor-pointer"
            >
              <option value="vendor_payout">Vendor Settlement / Wire Transfer Payout</option>
              <option value="ride">RIDE / Transportation & Delivery</option>
              <option value="food">Food & Hospitality</option>
              <option value="rent">Shop Rent & Utilities</option>
              <option value="maintenance">Device Maintenance & Tooling</option>
              <option value="salary">Staff Daily Pay / Commission</option>
              <option value="personal_owner_draw">Personal Owner Draw (Yoni)</option>
              <option value="other">Other Operational Expense</option>
            </select>
          </div>

          {/* Vendor Payout Selection (Visible when category is vendor_payout) */}
          {category === 'vendor_payout' && (
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50 space-y-2 animate-page-enter">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Handshake className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Select Partner / Peer Vendor *</span>
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Auto-settles debt</span>
              </label>

              <select
                value={selectedVendorContactId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setSelectedVendorContactId(cid);
                  const c = contacts.find((item) => item.id === cid);
                  if (c) {
                    setDescription(`Wire payout to ${c.name}`);
                  }
                }}
                required
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 cursor-pointer"
              >
                <option value="">-- Choose Vendor / Partner --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} {c.roles?.includes('peer_vendor') ? '• Broker' : ''}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                This wire payout directly decreases what you owe this partner on their ledger statement. If it exceeds your open payables, the remainder is logged as an advance credit.
              </p>
            </div>
          )}

          {/* Maintenance Device Dropdown (Visible when category is maintenance) */}
          {category === 'maintenance' && (
            <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 space-y-2 animate-page-enter">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Device Returned for Maintenance / Repair</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Optional</span>
              </div>

              <div className="relative">
                <select
                  value={selectedUnitId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setSelectedUnitId(uid);
                    const unit = maintenanceUnits.find((u) => u.id === uid);
                    if (unit) {
                      const pName = unit.variant?.product?.name || 'Device';
                      const imei = unit.imei_or_serial ? ` (IMEI: ${unit.imei_or_serial})` : '';
                      if (!description || description.startsWith('Maintenance / repair for ')) {
                        setDescription(`Maintenance / repair for ${pName}${imei}`);
                      }
                    }
                  }}
                  disabled={loadingUnits}
                  className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 appearance-none cursor-pointer"
                >
                  <option value="">-- General Maintenance / Tooling (No Specific Device) --</option>
                  {maintenanceUnits.map((u) => {
                    const pName = u.variant?.product?.name || 'Device';
                    const spec = [u.variant?.storage, u.variant?.color].filter(Boolean).join(' ');
                    const imei = u.imei_or_serial ? ` • IMEI: ${u.imei_or_serial}` : ' • Bulk';
                    const statusTag = u.status === 'fixed' ? ' [Fixed - Ready to Restock]' : ' [Needs Repair]';
                    const reason = u.return_reason ? ` (${u.return_reason.slice(0, 25)})` : '';
                    return (
                      <option key={u.id} value={u.id}>
                        {pName} {spec}{imei}{statusTag}{reason}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>

              {loadingUnits ? (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                  <span>Loading returned/repair devices...</span>
                </div>
              ) : maintenanceUnits.length === 0 ? (
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  No devices currently on the return/repair shelf. If this is shop tooling, consumables, or general shop repair, leave as General.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Selecting a returned unit automatically logs a maintenance lifecycle record and links repair costs to that device.
                </p>
              )}

              {selectedUnit && hasVendor && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>Repair Settlement</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {vendorBilling === 'shop'
                        ? 'Shop absorbs repair (adds to unit cost basis)'
                        : vendorBilling === 'vendor_deduct'
                        ? 'Deduct from vendor debt (offset payout)'
                        : 'Vendor will reimburse (creates receivable)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setVendorBilling('shop')}
                      className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                        vendorBilling === 'shop'
                          ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Shop
                    </button>
                    <button
                      type="button"
                      onClick={() => setVendorBilling('vendor_deduct')}
                      className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                        vendorBilling === 'vendor_deduct'
                          ? 'bg-white dark:bg-[#131926] text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Offsets vendor's open payable debt so when remainder is paid, debt is 100% settled"
                    >
                      Deduct Debt
                    </button>
                    <button
                      type="button"
                      onClick={() => setVendorBilling('vendor_reimburse')}
                      className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center ${
                        vendorBilling === 'vendor_reimburse'
                          ? 'bg-white dark:bg-[#131926] text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Vendor will wire/send money later; creates a receivable that you mark collected"
                    >
                      Reimburse
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {vendorBilling === 'shop' && 'You pay the repair. It increases this phone\'s capitalized cost basis.'}
                    {vendorBilling === 'vendor_deduct' && 'You pay the repair and deduct it from the vendor\'s payout (e.g. pay 80,000 instead of 100,000). The payable balance is offset and settled.'}
                    {vendorBilling === 'vendor_reimburse' && 'You pay the repair now. A receivable is logged under this vendor, and you collect it when they send you the funds.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Amount (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 350"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Paid From Account
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600 cursor-pointer"
                required
              >
                {availableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Description / Note
            </label>
            <input
              type="text"
              placeholder="e.g. Screen replacement, customer delivery ride..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
              required
            />
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <input
              type="checkbox"
              id="recordExpenseIsOwnerDraw"
              checked={isOwnerDraw}
              onChange={(e) => setIsOwnerDraw(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
            />
            <label
              htmlFor="recordExpenseIsOwnerDraw"
              className="text-xs text-slate-700 dark:text-slate-300 font-medium select-none cursor-pointer"
            >
              Mark as Owner Personal Draw (Does not reduce shop profit)
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Record Outflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
