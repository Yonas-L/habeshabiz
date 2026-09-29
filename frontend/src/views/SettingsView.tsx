import React, { useState, useEffect, useRef } from 'react';
import type { User, Tenant, SettingsProfileResponse } from '../api/client';
import { api, resolveImageUrl } from '../api/client';
import {
  Building2,
  Phone,
  MapPin,
  FileText,
  Upload,
  Image as ImageIcon,
  KeyRound,
  User as UserIcon,
  Mail,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsViewProps {
  user: User | null;
  tenant: Tenant | null;
  onProfileUpdated: (updatedTenant: Tenant, updatedUser: User) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  tenant,
  onProfileUpdated,
}) => {
  const [loading, setLoading] = useState(true);

  // Business Profile Form State
  const [businessName, setBusinessName] = useState(tenant?.name || '');
  const [businessPhone, setBusinessPhone] = useState(tenant?.phone || '');
  const [city, setCity] = useState(tenant?.settings?.city || 'Addis Ababa');
  const [address, setAddress] = useState(tenant?.settings?.address || '');
  const [tinNumber, setTinNumber] = useState(tenant?.settings?.tin_number || '');
  const [footerNote, setFooterNote] = useState(
    tenant?.settings?.footer_note ||
      'Thank you for your business. Defect coverage valid for 7 days with intact warranty and receipt.'
  );
  const [currencyCode, setCurrencyCode] = useState(tenant?.currency || 'ETB');
  const [secondaryCurrencies, setSecondaryCurrencies] = useState<string[]>(
    tenant?.settings?.secondary_currencies || ['USD']
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant?.settings?.logo_url || null);

  // Owner Account Form State
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [ownerPhone, setOwnerPhone] = useState(user?.phone || '');

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Loading States
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load latest settings from backend
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res: SettingsProfileResponse = await api.getSettingsProfile();
        if (res.tenant) {
          setBusinessName(res.tenant.name || '');
          setBusinessPhone(res.tenant.phone || '');
          setCity(res.tenant.city || 'Addis Ababa');
          setAddress(res.tenant.address || '');
          setTinNumber(res.tenant.tin_number || '');
          setFooterNote(res.tenant.footer_note || '');
          setCurrencyCode(res.tenant.currency_code || 'ETB');
          setSecondaryCurrencies(res.tenant.secondary_currencies || ['USD']);
          setLogoUrl(res.tenant.logo_url || null);

          if (tenant && user) {
            const updatedTenant: Tenant = {
              ...tenant,
              name: res.tenant.name,
              phone: res.tenant.phone,
              currency: res.tenant.currency_code,
              settings: {
                ...tenant.settings,
                city: res.tenant.city,
                address: res.tenant.address,
                tin_number: res.tenant.tin_number,
                footer_note: res.tenant.footer_note,
                secondary_currencies: res.tenant.secondary_currencies,
                logo_url: res.tenant.logo_url,
              },
            };
            onProfileUpdated(updatedTenant, user);
          }
        }
        if (res.user) {
          setOwnerName(res.user.name || '');
          setOwnerPhone(res.user.phone || '');
        }
      } catch (err: any) {
        console.error('Failed to load settings profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error('Business name cannot be empty');
      return;
    }

    try {
      setIsSavingProfile(true);
      const res = await api.updateSettingsProfile({
        name: businessName.trim(),
        phone: businessPhone.trim(),
        currency_code: currencyCode,
        city: city.trim(),
        address: address.trim(),
        tin_number: tinNumber.trim(),
        footer_note: footerNote.trim(),
        secondary_currencies: secondaryCurrencies,
        owner_name: ownerName.trim(),
        owner_phone: ownerPhone.trim(),
      });

      toast.success('Business profile updated successfully');

      // Update state in App
      if (user && tenant) {
        const updatedTenant: Tenant = {
          ...tenant,
          name: res.tenant.name,
          phone: res.tenant.phone,
          currency: res.tenant.currency_code,
          settings: {
            ...tenant.settings,
            city: res.tenant.city,
            address: res.tenant.address,
            tin_number: res.tenant.tin_number,
            footer_note: res.tenant.footer_note,
            secondary_currencies: res.tenant.secondary_currencies,
            logo_url: res.tenant.logo_url,
          },
        };

        const updatedUser: User = {
          ...user,
          name: res.user.name,
          phone: res.user.phone,
        };

        onProfileUpdated(updatedTenant, updatedUser);
      }
    } catch (err: any) {
      toast.error('Failed to update profile', { description: err.message });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2MB');
      return;
    }

    try {
      setIsUploadingLogo(true);
      const res = await api.uploadBusinessLogo(file);
      setLogoUrl(res.logo_url);
      toast.success('Business logo uploaded');

      if (tenant && user) {
        const updatedTenant: Tenant = {
          ...tenant,
          settings: {
            ...tenant.settings,
            logo_url: res.logo_url,
          },
        };
        onProfileUpdated(updatedTenant, user);
      }
    } catch (err: any) {
      toast.error('Failed to upload logo', { description: err.message });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }

    try {
      setIsChangingPassword(true);
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Failed to update password', { description: err.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const toggleSecondaryCurrency = (curr: string) => {
    setSecondaryCurrencies((prev) =>
      prev.includes(curr) ? prev.filter((c) => c !== curr) : [...prev, curr]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-xs text-slate-400">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your business profile, receipt headers, brand logo, and owner login security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Business Profile (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          <form
            onSubmit={handleSaveProfile}
            className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                    Business Profile
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Appears across sales receipts, invoices, and system header
                  </p>
                </div>
              </div>
            </div>

            {/* Logo Upload Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                  {logoUrl ? (
                    <img
                      src={resolveImageUrl(logoUrl) || logoUrl}
                      alt="Business Logo"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Business Logo
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    PNG, JPG, or SVG up to 2MB. Displayed in invoices.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />

              <button
                type="button"
                disabled={isUploadingLogo}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 w-full sm:w-auto shrink-0"
              >
                {isUploadingLogo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Upload Logo</span>
              </button>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Business Phone
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  City
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bole Medhanialem, Mall 2nd Floor"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  TIN Number (Ethiopian Tax ID)
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="10-digit TIN (optional)"
                    value={tinNumber}
                    onChange={(e) => setTinNumber(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Base Currency
                </label>
                <select
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="ETB">ETB — Ethiopian Birr</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Secondary Display Currencies
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['USD', 'EUR', 'AED', 'GBP'].map((curr) => {
                    const isSelected = secondaryCurrencies.includes(curr);
                    return (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => toggleSecondaryCurrency(curr)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 dark:bg-emerald-500 text-white border-transparent'
                            : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {curr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Receipt Footer Note */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Receipt & Invoice Footer Note
                </label>
                <textarea
                  rows={2}
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  placeholder="Warranty terms, return conditions, or thank you note printed at the bottom of customer receipts."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 w-full sm:w-auto"
              >
                {isSavingProfile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Business Profile</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Owner Account & Password (1 Col on lg) */}
        <div className="space-y-6">
          {/* Owner Account Card */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                  Owner Account
                </h2>
                <p className="text-[11px] text-slate-400">
                  Primary administrator credentials
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Owner Full Name
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Owner Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    readOnly
                    value={user?.email || ''}
                    title="Sign in email cannot be changed directly"
                    className="w-full h-9 pl-9 pr-3 text-xs bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Direct Contact Phone
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <form
            onSubmit={handleChangePassword}
            className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                  Change Password
                </h2>
                <p className="text-[11px] text-slate-400">
                  Update your personal login security
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  New Password (min 6)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full h-9 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isChangingPassword ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5" />
                )}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
