import React, { useState, useEffect, useCallback } from 'react';
import type { StaffMember, AuditLogItem, LeaderboardItem, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  KeyRound,
  Copy,
  Check,
  Search,
  Activity,
  Award,
  Sparkles,
  Phone,
  Mail,
  Send,
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
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [topSeller, setTopSeller] = useState<LeaderboardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');

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
      const [staffRes, auditRes, lbRes] = await Promise.all([
        api.getStaff(),
        api.getAuditLogs(),
        api.getLeaderboard(),
      ]);
      setStaff(staffRes);
      setAuditLogs(auditRes);
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

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditActionFilter === 'all') return true;
    if (auditActionFilter === 'sales') return log.action.includes('sale');
    if (auditActionFilter === 'inventory') return log.action.includes('unit');
    if (auditActionFilter === 'staff') return log.action.includes('staff') || log.action.includes('password') || log.action.includes('profile');
    return log.action === auditActionFilter;
  });

  const totalWeekVolume = staff.reduce((acc, s) => acc + (s.stats?.sales_volume_week || 0), 0);
  const activeCount = staff.filter((s) => s.is_active).length;

  return (
    <div className="space-y-5 animate-page-enter">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Staff & Team Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create employee accounts, issue temporary login passwords, configure counter privileges, and monitor live audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            title="Refresh Data"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm flex items-center gap-2 active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>+ Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>Total Team</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {staff.length}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            {activeCount} active login accounts
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>Week's Staff Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            <AnimatedNumber value={totalWeekVolume} /> <span className="text-xs font-normal text-slate-400">ETB</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
            Combined weekly counter volume
          </div>
        </div>

        {/* Week's Top Seller Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-amber-950/20 dark:via-[#131926] dark:to-amber-950/10 border border-amber-200/70 dark:border-amber-900/40 shadow-xs lg:col-span-2 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Award className="w-4 h-4" />
              <span>Week's Top Performer</span>
            </div>
            {topSeller ? (
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{topSeller.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                    {topSeller.bonus_tier}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {topSeller.week_volume.toLocaleString()} ETB
                  </span>{' '}
                  ({topSeller.week_count} devices sold)
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No recorded sales this week yet.</div>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'members'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Members ({staff.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'audit'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Live Audit & Security Log ({auditLogs.length})</span>
          </button>
        </div>

        {activeTab === 'members' && (
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white w-64"
            />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-slate-400 font-medium">Filter:</span>
            <select
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="all">All Events</option>
              <option value="sales">Sales Events</option>
              <option value="inventory">Inventory & Handovers</option>
              <option value="staff">Staff & Security</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Staff Members Table */}
      {activeTab === 'members' && (
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Phone / Username</th>
                  <th className="py-3 px-4">Privileges</th>
                  <th className="py-3 px-4">Weekly Sales</th>
                  <th className="py-3 px-4">Monthly Sales</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No team members found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => {
                    const isSelf = member.id === currentUser?.id;
                    const rankItem = leaderboard.find((l) => l.user_id === member.id);

                    return (
                      <tr
                        key={member.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        {/* Name & Role */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 uppercase">
                              {member.name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{member.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                    (You)
                                  </span>
                                )}
                                {member.role === 'owner' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50">
                                    Owner
                                  </span>
                                )}
                                {rankItem && rankItem.rank <= 3 && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50">
                                    {rankItem.rank === 1 ? '🥇 #1' : rankItem.rank === 2 ? '🥈 #2' : '🥉 #3'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phone / Username */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                          {member.phone ? (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{member.phone}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No phone</span>
                          )}
                        </td>

                        {/* Permissions */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {member.role === 'owner' ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                                Full Access
                              </span>
                            ) : member.permissions?.can_discount ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                Can Discount
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Fixed Prices
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Weekly Sales */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {(member.stats?.sales_volume_week || 0).toLocaleString()} ETB
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {member.stats?.sales_count_week || 0} units
                          </div>
                        </td>

                        {/* Monthly Sales */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {(member.stats?.sales_volume_month || 0).toLocaleString()} ETB
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {member.stats?.sales_count_month || 0} units
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              member.is_active
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                member.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                              }`}
                            />
                            <span>{member.is_active ? 'Active' : 'Suspended'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {member.role !== 'owner' && !isSelf ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setResetConfirmStaff(member)}
                                title="Reset password & issue temporary credentials"
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <KeyRound className="w-3 h-3 text-slate-400" />
                                <span>Reset Pass</span>
                              </button>

                              <button
                                onClick={() => handleToggleStatus(member)}
                                className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-colors ${
                                  member.is_active
                                    ? 'border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                    : 'border border-emerald-200 dark:border-emerald-900/60 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                }`}
                              >
                                {member.is_active ? 'Suspend' : 'Activate'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              {isSelf ? 'Current Session' : 'Workspace Admin'}
                            </span>
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
      )}

      {/* Tab 2: Live Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Details & Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No audit events recorded for this selection.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const getActionBadge = (action: string) => {
                      if (action === 'sale_created') {
                        return (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                            Sale Created
                          </span>
                        );
                      }
                      if (action === 'unit_handover') {
                        return (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                            Unit Handover
                          </span>
                        );
                      }
                      if (action === 'unit_restocked') {
                        return (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50">
                            Unit Restocked
                          </span>
                        );
                      }
                      if (action === 'customer_return') {
                        return (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                            Customer Return
                          </span>
                        );
                      }
                      if (action === 'staff_created') {
                        return (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                            Staff Created
                          </span>
                        );
                      }
                      if (action.includes('password')) {
                        return (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                            Security / Pass
                          </span>
                        );
                      }
                      return (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {action}
                        </span>
                      );
                    };

                    const dateObj = new Date(log.created_at);
                    const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        {/* Time */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{formattedTime}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">{formattedDate}</span>
                        </td>

                        {/* Performer */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {log.user?.name || 'System / Automated'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {log.ip_address || 'Internal Session'}
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3 px-4">{getActionBadge(log.action)}</td>

                        {/* Entity */}
                        <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-400">
                          {log.entity_type} {log.entity_id ? `(#${log.entity_id.slice(0, 8)})` : ''}
                        </td>

                        {/* Details */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {log.new_values ? (
                            <div className="font-mono text-[11px] space-x-2">
                              {log.new_values.order_number && (
                                <span className="font-bold text-slate-900 dark:text-white">
                                  Order #{log.new_values.order_number}
                                </span>
                              )}
                              {log.new_values.total_amount && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  {Number(log.new_values.total_amount).toLocaleString()} ETB
                                </span>
                              )}
                              {log.new_values.handover_to && (
                                <span className="text-blue-600 dark:text-blue-400">
                                  Handed to: {log.new_values.handover_to}
                                </span>
                              )}
                              {log.new_values.return_reason && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  Reason: "{log.new_values.return_reason}"
                                </span>
                              )}
                              {log.new_values.temporary_password_issued && (
                                <span className="text-indigo-600 dark:text-indigo-400">
                                  Temporary password issued
                                </span>
                              )}
                              {log.new_values.staff_name && (
                                <span className="text-slate-800 dark:text-slate-200">
                                  Worker: {log.new_values.staff_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No extra metadata</span>
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
      )}

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
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
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

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="canDiscount"
                  checked={canDiscount}
                  onChange={(e) => setCanDiscount(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="canDiscount" className="cursor-pointer">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Allow Counter Discounts
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    If checked, this salesperson can apply custom discounts when making sales.
                  </div>
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

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-emerald-500/30 dark:border-emerald-500/40 shadow-2xl overflow-hidden animate-modal-enter p-6">
            <div className="text-center pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Account Credentials Ready to Share
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Share this login information with <span className="font-bold text-slate-900 dark:text-white">{shareCredentials.name}</span>.
              </p>
            </div>

            {/* Credential Card Display */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 font-mono">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-sans font-medium">Login Identifier:</span>
                <span className="font-bold text-slate-900 dark:text-white">{shareCredentials.login}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-sans font-medium">Temporary Password:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-sm tracking-wider">
                  {shareCredentials.temporaryPassword}
                </span>
              </div>
            </div>

            {/* Formatted Message Box */}
            <div className="mt-4 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-400 mb-1">
                <Send className="w-3.5 h-3.5" />
                <span>Pre-formatted for Telegram / SMS:</span>
              </div>
              <div className="font-mono text-[11px] bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {`👋 Welcome to Bole Tech Business OS!\n\nHere are your staff login credentials:\n👤 Login: ${shareCredentials.login}\n🔑 Temporary Password: ${shareCredentials.temporaryPassword}\n🌐 URL: ${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}\n\nPlease sign in and update your password.`}
              </div>
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                onClick={handleCopyCredentials}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
              >
                {copiedCredentials ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied for Telegram / SMS!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Telegram / SMS Message</span>
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
