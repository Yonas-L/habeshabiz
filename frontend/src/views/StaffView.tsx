import React, { useState, useEffect, useCallback } from 'react';
import type { StaffMember, LeaderboardItem, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  KeyRound,
  Copy,
  Check,
  Search,
  Award,
  Sparkles,
  Phone,
  Mail,
  X,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';

interface StaffViewProps {
  currentUser: User | null;
}

export const StaffView: React.FC<StaffViewProps> = ({ currentUser }) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [topSeller, setTopSeller] = useState<LeaderboardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Staff Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [canDiscount, setCanDiscount] = useState(false);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  // Temporary Credentials Share Modal
  const [shareCredentials, setShareCredentials] = useState<{
    name: string;
    login: string;
    temporaryPassword: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Password Reset Confirmation Modal
  const [resetConfirmStaff, setResetConfirmStaff] = useState<StaffMember | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [staffRes, lbRes] = await Promise.all([
        api.getStaff(),
        api.getLeaderboard(),
      ]);
      setStaff(staffRes);
      setLeaderboard(lbRes.leaderboard || []);
      setTopSeller(lbRes.top_seller || null);
    } catch (err: any) {
      toast.error('Failed to load team data', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      toast.error('Please provide worker full name and phone number');
      return;
    }

    try {
      setIsSubmittingStaff(true);
      const res = await api.createStaff({
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        can_discount: canDiscount,
      });

      toast.success('Staff account created successfully!');
      setIsAddModalOpen(false);

      // Open the share credentials dialog
      setShareCredentials({
        name: res.user.name,
        login: res.user.phone || res.user.email,
        temporaryPassword: res.temporary_password,
      });

      // Reset form
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setCanDiscount(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create staff member');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  const handleToggleStatus = async (staffMember: StaffMember) => {
    try {
      await api.toggleStaffStatus(staffMember.id);
      toast.success(
        `${staffMember.name} has been ${staffMember.is_active ? 'suspended' : 'activated'}`
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleResetPassword = async () => {
    if (!resetConfirmStaff) return;
    try {
      setIsResetting(true);
      const res = await api.resetStaffPassword(resetConfirmStaff.id);
      toast.success(`Password reset for ${resetConfirmStaff.name}`);
      const targetStaff = resetConfirmStaff;
      setResetConfirmStaff(null);

      // Open share credentials modal with new temporary password
      setShareCredentials({
        name: targetStaff.name,
        login: targetStaff.phone || targetStaff.email,
        temporaryPassword: res.temporary_password,
      });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!shareCredentials) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const textToCopy = `👋 Welcome to Bole Tech Business OS!\n\nHere are your staff login credentials:\n👤 Login / Phone: ${shareCredentials.login}\n🔑 Temporary Password: ${shareCredentials.temporaryPassword}\n🌐 Workspace URL: ${origin}\n\nPlease sign in and update your temporary password under your Account Settings.`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedCredentials(true);
    toast.success('Credentials copied to clipboard! Ready to send via Telegram / SMS.');
    setTimeout(() => setCopiedCredentials(false), 3000);
  };

  const filteredStaff = staff.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q))
    );
  });

  const totalWeekVolume = staff.reduce((acc, s) => acc + (s.stats?.sales_volume_week || 0), 0);
  const activeCount = staff.filter((s) => s.is_active).length;

  return (
    <div className="space-y-5 animate-page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold shadow-xs">
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Staff Team ({staff.length})</h2>
            <p className="text-[11px] text-slate-400">Manage permissions, accounts, and performance metrics</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white w-52"
            />
          </div>
          <button
            onClick={loadData}
            title="Refresh"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm flex items-center gap-2 active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            Add Staff
          </button>
        </div>
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Team</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{staff.length}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">{activeCount} active</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Week Sales</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            <AnimatedNumber value={totalWeekVolume} />
            <span className="text-[10px] font-medium text-slate-400 ml-1 font-sans">ETB</span>
          </div>
        </div>

        <div className="lg:col-span-2 p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Award className="w-3.5 h-3.5" />
              Top This Week
            </div>
            {topSeller ? (
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {topSeller.name}
                  <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                    {topSeller.bonus_tier}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{topSeller.week_volume.toLocaleString()} ETB</span>
                  {' · '}{topSeller.week_count} sold
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No sales this week yet.</div>
            )}
          </div>
          <Sparkles className="w-6 h-6 text-amber-400 dark:text-amber-500 shrink-0" />
        </div>
      </div>

      <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">Member</th>
                  <th className="py-3 px-4 whitespace-nowrap">Phone</th>
                  <th className="py-3 px-4 whitespace-nowrap">Access</th>
                  <th className="py-3 px-4 whitespace-nowrap">Week</th>
                  <th className="py-3 px-4 whitespace-nowrap">Month</th>
                  <th className="py-3 px-4 whitespace-nowrap">Bonus</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">No staff found.</td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => {
                    const isSelf = member.id === currentUser?.id;
                    const rankItem = leaderboard.find((l) => l.user_id === member.id);

                    return (
                      <tr key={member.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 uppercase shrink-0">
                              {member.name.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                                {member.name}
                                {isSelf && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">(You)</span>}
                                {member.role === 'owner' && (
                                  <span className="text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">Owner</span>
                                )}
                                {rankItem && rankItem.rank <= 3 && (
                                  <span className="text-[10px]">{rankItem.rank === 1 ? '🥇' : rankItem.rank === 2 ? '🥈' : '🥉'}</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{member.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {member.phone || <span className="text-slate-400 italic font-sans">—</span>}
                        </td>

                        {/* Access */}
                        <td className="py-3 px-4">
                          {member.role === 'owner' ? (
                            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">Full Access</span>
                          ) : member.permissions?.can_discount ? (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Can Discount</span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">Fixed Prices</span>
                          )}
                        </td>

                        {/* Weekly */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {(member.stats?.sales_volume_week || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">ETB</span>
                          <span className="text-[10px] text-slate-400 ml-1">· {member.stats?.sales_count_week || 0}</span>
                        </td>

                        {/* Monthly */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {(member.stats?.sales_volume_month || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">ETB</span>
                          <span className="text-[10px] text-slate-400 ml-1">· {member.stats?.sales_count_month || 0}</span>
                        </td>

                        {/* Bonus */}
                        <td className="py-3 px-4 font-mono whitespace-nowrap">
                          {(member.stats?.uncollected_bonus ?? 0) > 0 ? (
                            <div>
                              <span className="font-bold text-purple-700 dark:text-purple-300 text-xs">
                                {(member.stats.uncollected_bonus ?? 0).toLocaleString()}
                              </span>
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 ml-1">ETB</span>
                              <span className="text-[9px] block text-purple-600 dark:text-purple-400 font-sans font-semibold">uncollected</span>
                            </div>
                          ) : (member.stats?.total_bonus_earned ?? 0) > 0 ? (
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                                {(member.stats.total_bonus_earned ?? 0).toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">ETB</span>
                              <span className="text-[9px] block text-emerald-600 dark:text-emerald-400 font-sans">settled</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            member.is_active
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500 dark:text-rose-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                            {member.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          {member.role !== 'owner' && !isSelf ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setResetConfirmStaff(member)}
                                title="Reset password"
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <KeyRound className="w-3 h-3" />
                                Reset
                              </button>
                              <button
                                onClick={() => handleToggleStatus(member)}
                                className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-colors ${
                                  member.is_active
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
                                }`}
                              >
                                {member.is_active ? 'Suspend' : 'Activate'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">{isSelf ? 'You' : 'Admin'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* ── Modal 1: Add Staff Member ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsAddModalOpen(false)}
          />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Add New Staff Member
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    A temporary login password will be generated automatically.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Worker Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kidus Tesfaye"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phone Number * (used for staff login)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="0911234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    placeholder="e.g. kidus@boletech.et (or leave blank to auto-generate)"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="canDiscount"
                  checked={canDiscount}
                  onChange={(e) => setCanDiscount(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="canDiscount" className="cursor-pointer">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Allow Counter Discounts</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Can apply custom discounts when making sales.</div>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="px-4 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingStaff ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Create Staff Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Shareable Temporary Credentials Card ── */}
      {shareCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShareCredentials(null)}
          />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-6">
            <div className="text-center pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Credentials Ready
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Share with <span className="font-bold text-slate-900 dark:text-white">{shareCredentials.name}</span>
              </p>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Login</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{shareCredentials.login}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400">Password</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm tracking-wider">{shareCredentials.temporaryPassword}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-[11px] font-mono text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-4">
              {`👋 Welcome to Bole Tech Business OS!\n\nLogin: ${shareCredentials.login}\nPassword: ${shareCredentials.temporaryPassword}\nURL: ${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}\n\nPlease sign in and update your password.`}
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={handleCopyCredentials}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
              >
                {copiedCredentials ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy for Telegram / SMS</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShareCredentials(null)}
                className="px-4 h-10 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Confirm Reset Password ── */}
      {resetConfirmStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={() => setResetConfirmStaff(null)}
          />

          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Reset Password for {resetConfirmStaff.name}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              A new temporary password will be generated for this worker. Their previous password will no longer work.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setResetConfirmStaff(null)}
                className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isResetting}
                className="flex-1 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>Reset Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
