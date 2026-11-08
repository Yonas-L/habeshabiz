import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { X, Check, Loader2 } from 'lucide-react';

export interface EditStaffData {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  permissions?: {
    can_discount?: boolean;
    can_handover?: boolean;
    can_intake_stock?: boolean;
    can_view_costs?: boolean;
    can_manage_inventory?: boolean;
  };
}

interface EditStaffBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  staff: EditStaffData | null;
  onSuccess: (updatedStaff: any) => void;
}

export const EditStaffBottomSheet: React.FC<EditStaffBottomSheetProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess,
}) => {
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCanDiscount, setEditCanDiscount] = useState(false);
  const [editCanHandover, setEditCanHandover] = useState(false);
  const [editCanIntakeStock, setEditCanIntakeStock] = useState(false);
  const [editCanViewCosts, setEditCanViewCosts] = useState(false);
  const [editCanManageInventory, setEditCanManageInventory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (staff) {
      setEditName(staff.name || '');
      setEditEmail(staff.email || '');
      setEditPhone(staff.phone || '');
      setEditCanDiscount(!!staff.permissions?.can_discount);
      setEditCanHandover(!!staff.permissions?.can_handover);
      setEditCanIntakeStock(!!staff.permissions?.can_intake_stock);
      setEditCanViewCosts(!!staff.permissions?.can_view_costs);
      setEditCanManageInventory(!!staff.permissions?.can_manage_inventory);
    }
  }, [staff, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !staff || typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      toast.error('Please provide worker full name and email address');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.updateStaff(staff.id, {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim() || undefined,
        can_discount: editCanDiscount,
        can_handover: editCanHandover,
        can_intake_stock: editCanIntakeStock,
        can_view_costs: editCanViewCosts,
        can_manage_inventory: editCanManageInventory,
      });

      toast.success(`${editName.trim()} updated successfully!`);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      const msg =
        err.errors?.email?.[0] ||
        err.errors?.phone?.[0] ||
        err.message ||
        'Failed to update staff member';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Bottom Sheet Surface */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden max-sm:animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[90vh] sm:max-h-[85vh] my-0 sm:my-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Pinned Header */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131926] shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Edit Staff & Privileges
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Modify profile details and toggle granular operational permissions.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Worker Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Kidus Tesfaye"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address *{' '}
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                  (used for staff login & unique ID)
                </span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. kidus@boletech.et"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number{' '}
                <span className="text-[11px] text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                placeholder="0911234567"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono transition-all"
              />
            </div>

            {/* Granular Permissions Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white">
                  Staff Privileges & Permissions
                </label>
                <span className="text-[10px] text-slate-400">Configure access level</span>
              </div>

              <div className="space-y-1 bg-slate-50 dark:bg-[#0c1017] p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                {/* Privilege 1: Discount */}
                <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={editCanDiscount}
                    onChange={(e) => setEditCanDiscount(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Allow Counter Discounts
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Can apply custom price discounts during POS checkout.
                    </div>
                  </div>
                </label>

                {/* Privilege 2: Handover */}
                <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <input
                    type="checkbox"
                    checked={editCanHandover}
                    onChange={(e) => setEditCanHandover(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Allow Device Handover & Flow
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Can hand out units to brokers/staff, confirm handover sales, or restock to shelf.
                    </div>
                  </div>
                </label>

                {/* Privilege 3: Intake Stock */}
                <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <input
                    type="checkbox"
                    checked={editCanIntakeStock}
                    onChange={(e) => setEditCanIntakeStock(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Allow Stock Intake
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Can add new inventory units, record supplier shipments, and add catalog models.
                    </div>
                  </div>
                </label>

                {/* Privilege 4: View Costs */}
                <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <input
                    type="checkbox"
                    checked={editCanViewCosts}
                    onChange={(e) => setEditCanViewCosts(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Allow View Cost Basis & Margins
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Can view purchase prices, cost basis, and margin percentages on devices.
                    </div>
                  </div>
                </label>

                {/* Privilege 5: Manage Inventory */}
                <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <input
                    type="checkbox"
                    checked={editCanManageInventory}
                    onChange={(e) => setEditCanManageInventory(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Allow Inventory Management & Swaps
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Can edit unit IMEI/serials, process customer warranty returns, and handle vendor swaps.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Pinned Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 shrink-0 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
