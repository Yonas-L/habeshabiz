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

class UndoDebtPaymentAction implements UndoActionInterface
{
    public function preview(AuditLog $log): array
    {
        $newValues = is_array($log->new_values) ? $log->new_values : [];
        $paymentId = $log->entity_id;

        // Find the payment or payments in the split group
        $payments = DebtPayment::where('tenant_id', $log->tenant_id)
            ->where(function ($q) use ($paymentId, $newValues) {
                $q->where('id', $paymentId);
                if (! empty($newValues['split_group_id'])) {
                    $q->orWhere('split_group_id', $newValues['split_group_id']);
                }
            })
            ->get();

        if ($payments->isEmpty()) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The payment record was not found or has already been reversed.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $debtId = $payments->first()->debt_id;
        $debt = Debt::with(['contact', 'salesperson'])->find($debtId);

        if (! $debt) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The associated debt obligation was not found.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $totalAmount = (float) $payments->sum('amount');
        $isPayable = $debt->isPayable();
        $isBonus = $debt->reference_type === 'salesperson_bonus';
        $contactName = $isBonus
            ? ($debt->salesperson?->name ?? $debt->contact?->name ?? 'Staff')
            : ($debt->contact?->name ?? 'Partner/Supplier');

        $impactSummary = [];
        $impactNodes = [];

        // Check accounts
        foreach ($payments as $payment) {
            $acc = FinancialAccount::find($payment->financial_account_id);
            $accName = $acc ? $acc->name : 'Financial Account';
            $amount = (float) $payment->amount;

            if ($isPayable) {
                // Payable payout reversal: money goes BACK into our account
                $impactSummary[] = "Account '{$accName}' balance will be refunded by +".number_format($amount, 2).' ETB';
                $impactNodes[] = [
                    'id' => "acc-payout-{$payment->id}",
                    'category' => 'financial',
                    'title' => $accName,
                    'reversal' => '+'.number_format($amount, 2).' ETB Refund',
                    'detail' => 'Restores disbursed payout',
                    'direction' => 'in',
                ];
            } else {
                // Receivable collection reversal: money is DEDUCTED from our account
                $impactSummary[] = "Account '{$accName}' balance will be debited by -".number_format($amount, 2).' ETB';
                $impactNodes[] = [
                    'id' => "acc-collect-{$payment->id}",
                    'category' => 'financial',
                    'title' => $accName,
                    'reversal' => '-'.number_format($amount, 2).' ETB Debit',
                    'detail' => 'Reverses collected funds',
                    'direction' => 'out',
                ];
            }
        }

        // Debt obligation impact
        if ($isBonus) {
            $impactSummary[] = "Sales commission bonus obligation for {$contactName} will reopen by +".number_format($totalAmount, 2).' ETB';
            $impactNodes[] = [
                'id' => "bonus-debt-{$debt->id}",
                'category' => 'bonus',
                'title' => "Bonus Obligation ({$contactName})",
                'reversal' => 'Reopens +'.number_format($totalAmount, 2).' ETB',
                'detail' => 'Commission payable reopened',
                'direction' => 'in',
            ];
        } else {
            $impactSummary[] = "Debt obligation for {$contactName} will reopen by +".number_format($totalAmount, 2).' ETB';
            $impactNodes[] = [
                'id' => "debt-{$debt->id}",
                'category' => 'debt',
                'title' => "{$debt->type} ({$contactName})",
                'reversal' => 'Reopens +'.number_format($totalAmount, 2).' ETB',
                'detail' => 'Obligation reopened',
                'direction' => 'in',
            ];
        }

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $actor = $log->user instanceof User ? $log->user->name : 'Staff';

        return [
            'action' => $log->action,
            'entity_type' => 'DebtPayment',
            'entity_id' => $log->entity_id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => true,
            'blocked' => false,
            'blocked_reasons' => [],
            'warning' => 'This payment record will be deleted and the cash balance restored.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => $isBonus ? "Commission Payout: {$contactName}" : "Debt Payment: {$contactName}",
                    'badge' => 'PAID',
                    'subtitle' => 'Amount: '.number_format($totalAmount, 2).' ETB',
                    'timestamp' => $performedAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => $isBonus ? 'Bonus Payout Reopened' : 'Payment Voided',
                    'summary' => 'Cash is restored, the debt is reopened, and payment ledger entries are cleared.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $newValues = is_array($log->new_values) ? $log->new_values : [];
            $paymentId = $log->entity_id;

            $payments = DebtPayment::where('tenant_id', $log->tenant_id)
                ->where(function ($q) use ($paymentId, $newValues) {
                    $q->where('id', $paymentId);
                    if (! empty($newValues['split_group_id'])) {
                        $q->orWhere('split_group_id', $newValues['split_group_id']);
                    }
                })
                ->get();

            if ($payments->isEmpty()) {
                throw new UndoBlockedException('This payment record was not found or has already been reversed.');
            }

            $debtId = $payments->first()->debt_id;
            $debt = Debt::with(['contact', 'salesperson'])->where('tenant_id', $log->tenant_id)->find($debtId);

            if (! $debt) {
                throw new UndoBlockedException('The associated debt obligation no longer exists.');
            }

            $totalReversed = 0.0;
            $isPayable = $debt->isPayable();

            foreach ($payments as $payment) {
                $amount = (float) $payment->amount;
                $totalReversed += $amount;

                $account = FinancialAccount::find($payment->financial_account_id);
                if ($account) {
                    if ($isPayable) {
                        // Refund the account
                        $account->increment('current_balance', $amount);
                    } else {
                        // Debit the account
                        $account->decrement('current_balance', $amount);
                    }
                }

                // Delete linked FinancialTransaction
                FinancialTransaction::where('tenant_id', $log->tenant_id)
                    ->where(function ($q) use ($payment) {
                        if ($payment->reference_number) {
                            $q->where('reference_number', $payment->reference_number);
                        } else {
                            $q->where('created_at', '>=', Carbon::parse($payment->created_at)->subSeconds(15))
                                ->where('created_at', '<=', Carbon::parse($payment->created_at)->addSeconds(15))
                                ->where('amount', $payment->amount);
                        }
                    })
                    ->delete();

                $payment->delete();
            }

            // Recalculate debt
            $newPaid = max(0, (float) $debt->paid_amount - $totalReversed);
            $newRemaining = min((float) $debt->original_amount, (float) $debt->remaining_amount + $totalReversed);
            $newStatus = $newPaid <= 0 ? 'open' : 'partially_paid';

            $debt->update([
                'paid_amount' => $newPaid,
                'remaining_amount' => $newRemaining,
                'status' => $newStatus,
            ]);

            if ($debt->reference_type === 'sales_order') {
                $debt->syncLinkedSalesOrder();
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
                    'amount' => $totalReversed,
                    'debt_id' => $debt->id,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id()
            );

            return 'Payment of '.number_format($totalReversed, 2).' ETB was successfully reversed and the obligation reopened.';
        });
    }
}
