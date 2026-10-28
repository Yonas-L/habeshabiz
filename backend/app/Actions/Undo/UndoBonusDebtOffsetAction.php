<?php

namespace App\Actions\Undo;

use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoBonusDebtOffsetAction implements UndoActionInterface
{
    public function preview(AuditLog $log): array
    {
        $newValues = is_array($log->new_values) ? $log->new_values : [];
        $bonusPaymentIds = $newValues['bonus_payment_ids'] ?? [];
        $receivablePaymentId = $newValues['receivable_payment_id'] ?? null;
        $amount = (float) ($newValues['amount'] ?? 0);
        $staffName = $newValues['staff_name'] ?? 'Staff Member';
        $contactName = $newValues['receivable_contact_name'] ?? 'Customer';

        // Check if payments exist
        $bonusPayments = DebtPayment::where('tenant_id', $log->tenant_id)
            ->whereIn('id', $bonusPaymentIds)
            ->get();

        $receivablePayment = $receivablePaymentId
            ? DebtPayment::where('tenant_id', $log->tenant_id)->find($receivablePaymentId)
            : null;

        if ($bonusPayments->isEmpty() && ! $receivablePayment) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The offset payment records were not found or have already been reversed.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $impactSummary = [
            "Sales commission bonus obligation for {$staffName} will reopen by +".number_format($amount, 2).' ETB',
            "Receivable debt obligation for {$contactName} will reopen by +".number_format($amount, 2).' ETB',
            'No cash accounts are affected (direct non-cash mutual credit offset)',
        ];

        $impactNodes = [
            [
                'id' => "bonus-reopen-{$log->id}",
                'category' => 'bonus',
                'title' => "Staff Bonus ({$staffName})",
                'reversal' => '+'.number_format($amount, 2).' ETB Reopened',
                'detail' => 'Commission payable restored to open state',
                'direction' => 'in',
            ],
            [
                'id' => "rec-reopen-{$log->id}",
                'category' => 'debt',
                'title' => "Receivable Debt ({$contactName})",
                'reversal' => '+'.number_format($amount, 2).' ETB Reopened',
                'detail' => 'Customer/partner debt balance restored',
                'direction' => 'out',
            ],
        ];

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $actor = $log->user instanceof User ? $log->user->name : ($newValues['paid_by'] ?? 'Owner');

        return [
            'action' => $log->action,
            'entity_type' => 'DebtPayment',
            'entity_id' => $log->entity_id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => true,
            'blocked' => false,
            'blocked_reasons' => [],
            'warning' => 'Both the salesperson bonus payable and the receivable debt obligation will be restored to their prior open balances.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Bonus Offset: {$staffName} → {$contactName}",
                    'badge' => 'SETTLED VIA BONUS',
                    'subtitle' => 'Amount: '.number_format($amount, 2).' ETB',
                    'timestamp' => $performedAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Bonus Offset Reopened',
                    'summary' => "Commission bonus (+{$amount} ETB) and receivable debt (+{$amount} ETB) are reopened simultaneously.",
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $newValues = is_array($log->new_values) ? $log->new_values : [];
            $bonusPaymentIds = $newValues['bonus_payment_ids'] ?? [];
            $receivablePaymentId = $newValues['receivable_payment_id'] ?? null;
            $amount = (float) ($newValues['amount'] ?? 0);

            // Revert bonus payments
            $bonusPayments = DebtPayment::where('tenant_id', $log->tenant_id)
                ->whereIn('id', $bonusPaymentIds)
                ->get();

            foreach ($bonusPayments as $bp) {
                $bDebt = Debt::where('tenant_id', $log->tenant_id)->find($bp->debt_id);
                if ($bDebt) {
                    $newPaid = max(0, (float) $bDebt->paid_amount - (float) $bp->amount);
                    $newRem = min((float) $bDebt->original_amount, (float) $bDebt->remaining_amount + (float) $bp->amount);
                    $newStatus = $newPaid <= 0.001 ? 'open' : 'partially_paid';

                    $bDebt->update([
                        'paid_amount' => $newPaid,
                        'remaining_amount' => $newRem,
                        'status' => $newStatus,
                    ]);
                }
                $bp->delete();
            }

            // Revert receivable payment
            if ($receivablePaymentId) {
                $recPayment = DebtPayment::where('tenant_id', $log->tenant_id)->find($receivablePaymentId);
                if ($recPayment) {
                    $recDebt = Debt::where('tenant_id', $log->tenant_id)->find($recPayment->debt_id);
                    if ($recDebt) {
                        $newRecPaid = max(0, (float) $recDebt->paid_amount - (float) $recPayment->amount);
                        $newRecRem = min((float) $recDebt->original_amount, (float) $recDebt->remaining_amount + (float) $recPayment->amount);
                        $newRecStatus = $newRecPaid <= 0.001 ? 'open' : 'partially_paid';

                        $recDebt->update([
                            'paid_amount' => $newRecPaid,
                            'remaining_amount' => $newRecRem,
                            'status' => $newRecStatus,
                        ]);

                        if ($recDebt->reference_type === 'sales_order') {
                            $recDebt->syncLinkedSalesOrder();
                        }
                    }
                    $recPayment->delete();
                }
            }

            // Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'DebtPayment',
                entityId: (string) $log->entity_id,
                newValues: [
                    'original_action' => $log->action,
                    'amount' => $amount,
                    'staff_name' => $newValues['staff_name'] ?? 'Staff',
                    'receivable_debt_id' => $newValues['receivable_debt_id'] ?? null,
                    'receivable_contact_name' => $newValues['receivable_contact_name'] ?? null,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id()
            );

            return 'Bonus offset of '.number_format($amount, 2).' ETB was successfully reversed and both obligations were reopened.';
        });
    }
}
