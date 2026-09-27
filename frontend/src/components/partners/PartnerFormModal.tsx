import React, { useState, useEffect } from 'react';
import type { Contact } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { X, Handshake, Check, Loader2 } from 'lucide-react';

interface PartnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactToEdit?: Contact | null;
  defaultRole?: 'peer_vendor' | 'supplier' | 'partner' | 'customer';
  onSuccess: (savedContact: Contact) => void;
}

const ROLES = [
  { id: 'peer_vendor', label: 'Peer Shop / Broker' },
  { id: 'supplier', label: 'Supplier / Importer' },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal Surface */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-modal-enter flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Handshake className="w-4 h-4" />
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
              Partner / Shop Name <span className="text-rose-500">*</span>
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
                placeholder="Optional secondary phone"
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
              placeholder="partner@example.com (optional)"
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
                        ? 'border-slate-900 dark:border-slate-200 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span>{r.label}</span>
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900'
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
                  isActive ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    isActive ? 'bg-white dark:bg-slate-900 translate-x-4' : 'bg-white dark:bg-slate-300 translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 p-5 border-t border-slate-100 dark:border-slate-800">
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
            className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
};
