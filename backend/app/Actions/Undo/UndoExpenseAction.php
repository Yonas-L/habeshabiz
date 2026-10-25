<?php

namespace App\Actions\Undo;

use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\MaintenanceRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoExpenseAction implements UndoActionInterface
{
    public function __construct(
        protected UndoBlockedChecker $checker = new UndoBlockedChecker
    ) {}

    public function preview(AuditLog $log): array
    {
        $expense = Expense::with('financialAccount')->find($log->entity_id);

        if (! $expense) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The expense record was not found or has already been removed.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $blockedReasons = $this->checker->checkExpense((string) $expense->id);
        $isBlocked = count($blockedReasons) > 0;

        /** @var FinancialAccount|null $finAccount */
        $finAccount = $expense->financialAccount;
        $accName = $finAccount ? $finAccount->name : 'Bank Account';
        $amount = (float) $expense->amount;

        $impactSummary = [
            "Account '{$accName}' balance will increase by +{$amount} ETB (expense refund)",
            "Expense record '{$expense->description}' ({$expense->category}) will be deleted from ledger",
        ];

        $impactNodes = [
            [
                'id' => "acc-exp-{$expense->id}",
                'category' => 'financial',
                'title' => $accName,
                'reversal' => "+{$amount} ETB Refund",
                'detail' => 'Restores spent funds',
                'direction' => 'in',
            ],
            [
                'id' => "doc-exp-{$expense->id}",
                'category' => 'document',
                'title' => "Expense: {$expense->category}",
                'reversal' => 'Deleted from records',
                'detail' => $expense->description,
                'direction' => 'neutral',
            ],
        ];

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $expenseDate = $expense->date ? Carbon::parse($expense->date)->format('M d, Y h:i A') : 'Unknown';
        $actor = $log->user instanceof User ? $log->user->name : 'Staff';

        return [
            'action' => $log->action,
            'entity_type' => 'Expense',
            'entity_id' => $expense->id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => 'This expense will be permanently deleted and the cash balance restored.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Expense: {$expense->description}",
                    'badge' => strtoupper($expense->category),
                    'subtitle' => "Amount: {$amount} ETB · {$accName}",
                    'timestamp' => $expenseDate,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Expense Cancelled',
                    'summary' => 'Cash is restored to the account and operating expense is wiped from reports.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $expense = Expense::where('tenant_id', $log->tenant_id)->find($log->entity_id);

            if (! $expense) {
                throw new UndoBlockedException('The expense record was not found.');
            }

            $blockedReasons = $this->checker->checkExpense((string) $expense->id);
            if (count($blockedReasons) > 0) {
                throw new UndoBlockedException('Cannot undo this expense.', $blockedReasons);
            }

            $amount = (float) $expense->amount;
            $accountId = $expense->financial_account_id;
            $desc = $expense->description;

            // 1. Refund account via relative delta with lock
            if ($accountId && $amount > 0) {
                $acc = FinancialAccount::where('id', $accountId)->lockForUpdate()->first();
                if ($acc) {
                    $acc->increment('current_balance', $amount);
                }
            }

            $logCreatedAt = Carbon::parse($log->created_at);

            // 2. Delete linked financial transaction
            FinancialTransaction::where('tenant_id', $expense->tenant_id)
                ->where('type', 'expense')
                ->where('source_account_id', $accountId)
                ->whereBetween('created_at', [$logCreatedAt->copy()->subSeconds(5), $logCreatedAt->copy()->addSeconds(5)])
                ->delete();

            // 3. Delete maintenance record if tied to expense
            MaintenanceRecord::where('tenant_id', $expense->tenant_id)
                ->where('financial_account_id', $accountId)
                ->where('cost', $amount)
                ->whereBetween('created_at', [$logCreatedAt->copy()->subSeconds(5), $logCreatedAt->copy()->addSeconds(5)])
                ->delete();

            // 4. Delete expense
            $expense->delete();

            // 5. Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // 6. Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'Expense',
                entityId: (string) $log->entity_id,
                newValues: [
                    'original_action' => 'expense_created',
                    'refunded_amount' => $amount,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Expense of {$amount} ETB ({$desc}) has been reversed and the account balance refunded.";
        });
    }
}
