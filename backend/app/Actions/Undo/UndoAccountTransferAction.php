<?php

namespace App\Actions\Undo;

use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoAccountTransferAction implements UndoActionInterface
{
    public function preview(AuditLog $log): array
    {
        $txn = FinancialTransaction::with(['sourceAccount', 'destinationAccount'])->find($log->entity_id);

        if (! $txn) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The transfer transaction record was not found.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        /** @var FinancialAccount|null $sourceAccount */
        $sourceAccount = $txn->sourceAccount;
        /** @var FinancialAccount|null $destAccount */
        $destAccount = $txn->destinationAccount;

        $amount = (float) $txn->amount;
        $fee = (float) $txn->fee;
        $fromName = $sourceAccount ? $sourceAccount->name : 'Source Account';
        $toName = $destAccount ? $destAccount->name : 'Destination Account';

        $impactSummary = [
            "Source account '{$fromName}' will be refunded +".($amount + $fee).' ETB (transfer + fee)',
            "Destination account '{$toName}' balance will decrease by -{$amount} ETB",
            'Transfer transaction record will be deleted',
        ];

        $impactNodes = [
            [
                'id' => "acc-transfer-from-{$txn->id}",
                'category' => 'financial',
                'title' => $fromName,
                'reversal' => '+'.($amount + $fee).' ETB Refund',
                'detail' => 'Restores transferred funds',
                'direction' => 'in',
            ],
            [
                'id' => "acc-transfer-to-{$txn->id}",
                'category' => 'financial',
                'title' => $toName,
                'reversal' => "-{$amount} ETB",
                'detail' => 'Withdraws received transfer',
                'direction' => 'out',
            ],
        ];

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $txDate = $txn->date ? Carbon::parse($txn->date)->format('M d, Y h:i A') : 'Unknown';
        $actor = $log->user instanceof User ? $log->user->name : 'Staff';

        return [
            'action' => $log->action,
            'entity_type' => 'FinancialTransaction',
            'entity_id' => $txn->id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => true,
            'blocked' => false,
            'blocked_reasons' => [],
            'warning' => 'This transfer will be reversed between both financial accounts.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => 'Account Transfer',
                    'badge' => 'TRANSFERRED',
                    'subtitle' => "From {$fromName} to {$toName}",
                    'timestamp' => $txDate,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Transfer Reversed',
                    'summary' => 'Funds are returned to source account and deducted from destination account.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $txn = FinancialTransaction::where('tenant_id', $log->tenant_id)->find($log->entity_id);

            if (! $txn) {
                throw new UndoBlockedException('The transfer transaction was not found.');
            }

            $amount = (float) $txn->amount;
            $fee = (float) $txn->fee;
            $sourceId = $txn->source_account_id;
            $destId = $txn->destination_account_id;

            // 1. Lock and update balances via relative deltas
            $accounts = FinancialAccount::whereIn('id', array_filter([$sourceId, $destId]))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($sourceId && isset($accounts[$sourceId])) {
                $accounts[$sourceId]->increment('current_balance', $amount + $fee);
            }

            if ($destId && isset($accounts[$destId])) {
                $accounts[$destId]->decrement('current_balance', $amount);
            }

            // 2. Delete the transaction
            $txn->delete();

            // 3. Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // 4. Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'FinancialTransaction',
                entityId: (string) $log->entity_id,
                newValues: [
                    'original_action' => 'account_transfer',
                    'reversed_amount' => $amount,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Transfer of {$amount} ETB has been reversed. Funds were restored to the source account.";
        });
    }
}
