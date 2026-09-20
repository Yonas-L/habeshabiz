import React, { useState } from 'react';
import type { User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  X,
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  Phone,
  Mail,
  Check,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUserUpdated: (updated: User) => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  if (!isOpen || !user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    try {
      setIsUpdatingProfile(true);
      const res = await api.updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      onUserUpdated(res);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
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
    if (newPassword !== newPasswordConfirmation) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirmation,
      });
      toast.success(res.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirmation('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-sm">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Account Settings
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {user.role === 'owner' ? 'Workspace Owner' : 'Sales Staff'} • {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'profile'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'security'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Security & Password</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Abebe Bikila"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0911234567"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email / Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/60 text-xs font-medium text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Assigned by workspace administrator.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-4 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingProfile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full h-10 pl-9 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    className="w-full h-10 pl-9 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordConfirmation}
                    onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Confirm new password"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  {isChangingPassword ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
