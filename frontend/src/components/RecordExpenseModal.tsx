import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Contact, FinancialAccount, InventoryUnit, StaffMember } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  X,
  Receipt,
  Wrench,
  ChevronDown,
  Loader2,
  Handshake,
  Users,
} from 'lucide-react';
import { SplitPaymentSelector, type PaymentSplitItem } from './common/SplitPaymentSelector';

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
  const [isSplit, setIsSplit] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitItem[]>([]);
  const [isOwnerDraw, setIsOwnerDraw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Vendor Payout state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedVendorContactId, setSelectedVendorContactId] = useState('');

  // Staff Daily Pay / Commission state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [staffPayoutMode, setStaffPayoutMode] = useState<'bonus' | 'allowance'>('bonus');
  const [loadingStaff, setLoadingStaff] = useState(false);

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

  // Load staff members for staff daily pay / commission
  useEffect(() => {
    if (isOpen) {
      setLoadingStaff(true);
      api.getStaff()
        .then((res) => setStaffMembers(res.filter((s) => s.is_active !== false)))
        .catch(() => {})
        .finally(() => setLoadingStaff(false));
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
  const selectedStaff = staffMembers.find((s) => String(s.id) === String(selectedStaffId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid expense amount');
      return;
    }

    if (isSplit) {
      const totalAllocated = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      if (Math.abs(totalAllocated - numAmount) > 0.01) {
        toast.error(`Split amounts (${totalAllocated.toLocaleString()} ETB) must equal total expense (${numAmount.toLocaleString()} ETB)`);
        return;
      }
      if (paymentSplits.length === 0 || paymentSplits.some((s) => !s.financial_account_id || s.amount <= 0)) {
        toast.error('All split accounts must have a valid account and amount greater than 0');
        return;
      }
    } else {
      if (!accountId) {
        toast.error('Please select an account');
        return;
      }
    }

    if (category === 'vendor_payout' && !selectedVendorContactId) {
      toast.error('Please select the partner or vendor receiving this transfer');
      return;
    }

    try {
      setSubmitting(true);

      // Handle staff sales bonus payout (settles liability without double-deducting profit)
      if (category === 'salary' && staffPayoutMode === 'bonus' && selectedStaff) {
        await api.settleStaffBonus(Number(selectedStaff.id), {
          amount: numAmount,
          financial_account_id: isSplit ? undefined : accountId,
          payment_splits: isSplit ? paymentSplits : undefined,
          notes: description,
        });

        toast.success(`Sales Commission Disbursed to ${selectedStaff.name}`, {
          description: `${numAmount.toLocaleString()} ETB • Commission liability cleared (profit neutral)`,
        });

        setAmount('');
        setDescription('');
        setSelectedUnitId('');
        setSelectedVendorContactId('');
        setSelectedStaffId('');
        setIsOwnerDraw(false);
        setIsSplit(false);
        setPaymentSplits([]);
        setCategory('ride');
        setStaffPayoutMode('allowance');
        onClose();
        if (onSuccess) onSuccess();
        return;
      }

      const isDraw = isOwnerDraw || category === 'personal_owner_draw';
      const staffContact = selectedStaff
        ? contacts.find(
            (c) =>
              (selectedStaff.contact_id && c.id === selectedStaff.contact_id) ||
              (selectedStaff.phone && c.phone === selectedStaff.phone) ||
              c.name.toLowerCase() === selectedStaff.name.toLowerCase()
          )
        : null;

      const finalVendorContactId = category === 'vendor_payout'
        ? selectedVendorContactId
        : category === 'maintenance' && selectedUnit?.supplier_contact_id
        ? selectedUnit.supplier_contact_id
        : category === 'salary' && staffContact
        ? staffContact.id
        : selectedVendorContactId || undefined;

      await api.recordExpense({
        financial_account_id: isSplit ? undefined : accountId,
        payment_splits: isSplit ? paymentSplits : undefined,
        inventory_unit_id: category === 'maintenance' && selectedUnitId ? selectedUnitId : undefined,
        category,
        amount: numAmount,
        is_owner_draw: isDraw,
        vendor_billing: category === 'maintenance' && selectedUnitId && hasVendor ? vendorBilling : 'shop',
        vendor_contact_id: finalVendorContactId || undefined,
        description,
      });

      toast.success(
        isDraw
          ? 'Owner Personal Draw Recorded'
          : category === 'vendor_payout'
          ? 'Vendor Transfer Recorded (Debts Auto-Settled)'
          : category === 'salary' && selectedStaff
          ? `Staff Pay Recorded for ${selectedStaff.name}`
          : vendorBilling === 'vendor_deduct' && hasVendor
          ? 'Vendor-Deductible Repair Logged (Offset on Debt)'
          : vendorBilling === 'vendor_reimburse' && hasVendor
          ? 'Vendor Reimbursement Claim Created (Receivable)'
          : 'Operating Expense Recorded',
        {
          description: `${numAmount.toLocaleString()} ETB • ${description}`,
        }
      );

      setAmount('');
      setDescription('');
      setSelectedUnitId('');
      setSelectedVendorContactId('');
      setSelectedStaffId('');
      setIsOwnerDraw(false);
      setIsSplit(false);
      setPaymentSplits([]);
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

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      <div className="relative z-10 bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-100 dark:border-slate-800 shadow-2xl ring-1 ring-black/5 max-w-lg w-full max-h-[88vh] sm:max-h-[85vh] flex flex-col p-5 sm:p-6 space-y-4 animate-bottom-sheet sm:animate-modal-enter my-0 sm:my-auto">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-none">
                Record Expense / Outflow
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Transfers to vendors, operating overhead &amp; owner draws
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

        <form id="record-expense-form" onSubmit={handleSubmit} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
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
                  setDescription('Transfer to vendor');
                } else if (cat === 'salary' && !description) {
                  setDescription('Staff daily pay / commission');
                }
              }}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600 cursor-pointer"
            >
              <option value="vendor_payout">Vendor Settlement / Transfer</option>
              <option value="ride">RIDE / Transportation & Delivery</option>
              <option value="food">Food & Hospitality</option>
              <option value="rent">Shop Rent & Utilities</option>
              <option value="maintenance">Device Maintenance & Tooling</option>
              <option value="salary">Staff Daily Pay / Commission</option>
              <option value="personal_owner_draw">Personal Owner Draw</option>
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
                    setDescription(`Transferred to ${c.name}`);
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
                This transfer directly decreases what you owe this partner on their ledger statement. If it exceeds your open payables, the remainder is logged as an advance credit.
              </p>
            </div>
          )}

          {/* Staff Member Selection (Visible when category is salary) */}
          {category === 'salary' && (
            <div className="p-3.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/20 border border-violet-200/70 dark:border-violet-900/50 space-y-2.5 animate-page-enter">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>Select Staff Member</span>
                </label>
                <span
                  className={`text-[10px] font-bold ${
                    selectedStaff && staffPayoutMode === 'bonus'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-violet-600 dark:text-violet-400'
                  }`}
                >
                  {selectedStaff && staffPayoutMode === 'bonus'
                    ? 'Settles Commission Debt (Profit Neutral)'
                    : 'Operating Expense (P&L Overhead)'}
                </span>
              </div>

              <div className="relative">
                <select
                  value={selectedStaffId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setSelectedStaffId(sid);
                    const staff = staffMembers.find((item) => String(item.id) === String(sid));
                    if (staff) {
                      const uncollected = staff.stats?.uncollected_bonus || 0;
                      if (uncollected > 0) {
                        setStaffPayoutMode('bonus');
                        setAmount(String(uncollected));
                        setDescription(`Sales commission payout: ${staff.name}`);
                      } else {
                        setStaffPayoutMode('allowance');
                        setDescription(`Staff daily pay / allowance: ${staff.name}`);
                      }
                    }
                  }}
                  disabled={loadingStaff}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
                >
                  <option value="">-- Choose Staff Member (Optional) --</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''} • {s.role.toUpperCase()}
                    </option>
                  ))}
                </select>
                {loadingStaff && (
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500 absolute right-3 top-3 pointer-events-none" />
                )}
              </div>

              {/* If staff has uncollected bonuses, allow choosing between paying bonus vs daily allowance */}
              {selectedStaff && (selectedStaff.stats?.uncollected_bonus || 0) > 0 ? (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>Disbursement Purpose</span>
                    <span className="text-[10px] text-slate-400 font-normal">Choose allocation type</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setStaffPayoutMode('bonus');
                        setAmount(String(selectedStaff.stats?.uncollected_bonus || ''));
                        setDescription(`Sales commission payout: ${selectedStaff.name}`);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                        staffPayoutMode === 'bonus'
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Pay Sales Commission</span>
                      <span className="block text-[9px] opacity-80">
                        {Number(selectedStaff.stats?.uncollected_bonus || 0).toLocaleString()} ETB · Clears Debt
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStaffPayoutMode('allowance');
                        setDescription(`Staff daily pay / allowance: ${selectedStaff.name}`);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                        staffPayoutMode === 'allowance'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Daily Pay / Allowance</span>
                      <span className="block text-[9px] opacity-80">P&amp;L Operating Expense</span>
                    </button>
                  </div>

                  {staffPayoutMode === 'bonus' ? (
                    <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 leading-relaxed bg-emerald-50/70 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                      ✓ <strong>Clears Earned Bonus Debt:</strong> Disburses {selectedStaff.name}&apos;s earned sales commission and settles their open bonus payable. Profit was already accounted for on the sale, so your P&amp;L is not double-deducted.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <strong>Operating Overhead:</strong> Discretionary daily allowances, lunch, transport, or fixed stipends recorded here count directly as operating expenses on your monthly Income Statement (P&amp;L).
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Daily allowances, stipends, and fixed daily pay recorded here count directly as operating expenses on your monthly Income Statement (P&amp;L).
                </p>
              )}
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

          <SplitPaymentSelector
            accounts={availableAccounts}
            targetAmount={parseFloat(amount) || 0}
            singleAccountId={accountId}
            onSingleAccountChange={setAccountId}
            isSplit={isSplit}
            onIsSplitChange={setIsSplit}
            splits={paymentSplits}
            onSplitsChange={setPaymentSplits}
            direction="outflow"
            label="Paid From Account"
          />

          {!isSplit && (() => {
            const selectedAcc = availableAccounts.find((a) => a.id === accountId);
            const amtNum = parseFloat(amount) || 0;
            if (!selectedAcc || !selectedAcc.default_fee_type || selectedAcc.default_fee_type === 'none' || amtNum <= 0) return null;
            const rate = Number(selectedAcc.default_fee_amount) || 0;
            if (rate <= 0) return null;
            const fee = selectedAcc.default_fee_type === 'fixed' ? rate : Math.round(((amtNum * rate) / 100) * 100) / 100;
            return (
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300">
                <span className="flex items-center gap-1">
                  <span className="font-bold">Outgoing Fee ({rate}{selectedAcc.default_fee_type === 'percentage' ? '%' : ' ETB'}):</span>
                  <span>+{fee.toLocaleString()} ETB</span>
                </span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Total deducted: <span className="font-bold font-mono text-slate-900 dark:text-white">{(amtNum + fee).toLocaleString()} ETB</span>
                </span>
              </div>
            );
          })()}

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
        </form>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="record-expense-form"
            disabled={submitting}
            className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
          >
            {submitting ? 'Recording...' : 'Record Outflow'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
