import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ProformaInvoice, User, Tenant } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { toast } from 'sonner';
import {
  Download,
  Printer,
  Copy,
  Edit,
  Trash2,
  CreditCard,
  Loader2,
  Check,
} from 'lucide-react';

interface ProformaInvoiceDetailDrawerProps {
  proforma: ProformaInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (proforma: ProformaInvoice) => void;
  onDuplicate: (proforma: ProformaInvoice) => void;
  onDeleted: (proformaId: string) => void;
  onStatusUpdated: (updated: ProformaInvoice) => void;
  user?: User | null;
  tenant?: Tenant | null;
}

export const ProformaInvoiceDetailDrawer: React.FC<ProformaInvoiceDetailDrawerProps> = ({
  proforma: initialProforma,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onDeleted,
  onStatusUpdated,
}) => {
  const [proforma, setProforma] = useState<ProformaInvoice | null>(initialProforma);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);

  useEffect(() => {
    setProforma(initialProforma);
  }, [initialProforma]);

  if (!proforma) return null;

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(proforma.proforma_number);
    setCopiedNumber(true);
    toast.success(`Copied #${proforma.proforma_number}`);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!proforma?.id) return;
    setIsDownloadingPdf(true);
    try {
      const blob = await api.downloadProformaPdf(proforma.id, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Proforma_${proforma.proforma_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Proforma PDF downloaded');
    } catch (err: any) {
      toast.error('Download failed', { description: err.message || 'Could not generate PDF.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = async () => {
    if (!proforma?.id) return;
    try {
      const blob = await api.downloadProformaPdf(proforma.id, false);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.focus();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        toast.error('Please allow popups to open document for printing.');
      }
    } catch {
      const fallbackUrl = api.getProformaPdfUrl(proforma.id, false);
      const win = window.open(fallbackUrl, '_blank');
      if (!win) {
        toast.error('Please allow popups to open document for printing.');
      }
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!proforma?.id || newStatus === proforma.status) return;
    setIsUpdatingStatus(true);
    try {
      const res = await api.updateProformaInvoiceStatus(proforma.id, newStatus);
      const updated = (res as any).data || res;
      setProforma(updated);
      onStatusUpdated(updated);
      toast.success(`Status changed to ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      toast.error('Failed to change status', { description: err.message });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const confirmDelete = async () => {
    if (!proforma?.id) return;
    setIsDeleting(true);
    try {
      await api.deleteProformaInvoice(proforma.id);
      toast.success(`Proforma #${proforma.proforma_number} deleted.`);
      setShowDeleteModal(false);
      onDeleted(proforma.id);
      onClose();
    } catch (err: any) {
      toast.error('Failed to delete proforma', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const currency = proforma.currency || 'ETB';
  const subtotal = Number(proforma.subtotal) || 0;
  const discountTotal = Number(proforma.discount_total) || 0;
  const taxableAmount = Number(proforma.taxable_amount) || 0;
  const vatTotal = Number(proforma.vat_total) || 0;
  const withholdingTotal = Number(proforma.withholding_total) || 0;
  const shippingFee = Number(proforma.shipping_fee) || 0;
  const totalAmount = Number(proforma.total_amount) || 0;
  const netPayable = Number(proforma.net_payable) || 0;

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    expired: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    converted_to_sale: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  };

  return (
    <>
      <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Performa #${proforma.proforma_number}`}
      subtitle={`Issued on ${proforma.issue_date}${proforma.valid_until ? ` · Valid until ${proforma.valid_until}` : ''}`}
      badge={
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${statusColors[proforma.status] || statusColors.draft}`}>
          {proforma.status.replace('_', ' ')}
        </span>
      }
      headerActions={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyNumber}
            title="Copy Number"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {copiedNumber ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            title="Print Document"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            title="Download PDF"
            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors"
          >
            {isDownloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
        </div>
      }
      footerActions={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onDuplicate(proforma);
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onEdit(proforma);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Document</span>
            </button>
          </div>
        </div>
      }
      widthClass="sm:max-w-2xl"
    >
      <div className="space-y-6">
        {/* Status Quick Switcher Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Document Status</span>
          <select
            value={proforma.status}
            disabled={isUpdatingStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs capitalize text-slate-800 dark:text-white"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent to Client</option>
            <option value="accepted">Accepted / Approved</option>
            <option value="expired">Expired</option>
            <option value="converted_to_sale">Converted to Sale</option>
          </select>
        </div>

        {/* Customer & Document Information Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Customer */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Recipient Information
            </span>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {proforma.customer_name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              {proforma.customer_address && <div>{proforma.customer_address}</div>}
              {proforma.customer_phone && <div>Tel: {proforma.customer_phone}</div>}
              {proforma.customer_email && <div>Email: {proforma.customer_email}</div>}
              {proforma.customer_tin && (
                <div className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  TIN: {proforma.customer_tin}
                </div>
              )}
            </div>
          </div>

          {/* Document Meta */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Quotation Parameters
            </span>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div>
                <span className="text-slate-400">Issue Date:</span>{' '}
                <span className="font-semibold">{proforma.issue_date}</span>
              </div>
              <div>
                <span className="text-slate-400">Valid Until:</span>{' '}
                <span className="font-semibold">{proforma.valid_until || 'Not specified'}</span>
              </div>
              {proforma.reference_number && (
                <div>
                  <span className="text-slate-400">Ref / RFQ #:</span>{' '}
                  <span className="font-mono font-semibold">{proforma.reference_number}</span>
                </div>
              )}
              {proforma.prepared_by && (
                <div>
                  <span className="text-slate-400">Prepared By:</span>{' '}
                  <span className="font-semibold">{proforma.prepared_by}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bank Remittance Instructions */}
        {proforma.bank_account && (
          <div className="p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Remittance Bank Details</span>
            </div>
            <div className="flex justify-between items-center text-slate-800 dark:text-slate-200 font-semibold">
              <span>{proforma.bank_account.name}</span>
              <span className="font-mono">{proforma.bank_account.account_number}</span>
            </div>
          </div>
        )}

        {/* Line Items Table */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Itemized Specifications ({proforma.items?.length || 0})
          </span>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[460px] text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold text-[11px]">
                  <th className="py-2.5 px-3 w-8 text-center">#</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-2 text-center w-16">UoM</th>
                  <th className="py-2.5 px-2 text-right w-14">Qty</th>
                  <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                  <th className="py-2.5 px-3 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {proforma.items?.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {item.item_number || idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{item.description}</div>
                      {item.sku && <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500">
                      {item.unit_of_measure || 'Pcs'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      {Number(item.quantity)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Settlement Breakdown Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
            Financial Settlement Breakdown
          </span>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Gross Subtotal</span>
              <span className="font-mono">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>Discounts Applied</span>
                <span className="font-mono">- {discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            )}

            <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 border-t border-slate-200/80 dark:border-slate-800 pt-1.5">
              <span>Taxable Base Amount</span>
              <span className="font-mono">{taxableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
            </div>

            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>VAT Amount ({Number(proforma.vat_rate) || 15}%)</span>
              <span className="font-mono">+ {vatTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
            </div>

            {shippingFee > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Shipping & Handling</span>
                <span className="font-mono">+ {shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-2 text-sm">
              <span>Gross Total (Inc. VAT)</span>
              <span className="font-mono">{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
            </div>

            {withholdingTotal > 0 && (
              <div className="flex justify-between text-rose-700 dark:text-rose-400 font-semibold pt-1">
                <span>Less: WHT ({Number(proforma.withholding_rate)}% Withholding Tax)</span>
                <span className="font-mono">- {withholdingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-slate-900 dark:text-white font-extrabold text-base border-t-2 border-slate-900 dark:border-white pt-2.5 mt-2">
              <span>Net Amount Payable</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {netPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </span>
            </div>
          </div>
        </div>

        {/* Commercial Terms & Notes */}
        {(proforma.payment_terms || proforma.delivery_terms || proforma.notes) && (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Commercial Terms & Notes
            </span>
            {proforma.payment_terms && (
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Payment Terms: </span>
                <span className="text-slate-600 dark:text-slate-400">{proforma.payment_terms}</span>
              </div>
            )}
            {proforma.delivery_terms && (
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Delivery Terms: </span>
                <span className="text-slate-600 dark:text-slate-400">{proforma.delivery_terms}</span>
              </div>
            )}
            {proforma.notes && (
              <div className="pt-1 whitespace-pre-line text-slate-600 dark:text-slate-400">
                {proforma.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </SlideOverDrawer>

    {showDeleteModal && createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        />
        <div className="relative w-full max-w-sm bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 animate-in zoom-in-95 duration-150">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/60 dark:border-rose-900/40">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Proforma Invoice?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to delete quotation <span className="font-mono font-bold text-slate-900 dark:text-white">#{proforma.proforma_number}</span> for <span className="font-semibold text-slate-800 dark:text-slate-200">{proforma.customer_name}</span>?
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between items-center font-mono">
            <span>Total Value:</span>
            <span className="font-bold text-slate-900 dark:text-white text-xs">
              {Number(proforma.net_payable || proforma.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setShowDeleteModal(false)}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={confirmDelete}
              className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete Invoice</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};
