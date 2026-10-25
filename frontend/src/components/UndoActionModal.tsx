import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AuditLogItem, UndoPreviewData, UndoPreviewNode } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  X,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Package,
  Wallet,
  Scale,
  Award,
  FileText,
  ArrowDown,
  Clock,
  UserCheck,
  Loader2,
  Undo2,
} from 'lucide-react';

interface UndoActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLogItem | null;
  onSuccess: () => void;
}

// Map category to semantic styling and icon
function getNodeCategoryConfig(category: UndoPreviewNode['category'], direction: UndoPreviewNode['direction']) {
  switch (category) {
    case 'inventory':
      return {
        icon: Package,
        color: direction === 'in' ? 'text-emerald-500' : 'text-rose-500',
        bg: direction === 'in' ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40',
        border: direction === 'in' ? 'border-emerald-200/80 dark:border-emerald-800/80' : 'border-rose-200/80 dark:border-rose-800/80',
        badge: direction === 'in' ? 'Restores Stock (+)' : 'Removes Unit (-)',
        badgeColor: direction === 'in' ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100/70 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
      };
    case 'financial':
      return {
        icon: Wallet,
        color: direction === 'in' ? 'text-emerald-500' : 'text-rose-500',
        bg: direction === 'in' ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : 'bg-rose-50/50 dark:bg-rose-950/30',
        border: direction === 'in' ? 'border-emerald-200/80 dark:border-emerald-800/80' : 'border-rose-200/80 dark:border-rose-800/80',
        badge: direction === 'in' ? 'Account Refund (+)' : 'Account Debit (-)',
        badgeColor: direction === 'in' ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100/70 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
      };
    case 'debt':
      return {
        icon: Scale,
        color: direction === 'in' ? 'text-amber-500' : 'text-purple-500',
        bg: direction === 'in' ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-purple-50 dark:bg-purple-950/40',
        border: direction === 'in' ? 'border-amber-200/80 dark:border-amber-800/80' : 'border-purple-200/80 dark:border-purple-800/80',
        badge: direction === 'in' ? 'Balance Reopened' : 'Debt Cancelled',
        badgeColor: direction === 'in' ? 'bg-amber-100/70 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300' : 'bg-purple-100/70 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
      };
    case 'bonus':
      return {
        icon: Award,
        color: 'text-orange-500',
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        border: 'border-orange-200/80 dark:border-orange-800/80',
        badge: 'Bonus Revoked',
        badgeColor: 'bg-orange-100/70 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300',
      };
    case 'document':
    default:
      return {
        icon: FileText,
        color: 'text-slate-500',
        bg: 'bg-slate-50 dark:bg-slate-900/40',
        border: 'border-slate-200 dark:border-slate-800',
        badge: 'Record Voided',
        badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
  }
}

export const UndoActionModal: React.FC<UndoActionModalProps> = ({
  isOpen,
  onClose,
  log,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<UndoPreviewData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !log) {
      setPreview(null);
      setFetchError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setFetchError(null);

    api
      .getAuditLogUndoPreview(log.id)
      .then((res: any) => {
        if (!isMounted) return;
        // Handle both raw unwrapped UndoPreviewData and { success, data } envelopes
        const previewData: UndoPreviewData = (res && (res.hierarchy_tree !== undefined || res.action !== undefined))
          ? res
          : (res?.data ?? res);

        if (previewData && (previewData.hierarchy_tree !== undefined || previewData.action !== undefined)) {
          setPreview(previewData);
        } else {
          setFetchError('Unable to generate undo preview');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setFetchError(err.message || 'Failed to fetch undo preview');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, log]);

  if (!isOpen || !log) return null;

  const handleConfirmUndo = async () => {
    if (!preview || preview.blocked || submitting) return;

    try {
      setSubmitting(true);
      const res: any = await api.executeAuditLogUndo(log.id);
      if (res?.success || res?.is_reverted) {
        toast.success(res?.message || 'Action reverted successfully');
        onSuccess();
        onClose();
      } else {
        toast.error('Could not revert action', { description: res?.message });
      }
    } catch (err: any) {
      toast.error('Reversal failed', { description: err.message || 'An error occurred during rollback.' });
    } finally {
      setSubmitting(false);
    }
  };

  const hierarchy = preview?.hierarchy_tree;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-xs animate-backdrop-enter"
        onClick={!submitting ? onClose : undefined}
      />

      {/* Modal Dialog Box */}
      <div className="relative z-10 bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-100 dark:border-slate-800 shadow-2xl ring-1 ring-black/5 max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col p-5 sm:p-6 space-y-4 animate-bottom-sheet sm:animate-modal-enter my-0 sm:my-auto">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Undo2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base leading-none">
                  Undo Business Action
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-200/60 dark:border-slate-700/60">
                  24h Window
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Hierarchical cascade and relative ledger reversal preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 pr-1 space-y-4 text-xs">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Analyzing Reversal Cascade...
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Inspecting downstream sales, debt payments, and ledger balances
                </p>
              </div>
            </div>
          ) : fetchError ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-400 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Cannot Load Reversal Details</div>
                <div className="text-[11px] text-rose-600/90 dark:text-rose-400/90 mt-1">
                  {fetchError}
                </div>
              </div>
            </div>
          ) : preview ? (
            <div className="space-y-3.5">
              {/* Level 1: Current State (Where We Are Now) */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Step 1 · Current State (Where We Are Now)
                  </span>
                  {hierarchy?.current_state?.badge && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                      {hierarchy.current_state.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-3 pt-0.5">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {hierarchy?.current_state?.title || log.action}
                    </h4>
                    {hierarchy?.current_state?.subtitle && (
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                        {hierarchy.current_state.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-slate-400" />
                    <span>Recorded by: <strong className="text-slate-700 dark:text-slate-300">{hierarchy?.current_state?.actor || log.user?.name || 'Staff'}</strong></span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{hierarchy?.current_state?.timestamp || preview.performed_at}</span>
                  </span>
                </div>
              </div>

              {/* Vertical Reversal Flow Indicator */}
              <div className="flex flex-col items-center justify-center my-0.5">
                <div className="w-0.5 h-3 bg-slate-300 dark:bg-slate-700" />
                <div className="px-2.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1 shadow-xs my-0.5">
                  <ArrowDown className="w-3 h-3" />
                  <span>Reversal Impact Cascade</span>
                </div>
                <div className="w-0.5 h-3 bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Level 2: Reversal Actions & Affected Subsystems */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131926] p-3.5 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Step 2 · Subsystems Affected & What Gets Reverted
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {hierarchy?.impact_nodes?.length ?? preview.impact_summary.length} actions
                  </span>
                </div>

                {hierarchy?.impact_nodes && hierarchy.impact_nodes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {hierarchy.impact_nodes.map((node) => {
                      const cfg = getNodeCategoryConfig(node.category, node.direction);
                      const IconComponent = cfg.icon;

                      return (
                        <div
                          key={node.id}
                          className={`p-2.5 rounded-xl border ${cfg.border} ${cfg.bg} flex items-start justify-between gap-3 transition-colors`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 border ${cfg.border}`}>
                              <IconComponent className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                {node.title}
                              </div>
                              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                                {node.reversal}
                              </div>
                              {node.detail && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                                  {node.detail}
                                </div>
                              )}
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight whitespace-nowrap shrink-0 ${cfg.badgeColor}`}>
                            {cfg.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="space-y-1.5 pl-1">
                    {preview.impact_summary.map((summaryItem, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="text-amber-500 font-bold shrink-0">•</span>
                        <span>{summaryItem}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Vertical Resulting State Connector */}
              <div className="flex flex-col items-center justify-center my-0.5">
                <div className="w-0.5 h-3 bg-slate-300 dark:bg-slate-700" />
                <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 shadow-xs my-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Target Restored State</span>
                </div>
                <div className="w-0.5 h-3 bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Level 3: Resulting State Node */}
              <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Step 3 · Resulting System State
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {hierarchy?.resulting_state?.title || 'Ledger & Stock State Restored'}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {hierarchy?.resulting_state?.summary ||
                    'All affected cash and inventory balances will be restored to their state immediately before this transaction occurred.'}
                </p>
              </div>

              {/* Blocked or Warning Notice */}
              {preview.blocked ? (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Undo is Blocked by Subsequent Activity</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
                    This action cannot be automatically reversed because dependent operations occurred afterwards:
                  </p>
                  <ul className="space-y-1 pl-1">
                    {preview.blocked_reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px] text-rose-800 dark:text-rose-200 font-medium">
                        <span className="text-rose-500 font-bold shrink-0">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-rose-600/90 dark:text-rose-400/90 pt-1 border-t border-rose-200/60 dark:border-rose-900/40">
                    Manual adjustment via credit notes or journal settlements is required.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="font-bold">Permanent Operation: </strong>
                    {preview.warning || 'This will permanently reverse the ledger balances and inventory units. An immutable undo event will be appended to the audit trail.'}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Action Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmUndo}
            disabled={loading || !preview || preview.blocked || submitting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reversing Action...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm &amp; Undo Action</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
