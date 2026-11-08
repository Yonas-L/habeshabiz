<?php

namespace App\Actions\Undo;

use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoManualDebtAction implements UndoActionInterface
{
    public function preview(AuditLog $log): array
    {
        $debt = Debt::with(['contact', 'payments'])->find($log->entity_id);

        if (! $debt) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The manual debt record was not found or has already been removed.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $blockedReasons = [];

        // Check if subsequent debt payments were made
        $threshold = Carbon::parse($log->created_at)->addSeconds(5);
        $newerPayments = DebtPayment::where('debt_id', $debt->id)
            ->where('created_at', '>', $threshold)
            ->get();

        if ($newerPayments->isNotEmpty()) {
            $paidTotal = (float) $newerPayments->sum('amount');
            $blockedReasons[] = 'Subsequent payments of '.number_format($paidTotal, 2).' ETB were recorded against this debt. Undo those payment settlements first.';
        }

        // Check linked transactions and balances
        $txs = FinancialTransaction::where('reference_number', "DEBT-{$debt->id}")->get();
        foreach ($txs as $tx) {
            if ($tx->destination_account_id) {
                $acc = FinancialAccount::find($tx->destination_account_id);
                if ($acc && (float) $acc->current_balance < (float) $tx->amount) {
                    $accName = $acc->name;
                    $avail = number_format((float) $acc->current_balance, 2);
                    $req = number_format((float) $tx->amount, 2);
                    $blockedReasons[] = "Insufficient balance in account '{$accName}' to reverse received funds. Available: {$avail} ETB, Required: {$req} ETB.";
                }
            }
        }

        $isBlocked = count($blockedReasons) > 0;
        $contactName = $debt->contact?->name ?? 'Contact';
        $amount = (float) $debt->original_amount;
        $type = $debt->type; // receivable or payable

        $impactSummary = [
            "Manual {$type} obligation of ".number_format($amount, 2)." ETB for {$contactName} will be cancelled",
        ];

        $impactNodes = [
            [
                'id' => "debt-cancel-{$debt->id}",
                'category' => 'debt',
                'title' => "Debt: {$contactName}",
                'reversal' => 'Cancelled obligation',
                'detail' => ucfirst($type).' of '.number_format($amount, 2).' ETB removed',
                'direction' => 'neutral',
            ],
        ];

        // Cash flow impact nodes
        foreach ($txs as $tx) {
            if ($tx->source_account_id) {
                $acc = FinancialAccount::find($tx->source_account_id);
                $accName = $acc ? $acc->name : 'Financial Account';
                $refundTotal = (float) $tx->amount + (float) $tx->fee;
                $impactSummary[] = "Account '{$accName}' balance will be refunded by +".number_format($refundTotal, 2).' ETB';
                $impactNodes[] = [
                    'id' => "acc-refund-{$tx->id}",
                    'category' => 'financial',
                    'title' => $accName,
                    'reversal' => '+'.number_format($refundTotal, 2).' ETB Refund',
                    'detail' => 'Reverses disbursed loan payout',
                    'direction' => 'in',
                ];
            } elseif ($tx->destination_account_id) {
                $acc = FinancialAccount::find($tx->destination_account_id);
                $accName = $acc ? $acc->name : 'Financial Account';
                $impactSummary[] = "Account '{$accName}' balance will be debited by -".number_format((float) $tx->amount, 2).' ETB';
                $impactNodes[] = [
                    'id' => "acc-debit-{$tx->id}",
                    'category' => 'financial',
                    'title' => $accName,
                    'reversal' => '-'.number_format((float) $tx->amount, 2).' ETB Debit',
                    'detail' => 'Reverses received borrowed cash',
                    'direction' => 'out',
                ];
            }
        }

        // Mutual offset impact
        $offsetPayments = DebtPayment::where('reference_number', "OFFSET-{$debt->id}")->get();
        foreach ($offsetPayments as $op) {
            $otherDebt = Debt::with('contact')->find($op->debt_id);
            $otherContact = $otherDebt?->contact?->name ?? 'Partner';
            $opAmount = (float) $op->amount;
            $impactSummary[] = "Offset obligation of {$otherContact} will reopen by +".number_format($opAmount, 2).' ETB';
            $impactNodes[] = [
                'id' => "offset-reopen-{$op->id}",
                'category' => 'debt',
                'title' => "Reopen: {$otherContact}",
                'reversal' => '+'.number_format($opAmount, 2).' ETB Reopened',
                'detail' => 'Reverts mutual credit offset',
                'direction' => 'out',
            ];
        }

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $actor = $log->user instanceof User ? $log->user->name : 'Owner';

        return [
            'action' => $log->action,
            'entity_type' => 'Debt',
            'entity_id' => $debt->id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => "This will permanently cancel this manual {$type} debt of ".number_format($amount, 2)." ETB and restore financial accounts.",
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Manual {$type}: {$contactName}",
                    'badge' => strtoupper($type),
                    'subtitle' => number_format($amount, 2)." ETB · Status: {$debt->status}",
                    'timestamp' => $performedAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Debt Cancelled',
                    'summary' => "The {$type} record is cancelled and account balances are restored.",
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $debt = Debt::where('tenant_id', $log->tenant_id)->find($log->entity_id);

            if (! $debt) {
                throw new UndoBlockedException('The manual debt record was not found.');
            }

            // Check if newer payments exist
            $threshold = Carbon::parse($log->created_at)->addSeconds(5);
            $newerPayments = DebtPayment::where('debt_id', $debt->id)
                ->where('created_at', '>', $threshold)
                ->get();

            if ($newerPayments->isNotEmpty()) {
                throw new UndoBlockedException('Cannot undo manual debt: payments have already been settled against it. Undo those payments first.');
            }

            // 1. Revert financial transactions and refund/debit accounts
            $txs = FinancialTransaction::where('reference_number', "DEBT-{$debt->id}")->get();
            foreach ($txs as $tx) {
                if ($tx->source_account_id) {
                    $acc = FinancialAccount::find($tx->source_account_id);
                    if ($acc) {
                        $refundTotal = (float) $tx->amount + (float) $tx->fee;
                        $acc->increment('current_balance', $refundTotal);
                    }
                } elseif ($tx->destination_account_id) {
                    $acc = FinancialAccount::find($tx->destination_account_id);
                    if ($acc) {
                        if ((float) $acc->current_balance < (float) $tx->amount) {
                            throw new UndoBlockedException("Insufficient balance in account '{$acc->name}' to reverse received funds.");
                        }
                        $acc->decrement('current_balance', (float) $tx->amount);
                    }
                }
                $tx->delete();
            }

            // 2. Revert any mutual credit offsets
            $offsetPayments = DebtPayment::where('reference_number', "OFFSET-{$debt->id}")->get();
            foreach ($offsetPayments as $op) {
                $otherDebt = Debt::find($op->debt_id);
                if ($otherDebt) {
                    $newPaid = max(0, (float) $otherDebt->paid_amount - (float) $op->amount);
                    $newRemaining = max(0, (float) $otherDebt->original_amount - $newPaid);
                    $newStatus = $newRemaining <= 0 ? 'settled' : ($newPaid > 0 ? 'partially_paid' : 'open');
                    $otherDebt->update([
                        'paid_amount' => $newPaid,
                        'remaining_amount' => $newRemaining,
                        'status' => $newStatus,
                    ]);
                }
                $op->delete();
            }

            // 3. Delete payments directly attached to this debt
            DebtPayment::where('debt_id', $debt->id)->delete();

            $contactName = $debt->contact?->name ?? 'Contact';
            $amount = (float) $debt->original_amount;
            $type = $debt->type;

            // 4. Delete the debt
            $debt->delete();

            // 5. Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // 6. Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'Debt',
                entityId: (string) $debt->id,
                newValues: [
                    'original_action' => 'manual_debt_created',
                    'contact' => $contactName,
                    'amount' => $amount,
                    'type' => $type,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Manual {$type} obligation of ".number_format($amount, 2)." ETB for {$contactName} has been cancelled and account balances restored.";
        });
    }
}
