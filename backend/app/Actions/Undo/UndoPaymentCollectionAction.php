<?php

namespace App\Actions\Undo;

use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\SalesOrder;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoPaymentCollectionAction implements UndoActionInterface
{
    public function __construct(
        protected UndoBlockedChecker $checker = new UndoBlockedChecker
    ) {}

    public function preview(AuditLog $log): array
    {
        $order = SalesOrder::with(['customer', 'financialAccount'])->find($log->entity_id);

        if (! $order) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The sales order record was not found.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $blockedReasons = $this->checker->checkPaymentCollection($order, $log);
        $isBlocked = count($blockedReasons) > 0;

        $newValues = is_array($log->new_values) ? $log->new_values : [];
        $collectedAmount = (float) ($newValues['collected_amount'] ?? $newValues['amount'] ?? 0);
        /** @var FinancialAccount|null $finAccount */
        $finAccount = $order->financialAccount;
        $accountName = isset($newValues['account_name']) && is_string($newValues['account_name'])
            ? $newValues['account_name']
            : ($finAccount ? $finAccount->name : 'Receiving Account');
        /** @var Contact|null $cust */
        $cust = $order->customer;
        $customerName = $cust ? $cust->name : 'Customer';

        $impactSummary = [
            "Collected cash of {$collectedAmount} ETB will be deducted from account '{$accountName}'",
            "Customer {$customerName}'s unpaid balance will reopen by +{$collectedAmount} ETB",
            "Sales order #{$order->order_number} payment status will revert back to 'partially_paid' / 'unpaid'",
        ];

        $impactNodes = [
            [
                'id' => "acc-col-{$order->id}",
                'category' => 'financial',
                'title' => $accountName,
                'reversal' => "-{$collectedAmount} ETB",
                'detail' => 'Reverses collected cash inflow',
                'direction' => 'out',
            ],
            [
                'id' => "debt-col-{$order->id}",
                'category' => 'debt',
                'title' => $customerName,
                'reversal' => "+{$collectedAmount} ETB Open Balance",
                'detail' => 'Reopens receivable balance',
                'direction' => 'in',
            ],
            [
                'id' => "order-col-{$order->id}",
                'category' => 'document',
                'title' => "Order #{$order->order_number}",
                'reversal' => 'Payment status reverted',
                'detail' => "Paid amount decreases by {$collectedAmount} ETB",
                'direction' => 'neutral',
            ],
        ];

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $performedBy = $log->user instanceof User ? $log->user->name : 'Staff';

        return [
            'action' => $log->action,
            'entity_type' => 'SalesOrder',
            'entity_id' => $order->id,
            'performed_by' => $performedBy,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => 'This collection payment will be deleted and the customer debt reopened.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Payment Collection on Order #{$order->order_number}",
                    'badge' => 'COLLECTED',
                    'subtitle' => "Amount: {$collectedAmount} ETB",
                    'timestamp' => $performedAt,
                    'actor' => $performedBy,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Collection Reversal Completed',
                    'summary' => 'Cash is withdrawn from account, debt is reopened, and collection receipt is voided.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $order = SalesOrder::where('tenant_id', $log->tenant_id)->find($log->entity_id);

            if (! $order) {
                throw new UndoBlockedException('The sales order record was not found.');
            }

            $blockedReasons = $this->checker->checkPaymentCollection($order, $log);
            if (count($blockedReasons) > 0) {
                throw new UndoBlockedException('Cannot undo this payment collection.', $blockedReasons);
            }

            $oldValues = is_array($log->old_values) ? $log->old_values : [];
            $newValues = is_array($log->new_values) ? $log->new_values : [];

            $collectedAmount = (float) ($newValues['collected_amount'] ?? $newValues['amount'] ?? 0);
            $accountId = $newValues['financial_account_id'] ?? $order->financial_account_id;

            // 1. Reverse account balance using relative delta with pessimistic locking
            if ($accountId && $collectedAmount > 0) {
                $account = FinancialAccount::where('id', $accountId)->lockForUpdate()->first();
                if ($account) {
                    $account->decrement('current_balance', $collectedAmount);
                }
            }

            // 2. Restore order paid amount & payment status
            if (isset($oldValues['order_paid_amount_before'])) {
                $order->paid_amount = (float) $oldValues['order_paid_amount_before'];
                $order->payment_status = $oldValues['order_payment_status_before'] ?? 'partially_paid';
            } else {
                $order->paid_amount = max(0, (float) $order->paid_amount - $collectedAmount);
                $order->payment_status = (float) $order->paid_amount > 0 ? 'partially_paid' : 'unpaid';
            }
            $order->save();

            // 3. Reopen or restore linked debt
            $debt = Debt::where('tenant_id', $order->tenant_id)
                ->where('reference_type', 'sales_order')
                ->where('reference_id', $order->id)
                ->first();

            if ($debt) {
                if (isset($oldValues['debt_remaining_before'])) {
                    $debt->remaining_amount = (float) $oldValues['debt_remaining_before'];
                    $debt->paid_amount = (float) ($oldValues['debt_paid_before'] ?? 0);
                    $debt->status = $oldValues['debt_status_before'] ?? 'open';
                } else {
                    $debt->remaining_amount = (float) $debt->remaining_amount + $collectedAmount;
                    $debt->paid_amount = max(0, (float) $debt->paid_amount - $collectedAmount);
                    $debt->status = 'open';
                }
                $debt->save();

                // Delete the debt payment created at collection time
                DebtPayment::where('debt_id', $debt->id)
                    ->whereBetween('created_at', [$log->created_at->subSeconds(5), $log->created_at->addSeconds(5)])
                    ->delete();
            }

            // 4. Delete the financial transaction created for this collection
            FinancialTransaction::where('tenant_id', $order->tenant_id)
                ->where('type', 'customer_payment')
                ->whereBetween('created_at', [$log->created_at->subSeconds(5), $log->created_at->addSeconds(5)])
                ->delete();

            // 5. Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // 6. Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'SalesOrder',
                entityId: (string) $order->id,
                newValues: [
                    'original_action' => 'sales_order_balance_collected',
                    'order_number' => $order->order_number,
                    'reverted_collection_amount' => $collectedAmount,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Payment collection of {$collectedAmount} ETB on Order #{$order->order_number} has been reversed. Cash account was adjusted and debt reopened.";
        });
    }
}
