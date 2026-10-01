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
  Phone,
  Mail,
  X,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Shield,
  PackagePlus,
  ArrowRightLeft,
  Eye,
  Percent,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Pagination } from '../components/Pagination';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';

interface StaffViewProps {
  currentUser: User | null;
}

export const StaffView: React.FC<StaffViewProps> = ({ currentUser }) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [topSeller, setTopSeller] = useState<LeaderboardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Staff Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [canDiscount, setCanDiscount] = useState(false);
  const [canHandover, setCanHandover] = useState(false);
  const [canIntakeStock, setCanIntakeStock] = useState(false);
  const [canViewCosts, setCanViewCosts] = useState(false);
  const [canManageInventory, setCanManageInventory] = useState(false);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  // Edit Staff Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCanDiscount, setEditCanDiscount] = useState(false);
  const [editCanHandover, setEditCanHandover] = useState(false);
  const [editCanIntakeStock, setEditCanIntakeStock] = useState(false);
  const [editCanViewCosts, setEditCanViewCosts] = useState(false);
  const [editCanManageInventory, setEditCanManageInventory] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

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
        can_handover: canHandover,
        can_intake_stock: canIntakeStock,
        can_view_costs: canViewCosts,
        can_manage_inventory: canManageInventory,
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
      setCanHandover(false);
      setCanIntakeStock(false);
      setCanViewCosts(false);
      setCanManageInventory(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create staff member');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  const handleOpenEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setEditName(member.name);
    setEditPhone(member.phone || '');
    setEditEmail(member.email || '');
    setEditCanDiscount(!!member.permissions?.can_discount);
    setEditCanHandover(!!member.permissions?.can_handover);
    setEditCanIntakeStock(!!member.permissions?.can_intake_stock);
    setEditCanViewCosts(!!member.permissions?.can_view_costs);
    setEditCanManageInventory(!!member.permissions?.can_manage_inventory);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!editName.trim() || !editPhone.trim()) {
      toast.error('Please provide worker full name and phone number');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      await api.updateStaff(editingStaff.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || undefined,
        can_discount: editCanDiscount,
        can_handover: editCanHandover,
        can_intake_stock: editCanIntakeStock,
        can_view_costs: editCanViewCosts,
        can_manage_inventory: editCanManageInventory,
      });

      toast.success(`${editName.trim()} updated successfully!`);
      setEditingStaff(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update staff member');
    } finally {
      setIsSubmittingEdit(false);
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

  const [currentPage, setCurrentPage] = useState(1);

  const filteredStaff = staff.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q))
    );
  });

  const pagedStaff = filteredStaff.slice((currentPage - 1) * 6, currentPage * 6);

  const totalWeekVolume = staff.reduce((acc, s) => acc + (s.stats?.sales_volume_week || 0), 0);
  const activeCount = staff.filter((s) => s.is_active).length;

  if (loading && staff.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  return (
    <div className="space-y-5 animate-page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold shadow-xs">
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Staff Team · {staff.length}</h2>
            <p className="text-[11px] text-slate-400">Manage permissions, accounts, and performance metrics</p>
          </div>
        </div>

        {/* Desktop Header Actions */}
        <div className="hidden sm:flex items-center gap-2">
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

        {/* Mobile Header Actions */}
        <div className="sm:hidden space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>
            <button
              onClick={loadData}
              title="Refresh"
              className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="h-9 px-3 shrink-0 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>Add</span>
            </button>
          </div>
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
              <TrendingUp className="w-3.5 h-3.5" />
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
        </div>
      </div>

      <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
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
                  pagedStaff.map((member) => {
                    const isSelf = member.id === currentUser?.id;

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
                                {isSelf && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold ml-1">You</span>}
                                {member.role === 'owner' && (
                                  <span className="text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">Owner</span>
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
                            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md">Full Access</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[210px]">
                              {member.permissions?.can_discount && (
                                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">Discount</span>
                              )}
                              {member.permissions?.can_handover && (
                                <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">Handover</span>
                              )}
                              {member.permissions?.can_intake_stock && (
                                <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">Intake</span>
                              )}
                              {member.permissions?.can_view_costs && (
                                <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">Costs</span>
                              )}
                              {member.permissions?.can_manage_inventory && (
                                <span className="text-[9px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded">Inventory</span>
                              )}
                              {!member.permissions?.can_discount &&
                               !member.permissions?.can_handover &&
                               !member.permissions?.can_intake_stock &&
                               !member.permissions?.can_view_costs &&
                               !member.permissions?.can_manage_inventory && (
                                <span className="text-[10px] font-medium text-slate-400">Sales Only</span>
                              )}
                            </div>
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
                                onClick={() => handleOpenEdit(member)}
                                title="Edit staff details and privileges"
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <Edit2 className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                Edit
                              </button>
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

        {/* Mobile Staff Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredStaff.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">No staff found.</div>
          ) : (
            pagedStaff.map((member) => {
              const isSelf = member.id === currentUser?.id;
              return (
                <div key={member.id} className="p-3.5 space-y-3">
                  {/* Top row: Avatar, name, role badge, status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 uppercase shrink-0 shadow-xs">
                        {member.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{member.name}</span>
                          {isSelf && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">You</span>
                          )}
                          {member.role === 'owner' && (
                            <span className="text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">Owner</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {member.email || 'No email registered'}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      member.is_active
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                    }`}>
                      <span className={`size-1.5 rounded-full ${member.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      {member.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </div>

                  {/* Info row: Phone, Access badge */}
                  <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5">
                    {member.phone ? (
                      <a
                        href={`tel:${member.phone}`}
                        className="inline-flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        <Phone className="size-3 text-slate-400" />
                        <span>{member.phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">No phone</span>
                    )}

                    <div className="shrink-0">
                      {member.role === 'owner' ? (
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60">Full Access</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                          {member.permissions?.can_discount && (
                            <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">Discount</span>
                          )}
                          {member.permissions?.can_handover && (
                            <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">Handover</span>
                          )}
                          {member.permissions?.can_intake_stock && (
                            <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">Intake</span>
                          )}
                          {member.permissions?.can_view_costs && (
                            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">Costs</span>
                          )}
                          {member.permissions?.can_manage_inventory && (
                            <span className="text-[9px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded">Inventory</span>
                          )}
                          {!member.permissions?.can_discount &&
                           !member.permissions?.can_handover &&
                           !member.permissions?.can_intake_stock &&
                           !member.permissions?.can_view_costs &&
                           !member.permissions?.can_manage_inventory && (
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">Sales Only</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Performance stats: 3 mini columns */}
                  <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 text-center">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Week</div>
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-white mt-0.5">
                        {(member.stats?.sales_volume_week || 0).toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{member.stats?.sales_count_week || 0} sold</div>
                    </div>
                    <div className="border-x border-slate-200/60 dark:border-slate-800/60">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Month</div>
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-white mt-0.5">
                        {(member.stats?.sales_volume_month || 0).toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{member.stats?.sales_count_month || 0} sold</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bonus</div>
                      {(member.stats?.uncollected_bonus ?? 0) > 0 ? (
                        <div>
                          <div className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                            {(member.stats.uncollected_bonus ?? 0).toLocaleString()}
                          </div>
                          <div className="text-[9px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5">uncollected</div>
                        </div>
                      ) : (member.stats?.total_bonus_earned ?? 0) > 0 ? (
                        <div>
                          <div className="font-mono font-semibold text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                            {(member.stats.total_bonus_earned ?? 0).toLocaleString()}
                          </div>
                          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">settled</div>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs mt-0.5">—</div>
                      )}
                    </div>
                  </div>

                  {/* Actions row on mobile */}
                  {member.role !== 'owner' && !isSelf && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <button
                        onClick={() => handleOpenEdit(member)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Edit2 className="size-3 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setResetConfirmStaff(member)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <KeyRound className="size-3" />
                        <span>Reset Password</span>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(member)}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                          member.is_active
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                        }`}
                      >
                        {member.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
          {filteredStaff.length > 6 && (
            <div className="px-4 pb-4">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredStaff.length}
                pageSize={6}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
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

              {/* Granular Permissions Section */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Staff Privileges & Permissions</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Configure access level</span>
                </div>

                <div className="space-y-2.5 bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  {/* Privilege 1: Discount */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      id="canDiscount"
                      checked={canDiscount}
                      onChange={(e) => setCanDiscount(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Percent className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>Allow Counter Discounts</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can apply custom price discounts during POS checkout.</div>
                    </div>
                  </label>

                  {/* Privilege 2: Handover */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <input
                      type="checkbox"
                      id="canHandover"
                      checked={canHandover}
                      onChange={(e) => setCanHandover(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3 h-3 text-blue-500 shrink-0" />
                        <span>Allow Device Handover & Flow</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can hand out units to brokers/staff, confirm handover sales, or restock to shelf.</div>
                    </div>
                  </label>

                  {/* Privilege 3: Intake Stock */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <input
                      type="checkbox"
                      id="canIntakeStock"
                      checked={canIntakeStock}
                      onChange={(e) => setCanIntakeStock(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <PackagePlus className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span>Allow Stock Intake</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can add new inventory units, record supplier shipments, and add catalog models.</div>
                    </div>
                  </label>

                  {/* Privilege 4: View Costs */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <input
                      type="checkbox"
                      id="canViewCosts"
                      checked={canViewCosts}
                      onChange={(e) => setCanViewCosts(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Eye className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Allow View Cost Basis & Margins</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can view purchase prices, cost basis, and margin percentages on devices.</div>
                    </div>
                  </label>

                  {/* Privilege 5: Manage Inventory */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <input
                      type="checkbox"
                      id="canManageInventory"
                      checked={canManageInventory}
                      onChange={(e) => setCanManageInventory(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-cyan-500 shrink-0" />
                        <span>Allow Inventory Management & Swaps</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can edit unit IMEI/serials, process customer warranty returns, and handle vendor swaps.</div>
                    </div>
                  </label>
                </div>
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

      {/* ── Modal: Edit Staff Member ── */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setEditingStaff(null)}
          />

          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Staff & Privileges
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Modify profile details and toggle granular operational permissions.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingStaff(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="mt-4 space-y-4">
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
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    placeholder="e.g. kidus@boletech.et"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                  />
                </div>
              </div>

              {/* Granular Permissions Section */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    <span>Staff Privileges & Permissions</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Checked = Enabled</span>
                </div>

                <div className="space-y-2.5 bg-slate-50/70 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  {/* Privilege 1: Discount */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={editCanDiscount}
                      onChange={(e) => setEditCanDiscount(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Percent className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>Allow Counter Discounts</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can apply custom price discounts during POS checkout.</div>
                    </div>
                  </label>

                  {/* Privilege 2: Handover */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={editCanHandover}
                      onChange={(e) => setEditCanHandover(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ArrowRightLeft className="w-3 h-3 text-blue-500 shrink-0" />
                        <span>Allow Device Handover & Flow</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can hand out units to brokers/staff, confirm handover sales, or restock to shelf.</div>
                    </div>
                  </label>

                  {/* Privilege 3: Intake Stock */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={editCanIntakeStock}
                      onChange={(e) => setEditCanIntakeStock(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <PackagePlus className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span>Allow Stock Intake</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can add new inventory units, record supplier shipments, and add catalog models.</div>
                    </div>
                  </label>

                  {/* Privilege 4: View Costs */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={editCanViewCosts}
                      onChange={(e) => setEditCanViewCosts(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Eye className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Allow View Cost Basis & Margins</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can view purchase prices, cost basis, and margin percentages on devices.</div>
                    </div>
                  </label>

                  {/* Privilege 5: Manage Inventory */}
                  <label className="flex items-start gap-2.5 cursor-pointer group pt-2.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <input
                      type="checkbox"
                      checked={editCanManageInventory}
                      onChange={(e) => setEditCanManageInventory(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-cyan-500 shrink-0" />
                        <span>Allow Inventory Management & Swaps</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Can edit unit IMEI/serials, process customer warranty returns, and handle vendor swaps.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
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
