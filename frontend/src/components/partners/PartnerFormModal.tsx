import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Contact } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { X, Handshake, Check } from 'lucide-react';
import { LdrsSpinner } from '../loading/LdrsSpinner';

interface PartnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactToEdit?: Contact | null;
  defaultRole?: 'peer_vendor' | 'supplier' | 'partner' | 'customer';
  onSuccess: (savedContact: Contact) => void;
}

const ROLES = [
  { id: 'peer_vendor', label: 'Broker' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'partner', label: 'Strategic Partner' },
  { id: 'customer', label: 'Customer' },
];

export const PartnerFormModal: React.FC<PartnerFormModalProps> = ({
  isOpen,
  onClose,
  contactToEdit,
  defaultRole = 'peer_vendor',
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([defaultRole]);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (contactToEdit) {
      setName(contactToEdit.name || '');
      setPhone(contactToEdit.phone || '');
      setAltPhone(contactToEdit.alt_phone || '');
      setEmail(contactToEdit.email || '');
      setRoles(contactToEdit.roles?.length ? contactToEdit.roles : [defaultRole]);
      setNotes(contactToEdit.notes || '');
      setIsActive(contactToEdit.is_active ?? true);
    } else {
      setName('');
      setPhone('');
      setAltPhone('');
      setEmail('');
      setRoles([defaultRole]);
      setNotes('');
      setIsActive(true);
    }
  }, [contactToEdit, isOpen, defaultRole]);

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

  const toggleRole = (roleId: string) => {
    setRoles((prev) => {
      if (prev.includes(roleId)) {
        if (prev.length === 1) {
          toast.error('Partner must have at least one assigned role');
          return prev;
        }
        return prev.filter((r) => r !== roleId);
      }
      return [...prev, roleId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Partner or shop name is required');
      return;
    }
    if (roles.length === 0) {
      toast.error('Select at least one role for this contact');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        alt_phone: altPhone.trim() || null,
        email: email.trim() || null,
        roles,
        notes: notes.trim() || null,
        is_active: isActive,
      };

      let result: Contact;
      if (contactToEdit) {
        result = await api.updateContact(contactToEdit.id, payload);
        toast.success(`Partner "${result.name}" updated successfully`);
      } else {
        result = await api.createContact(payload);
        toast.success(`Partner "${result.name}" added to network`);
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      toast.error(contactToEdit ? 'Failed to update partner' : 'Failed to create partner', {
        description: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet Surface */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-100 dark:border-slate-800 overflow-hidden max-sm:animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[88vh] sm:max-h-[90vh] my-0 sm:my-auto">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <Handshake className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                {contactToEdit ? 'Edit Partner' : 'Add Partner'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                {contactToEdit
                  ? 'Update contact details and business roles'
                  : 'Register a supplier, peer vendor, or client'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="partner-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-4"
        >
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Partner Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mekdi Electronics, Smith Imports"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
              autoFocus
            />
          </div>

          {/* Phone Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Primary Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 9... or 09..."
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Alternate Phone
              </label>
              <input
                type="text"
                value={altPhone}
                onChange={(e) => setAltPhone(e.target.value)}
                placeholder="Secondary phone"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
            />
          </div>

          {/* Roles */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Roles & Classification <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const isSelected = roles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-800 dark:border-slate-800 bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/20 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span>{r.label}</span>
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'border border-slate-300 dark:border-slate-600 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Location & Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Shop #104 Morning Star Mall, Bole..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600 resize-none"
            />
          </div>

          {/* Active Toggle — edit mode only */}
          {contactToEdit && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Active Status
                </span>
                <span className="text-[11px] text-slate-400">
                  Inactive partners are hidden from sales and stock dropdowns
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  isActive ? 'bg-slate-900 dark:bg-slate-900 border border-slate-800 ring-1 ring-emerald-500/20' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    isActive ? 'bg-emerald-400 translate-x-4 shadow-xs' : 'bg-white dark:bg-slate-300 translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131926] shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="partner-form"
            disabled={submitting}
            className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
          >
            {submitting ? (
              <>
                <LdrsSpinner size={15} color="#34d399" stroke={2.5} />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{contactToEdit ? 'Save Changes' : 'Add Partner'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
