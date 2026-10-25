<?php

namespace App\Actions\Undo;

use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\ProformaInvoice;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoProformaInvoiceAction implements UndoActionInterface
{
    public function __construct(
        protected UndoBlockedChecker $checker = new UndoBlockedChecker
    ) {}

    public function preview(AuditLog $log): array
    {
        $proforma = ProformaInvoice::with(['customer', 'items'])->find($log->entity_id);

        if (! $proforma) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The proforma invoice record was not found or was already removed.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $blockedReasons = $this->checker->checkProformaInvoice($proforma);
        $isBlocked = count($blockedReasons) > 0;

        /** @var Contact|null $customer */
        $customer = $proforma->customer;
        $cName = $customer ? $customer->name : 'Customer';
        $itemCount = $proforma->items->count();

        $impactSummary = [
            "Proforma Invoice #{$proforma->proforma_number} ({$proforma->total_amount} ETB) will be permanently deleted",
            "{$itemCount} quote line item(s) will be cleared",
            'No inventory or financial account balances are affected',
        ];

        $impactNodes = [
            [
                'id' => "doc-proforma-{$proforma->id}",
                'category' => 'document',
                'title' => "Proforma #{$proforma->proforma_number}",
                'reversal' => 'Quote deleted',
                'detail' => "Customer: {$cName} · Total: {$proforma->total_amount} ETB",
                'direction' => 'neutral',
            ],
        ];

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $actor = $log->user ? $log->user->name : 'Staff';
        $profCreatedAt = $proforma->created_at ? Carbon::parse($proforma->created_at)->format('M d, Y h:i A') : 'Unknown';

        return [
            'action' => $log->action,
            'entity_type' => 'ProformaInvoice',
            'entity_id' => $proforma->id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => 'This proforma quotation will be permanently deleted.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Proforma #{$proforma->proforma_number}",
                    'badge' => strtoupper($proforma->status ?? 'DRAFT'),
                    'subtitle' => "Total: {$proforma->total_amount} ETB · {$cName}",
                    'timestamp' => $profCreatedAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Quotation Deleted',
                    'summary' => 'The proforma record has been safely removed.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $proforma = ProformaInvoice::where('tenant_id', $log->tenant_id)->find($log->entity_id);

            if (! $proforma) {
                throw new UndoBlockedException('The proforma invoice was not found.');
            }

            $blockedReasons = $this->checker->checkProformaInvoice($proforma);
            if (count($blockedReasons) > 0) {
                throw new UndoBlockedException('Cannot undo this proforma invoice.', $blockedReasons);
            }

            $num = $proforma->proforma_number;

            // Delete items and invoice
            $proforma->items()->delete();
            $proforma->delete();

            // Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'ProformaInvoice',
                entityId: (string) $log->entity_id,
                newValues: [
                    'original_action' => 'proforma_invoice_created',
                    'proforma_number' => $num,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Proforma invoice #{$num} has been deleted.";
        });
    }
}
