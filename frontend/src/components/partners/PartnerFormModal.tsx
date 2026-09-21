import React, { useState, useEffect } from 'react';
import type { Contact } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { X, Handshake, Phone, Mail, Building2, FileText, Check, Loader2 } from 'lucide-react';

interface PartnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactToEdit?: Contact | null;
  defaultRole?: 'peer_vendor' | 'supplier' | 'partner' | 'customer';
  onSuccess: (savedContact: Contact) => void;
}

const AVAILABLE_ROLES = [
  {
    id: 'peer_vendor',
    label: 'Sourcing Broker (Peer Shop)',
    description: 'Neighbour shop merchant used for brokered phone sourcing in POS sales.',
    badgeColor: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
  },
  {
    id: 'supplier',
    label: 'Supplier / Importer',
    description: 'Wholesale importer or source for batch inventory intake.',
    badgeColor: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
  },
  {
    id: 'partner',
    label: 'Strategic Business Partner',
    description: 'Commercial associate, showroom collaborator, or co-financer.',
    badgeColor: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
  },
  {
    id: 'customer',
    label: 'Wholesale / Retail Customer',
    description: 'Direct buyer or corporate client.',
    badgeColor: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
  },
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
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xl overflow-hidden animate-modal-enter z-10">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-xs">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {contactToEdit ? 'Edit Partner / Broker' : 'Add Partner / Broker'}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                {contactToEdit
                  ? 'Update contact details, roles, or shop address'
                  : 'Register a neighbouring shop, broker, or wholesale supplier'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(85vh-8rem)] overflow-y-auto">
          {/* Name Field */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Partner / Shop Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mekdi (Bole Medhanialem) or Smith Electronics"
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          </div>

          {/* Phone Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Primary Phone <span className="text-slate-400 font-normal">(Calls / TeleBirr)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251 9... or 09..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Alternate Phone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value)}
                  placeholder="Secondary phone (optional)"
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
            </div>
          </div>

          {/* Email (Optional) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Email Address <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@example.com"
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          </div>

          {/* Roles Selection */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Partner Classification &amp; Roles <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              {AVAILABLE_ROLES.map((r) => {
                const isSelected = roles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800/40 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#131926]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                          : 'border-slate-300 dark:border-slate-700 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {r.label}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${r.badgeColor}`}>
                          {r.id === 'peer_vendor' ? 'Brokered' : r.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                        {r.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes / Shop Location */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Shop Location, Specialties &amp; Terms
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Shop #104 Morning Star Mall; specializes in iPhone 16 Pro Max; accepts 24h trade settlement..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          </div>

          {/* Active Toggle (Only on edit) */}
          {contactToEdit && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Active Status
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Inactive partners are hidden from sales and stock dropdowns
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Partner...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{contactToEdit ? 'Save Changes' : 'Add to Network'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
