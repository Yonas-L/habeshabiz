import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  X,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Trash2,
  FileText,
  ChevronRight,
  CheckCircle2,
  UserX,
  UserCheck,
  MoreVertical,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { StaffDetailView } from './StaffDetailView';
import { EditStaffBottomSheet } from '../components/staff/EditStaffBottomSheet';

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
  const [mobileActionStaff, setMobileActionStaff] = useState<StaffMember | null>(null);

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

  // Remove Staff Confirmation Modal State
  const [removeConfirmStaff, setRemoveConfirmStaff] = useState<StaffMember | null>(null);
  const [isRemovingStaff, setIsRemovingStaff] = useState(false);

  // Staff Statement & Detail View State
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

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
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Please provide worker full name and email address');
      return;
    }

    try {
      setIsSubmittingStaff(true);
      const res = await api.createStaff({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        phone: newPhone.trim() || undefined,
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
        login: res.user.email || res.user.phone || '',
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
      const msg = err.errors?.email?.[0] || err.errors?.phone?.[0] || err.message || 'Failed to create staff member';
      toast.error(msg);
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  const handleOpenEdit = (member: StaffMember) => {
    setEditingStaff(member);
  };

  const handleConfirmRemoveStaff = async () => {
    if (!removeConfirmStaff) return;
    try {
      setIsRemovingStaff(true);
      await api.deleteStaff(removeConfirmStaff.id);
      toast.success(`Staff account ${removeConfirmStaff.name} removed successfully.`);
      setRemoveConfirmStaff(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove staff account');
    } finally {
      setIsRemovingStaff(false);
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
        login: targetStaff.email || targetStaff.phone || '',
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

  if (loading && staff.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  if (selectedStaffId) {
    return (
      <StaffDetailView
        staffId={selectedStaffId}
        user={currentUser}
        onBack={() => {
          setSelectedStaffId(null);
          loadData();
        }}
        onStaffUpdated={loadData}
      />
    );
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

        <div className="col-span-2 lg:col-span-2 p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Top This Week</span>
            </div>
            {topSeller ? (
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    <span className="truncate">{topSeller.name}</span>
                    <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 rounded shrink-0">
                      {topSeller.bonus_tier}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{topSeller.week_volume.toLocaleString()} ETB</span>
                    {' · '}{topSeller.week_count} sold
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No sales this week yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MOBILE VIEW (< md) — Cardless, Edge-to-Edge Matching Vendors & Expenses ─── */}
      <div className="md:hidden flex-1 overflow-y-auto h-[calc(100vh-250px)] min-h-[380px] scrollbar-thin px-0.5">
        {filteredStaff.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
              No staff members found
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Team members you register will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y-0 pb-12">
            {filteredStaff.map((member) => {
              const isSelf = member.id === currentUser?.id;
              const uncollected = member.stats?.uncollected_bonus ?? 0;
              const settledBonus = member.stats?.total_bonus_earned ?? 0;
              const handoversCount = member.stats?.active_handovers_count ?? 0;

              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedStaffId(member.id)}
                  className="w-full flex items-center justify-between py-3 border-b border-slate-200/50 dark:border-slate-800/50 text-left active:opacity-60 transition-opacity cursor-pointer min-w-0 group"
                >
                  {/* Left: Name, Badges, Phone / Email, Handovers count */}
                  <div className="min-w-0 pr-3 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${member.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-[13px] min-[390px]:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {member.name}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">You</span>
                      )}
                      {member.role === 'owner' && (
                        <span className="text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 px-1.5 py-0.2 rounded shrink-0">
                          Owner
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      <span className="font-mono truncate">{member.email || member.phone}</span>
                      {handoversCount > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold font-sans shrink-0">
                          • {handoversCount} {handoversCount === 1 ? 'unit held' : 'units held'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Bonus badge + clean action menu / chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className={`font-mono font-bold text-[13px] min-[390px]:text-sm tabular-nums ${
                        uncollected > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : settledBonus > 0
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {uncollected > 0
                          ? `−${uncollected.toLocaleString()} ETB`
                          : settledBonus > 0
                          ? `${settledBonus.toLocaleString()} ETB`
                          : '0 ETB'}
                      </div>
                      <div className={`text-[10px] font-semibold text-right ${
                        uncollected > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : settledBonus > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400'
                      }`}>
                        {uncollected > 0 ? 'bonus due' : settledBonus > 0 ? 'settled' : 'no sales'}
                      </div>
                    </div>

                    {member.role !== 'owner' && !isSelf && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileActionStaff(member);
                        }}
                        className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Staff quick actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}

                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors shrink-0" />
                  </div>
                </div>
              );
            })}

            {/* Footer count indicator */}
            <div className="py-4 text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>All {filteredStaff.length} staff loaded</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── DESKTOP VIEW (≥ md) — Fixed-height Inside Scroll Staff Table (No horizontal scroll, unpaginated) ─── */}
      <div className="hidden md:flex bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-2xs flex-1 flex-col min-h-0">
        <div className="overflow-x-hidden overflow-y-auto h-[calc(100vh-270px)] sm:h-[calc(100vh-250px)] min-h-[440px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 relative">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-[#131926]/95 backdrop-blur-xs border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shadow-2xs">
              <tr>
                <th className="py-3.5 px-5">Member</th>
                <th className="py-3.5 px-5">Phone</th>
                <th className="py-3.5 px-5">Bonus</th>
                <th className="py-3.5 px-5">Handovers</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">No staff found.</td>
                </tr>
              ) : (
                <>
                  {filteredStaff.map((member) => {
                    const isSelf = member.id === currentUser?.id;

                    return (
                      <tr
                        key={member.id}
                        onClick={() => setSelectedStaffId(member.id)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                      >
                        {/* Member */}
                        <td className="py-4 px-5">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 whitespace-nowrap">
                              {member.name}
                              {isSelf && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold ml-1">You</span>}
                              {member.role === 'owner' && (
                                <span className="text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">Owner</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 truncate max-w-[220px] font-mono mt-0.5">{member.email}</div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-4 px-5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                          {member.phone || <span className="text-slate-400 italic font-sans">—</span>}
                        </td>

                        {/* Bonus */}
                        <td className="py-4 px-5 font-mono whitespace-nowrap">
                          {(member.stats?.uncollected_bonus ?? 0) > 0 ? (
                            <div>
                              <span className="font-bold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                                −{(member.stats.uncollected_bonus ?? 0).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-rose-500 dark:text-rose-400 ml-1">ETB</span>
                              <span className="text-[10px] block text-rose-600 dark:text-rose-400 font-sans font-semibold">uncollected bonus</span>
                            </div>
                          ) : (member.stats?.total_bonus_earned ?? 0) > 0 ? (
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm tabular-nums">
                                {(member.stats.total_bonus_earned ?? 0).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-1">ETB</span>
                              <span className="text-[10px] block text-emerald-600 dark:text-emerald-400 font-sans font-medium">settled</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Handovers */}
                        <td className="py-4 px-5 font-mono whitespace-nowrap">
                          {(member.stats?.active_handovers_count ?? 0) > 0 ? (
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white text-sm tabular-nums">
                                {(member.stats?.active_handovers_value || 0).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-1">ETB</span>
                              <span className="text-[10px] block text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                                {member.stats?.active_handovers_count} {member.stats?.active_handovers_count === 1 ? 'unit held' : 'units held'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                            member.is_active
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500 dark:text-rose-400'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {member.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        {/* Minimalized Actions */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedStaffId(member.id)}
                              title="Performance Statement"
                              className="p-2 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            {member.role !== 'owner' && !isSelf && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(member)}
                                  title="Edit details & access"
                                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setResetConfirmStaff(member)}
                                  title="Reset password"
                                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(member)}
                                  title={member.is_active ? 'Suspend staff' : 'Activate staff'}
                                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                    member.is_active
                                      ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                      : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  }`}
                                >
                                  {member.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRemoveConfirmStaff(member)}
                                  title="Remove staff account"
                                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* All staff loaded footer indicator */}
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>All {filteredStaff.length} staff members loaded</span>
                      </span>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom Sheet 1: Add Staff Member ── */}
      {isAddModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setIsAddModalOpen(false)}
          />

          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden max-sm:animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[90vh] sm:max-h-[85vh] my-0 sm:my-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

            {/* Pinned Header */}
            <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-4.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131926] shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Add New Staff Member
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  A temporary login password will be generated automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateStaff} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
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
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address * <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">(used for staff login & unique ID)</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. kidus@boletech.et"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Worker will use this email to log in. Default temporary password: <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">434344#Pass</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Phone Number <span className="text-[11px] text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0911234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
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
                        id="canDiscount"
                        checked={canDiscount}
                        onChange={(e) => setCanDiscount(e.target.checked)}
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
                        id="canHandover"
                        checked={canHandover}
                        onChange={(e) => setCanHandover(e.target.checked)}
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
                        id="canIntakeStock"
                        checked={canIntakeStock}
                        onChange={(e) => setCanIntakeStock(e.target.checked)}
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
                        id="canViewCosts"
                        checked={canViewCosts}
                        onChange={(e) => setCanViewCosts(e.target.checked)}
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
                        id="canManageInventory"
                        checked={canManageInventory}
                        onChange={(e) => setCanManageInventory(e.target.checked)}
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
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
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
        </div>,
        document.body
      )}

      {/* ── Edit Staff Bottom Sheet ── */}
      {editingStaff && (
        <EditStaffBottomSheet
          isOpen={!!editingStaff}
          onClose={() => setEditingStaff(null)}
          staff={editingStaff}
          onSuccess={() => {
            setEditingStaff(null);
            loadData();
          }}
        />
      )}

      {/* ── Mobile Staff Quick Action Sheet ── */}
      {mobileActionStaff && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setMobileActionStaff(null)}
          />

          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-t-3xl border-t border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden max-sm:animate-bottom-sheet sm:animate-modal-enter flex flex-col pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-2 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {mobileActionStaff.name}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                  {mobileActionStaff.email || mobileActionStaff.phone}
                </p>
              </div>
              <button
                onClick={() => setMobileActionStaff(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions List */}
            <div className="p-3 space-y-1">
              <button
                type="button"
                onClick={() => {
                  const target = mobileActionStaff;
                  setMobileActionStaff(null);
                  handleOpenEdit(target);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Edit2 className="w-4 h-4 text-slate-500" />
                <span>Edit Staff & Privileges</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = mobileActionStaff;
                  setMobileActionStaff(null);
                  handleToggleStatus(target);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {mobileActionStaff.is_active ? (
                  <>
                    <UserX className="w-4 h-4 text-rose-500" />
                    <span>Suspend Staff Account</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span>Activate Staff Account</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = mobileActionStaff;
                  setMobileActionStaff(null);
                  setResetConfirmStaff(target);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>Reset Temporary Password</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = mobileActionStaff;
                  setMobileActionStaff(null);
                  setRemoveConfirmStaff(target);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Remove Staff Account</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal 2: Shareable Temporary Credentials Card ── */}
      {shareCredentials && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={() => setShareCredentials(null)}
          />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-5 sm:p-6 my-auto">
            <div className="text-center pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 mx-auto flex items-center justify-center mb-2.5">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Credentials Ready
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Share with <span className="font-bold text-slate-900 dark:text-white">{shareCredentials.name}</span>
              </p>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Login</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{shareCredentials.login}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-slate-400">Password</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm tracking-wider">{shareCredentials.temporaryPassword}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1017] border border-slate-200/80 dark:border-slate-800/80 text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-4">
              {`👋 Welcome to Bole Tech Business OS!\n\nLogin: ${shareCredentials.login}\nPassword: ${shareCredentials.temporaryPassword}\nURL: ${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}\n\nPlease sign in and update your password.`}
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={handleCopyCredentials}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/25 active:scale-[0.98] cursor-pointer"
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
                className="px-4 h-10 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal 3: Confirm Reset Password ── */}
      {resetConfirmStaff && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={() => setResetConfirmStaff(null)}
          />

          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-5 sm:p-6 text-center my-auto">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Reset Password for {resetConfirmStaff.name}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              A new temporary password will be generated for this worker. Their previous password will no longer work.
            </p>

            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setResetConfirmStaff(null)}
                className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isResetting}
                className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
              >
                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>Reset Now</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal 4: Confirm Remove Staff ── */}
      {removeConfirmStaff && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={() => !isRemovingStaff && setRemoveConfirmStaff(null)}
          />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-5 sm:p-6 my-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Remove Staff Account
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {removeConfirmStaff.name} ({removeConfirmStaff.phone || removeConfirmStaff.email})
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0c1017] p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2 mb-5 leading-relaxed">
              <p>
                Removing this staff account will revoke their login access and permanently remove them from your active staff list.
              </p>
              <div className="flex items-start gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                <span>All past sales orders, bonuses, and audit logs recorded by {removeConfirmStaff.name} remain safely preserved for your financial records.</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => setRemoveConfirmStaff(null)}
                disabled={isRemovingStaff}
                className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveStaff}
                disabled={isRemovingStaff}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-rose-600/25 disabled:opacity-50 cursor-pointer"
              >
                {isRemovingStaff ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Staff</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
