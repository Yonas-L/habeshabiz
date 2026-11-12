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

class UndoBankMovementAction implements UndoActionInterface
{
    public function preview(AuditLog $log): array
    {
        $txn = FinancialTransaction::with(['sourceAccount', 'destinationAccount'])->find($log->entity_id);

        if (! $txn) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The bank movement transaction record was not found.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $amount = (float) $txn->amount;
        $fee = (float) ($txn->fee ?? 0);

        $isInflow = $txn->destination_account_id !== null && $txn->source_account_id === null;
        $isOutflow = $txn->source_account_id !== null && $txn->destination_account_id === null;

        /** @var FinancialAccount|null $targetAccount */
        $targetAccount = $isInflow ? $txn->destinationAccount : $txn->sourceAccount;
        $accName = $targetAccount ? $targetAccount->name : 'Treasury Account';

        if ($isInflow) {
            $impactSummary = [
                "Account '{$accName}' balance will be deducted by -{$amount} ETB to reverse deposit",
                'Bank movement transaction record will be removed',
            ];
            $impactNodes = [
                [
                    'id' => "bank-movement-{$txn->id}",
                    'category' => 'financial',
                    'title' => $accName,
                    'reversal' => "-{$amount} ETB",
                    'detail' => 'Reverses funds deposit',
                    'direction' => 'out',
                ],
            ];
            $title = 'Balance Deposit';
            $badge = 'DEPOSITED';
        } elseif ($isOutflow) {
            $impactSummary = [
                "Account '{$accName}' balance will be refunded +{$amount} ETB to reverse deduction",
                'Bank movement transaction record will be removed',
            ];
            $impactNodes = [
                [
                    'id' => "bank-movement-{$txn->id}",
                    'category' => 'financial',
                    'title' => $accName,
                    'reversal' => "+{$amount} ETB",
                    'detail' => 'Restores deducted funds',
                    'direction' => 'in',
                ],
            ];
            $title = 'Balance Deduction';
            $badge = 'DEDUCTED';
        } else {
            /** @var FinancialAccount|null $sourceAcc */
            $sourceAcc = $txn->sourceAccount;
            /** @var FinancialAccount|null $destAcc */
            $destAcc = $txn->destinationAccount;
            $fromName = $sourceAcc ? $sourceAcc->name : 'Source Account';
            $toName = $destAcc ? $destAcc->name : 'Destination Account';
            $impactSummary = [
                "Source account '{$fromName}' will be refunded +".($amount + $fee).' ETB (transfer + fee)',
                "Destination account '{$toName}' balance will decrease by -{$amount} ETB",
                'Transfer transaction record will be removed',
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
            $title = 'Account Transfer';
            $badge = 'TRANSFERRED';
        }

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $txDate = $txn->date ? Carbon::parse($txn->date)->format('M d, Y h:i A') : 'Unknown';
        $actor = $log->user instanceof User ? $log->user->name : 'Owner';

        return [
            'action' => $log->action,
            'entity_type' => 'FinancialTransaction',
            'entity_id' => $txn->id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => true,
            'blocked' => false,
            'blocked_reasons' => [],
            'warning' => 'This bank movement will be reversed and account balance will be restored.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => $title,
                    'badge' => $badge,
                    'subtitle' => $accName,
                    'timestamp' => $txDate,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Movement Reversed',
                    'summary' => 'Funds are restored to previous account balances.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $txn = FinancialTransaction::where('tenant_id', $log->tenant_id)->find($log->entity_id);

            if (! $txn) {
                throw new UndoBlockedException('The bank movement transaction was not found.');
            }

            $amount = (float) $txn->amount;
            $fee = (float) ($txn->fee ?? 0);
            $sourceId = $txn->source_account_id;
            $destId = $txn->destination_account_id;

            $accounts = FinancialAccount::whereIn('id', array_filter([$sourceId, $destId]))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $accName = '';

            if ($destId && ! $sourceId) {
                // Deposit / Inflow reversal -> decrement destination account
                if (isset($accounts[$destId])) {
                    $accounts[$destId]->decrement('current_balance', $amount);
                    $accName = $accounts[$destId]->name;
                }
            } elseif ($sourceId && ! $destId) {
                // Deduction / Outflow reversal -> increment source account
                if (isset($accounts[$sourceId])) {
                    $accounts[$sourceId]->increment('current_balance', $amount);
                    $accName = $accounts[$sourceId]->name;
                }
            } elseif ($sourceId && $destId) {
                // Transfer reversal
                if (isset($accounts[$sourceId])) {
                    $accounts[$sourceId]->increment('current_balance', $amount + $fee);
                }
                if (isset($accounts[$destId])) {
                    $accounts[$destId]->decrement('current_balance', $amount);
                }
                $accName = $accounts[$sourceId]->name ?? 'Source';
            }

            // Delete the transaction record
            $txn->delete();

            // Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'FinancialTransaction',
                entityId: (string) $log->entity_id,
                newValues: [
                    'original_action' => $log->action,
                    'reversed_amount' => $amount,
                    'account_name' => $accName,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Bank movement of {$amount} ETB has been reversed. Account balance has been updated.";
        });
    }
}
