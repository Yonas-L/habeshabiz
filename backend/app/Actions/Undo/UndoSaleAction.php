<?php

namespace App\Actions\Undo;

use App\Actions\SynchronizeInventoryStockAction;
use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoSaleAction implements UndoActionInterface
{
    public function __construct(
        protected UndoBlockedChecker $checker = new UndoBlockedChecker,
        protected SynchronizeInventoryStockAction $stockSync = new SynchronizeInventoryStockAction
    ) {}

    public function preview(AuditLog $log): array
    {
        $order = SalesOrder::with([
            'customer',
            'salesperson',
            'financialAccount',
            'items.variant.product',
            'items.inventoryUnit',
            'exchangeUnit.variant.product',
        ])->find($log->entity_id);

        if (! $order) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The sales order record was not found or has already been removed.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $blockedReasons = $this->checker->checkSale($order, $log);
        $isBlocked = count($blockedReasons) > 0;

        $impactSummary = [];
        $impactNodes = [];

        // 1. Sold units impact
        foreach ($order->items as $item) {
            /** @var SalesOrderItem $item */
            /** @var ProductVariant|null $variant */
            $variant = $item->variant;
            /** @var Product|null $product */
            $product = $variant?->product;
            $prodName = $product ? $product->name : 'Device';
            /** @var InventoryUnit|null $invUnit */
            $invUnit = $item->inventoryUnit;

            if ($invUnit) {
                $ident = $invUnit->imei_or_serial ?: $invUnit->id;
                $impactSummary[] = "{$prodName} (SN/IMEI: {$ident}) will return to 'In Stock'";
                $impactNodes[] = [
                    'id' => "unit-{$invUnit->id}",
                    'category' => 'inventory',
                    'title' => $prodName,
                    'reversal' => 'Returns to In Stock',
                    'detail' => "SN/IMEI: {$ident}",
                    'direction' => 'in',
                ];
            } else {
                $impactSummary[] = "{$item->quantity}x {$prodName} will be returned to stock inventory";
                $impactNodes[] = [
                    'id' => "item-{$item->id}",
                    'category' => 'inventory',
                    'title' => "{$item->quantity}x {$prodName}",
                    'reversal' => "Restores +{$item->quantity} to quantity on hand",
                    'detail' => 'Non-serialized stock',
                    'direction' => 'in',
                ];
            }
        }

        // 2. Traded-in Exchange Device impact
        /** @var InventoryUnit|null $exUnit */
        $exUnit = $order->exchangeUnit;
        if ($exUnit) {
            /** @var ProductVariant|null $exVariant */
            $exVariant = $exUnit->variant;
            /** @var Product|null $exProdModel */
            $exProdModel = $exVariant?->product;
            $exProd = $exProdModel ? $exProdModel->name : 'Trade-in Device';
            $exIdent = $exUnit->imei_or_serial ?: $exUnit->id;
            $impactSummary[] = "Trade-in device {$exProd} ({$exIdent}) will be removed from stock inventory";
            $impactNodes[] = [
                'id' => "ex-{$exUnit->id}",
                'category' => 'inventory',
                'title' => "Traded-in: {$exProd}",
                'reversal' => 'Removed from inventory',
                'detail' => "SN/IMEI: {$exIdent} (Allowance: {$order->exchange_allowance} ETB)",
                'direction' => 'out',
            ];
        }

        // 3. Financial accounts impact
        if (is_array($order->payment_splits) && count($order->payment_splits) > 0) {
            foreach ($order->payment_splits as $split) {
                $accId = $split['financial_account_id'] ?? null;
                $amount = (float) ($split['amount'] ?? 0);
                $acc = $accId ? FinancialAccount::find($accId) : null;
                if ($acc && $amount > 0) {
                    $impactSummary[] = "Account '{$acc->name}' balance will decrease by {$amount} ETB";
                    $impactNodes[] = [
                        'id' => "acc-{$acc->id}",
                        'category' => 'financial',
                        'title' => $acc->name,
                        'reversal' => "-{$amount} ETB",
                        'detail' => "Current: {$acc->current_balance} ETB → Reverts cash inflow",
                        'direction' => 'out',
                    ];
                }
            }
        } elseif ($order->financial_account_id && (float) $order->paid_amount > 0) {
            /** @var FinancialAccount|null $acc */
            $acc = $order->financialAccount;
            $amount = (float) $order->paid_amount;
            if ($acc) {
                $impactSummary[] = "Account '{$acc->name}' balance will decrease by {$amount} ETB";
                $impactNodes[] = [
                    'id' => "acc-{$acc->id}",
                    'category' => 'financial',
                    'title' => $acc->name,
                    'reversal' => "-{$amount} ETB",
                    'detail' => "Current: {$acc->current_balance} ETB → Reverts cash inflow",
                    'direction' => 'out',
                ];
            }
        }

        // 4. Debts & Receivables
        $debts = Debt::where('tenant_id', $order->tenant_id)
            ->where('reference_id', $order->id)
            ->get();

        /** @var Contact|null $cust */
        $cust = $order->customer;
        $cName = $cust ? $cust->name : 'Customer';
        /** @var User|null $sp */
        $sp = $order->salesperson;
        $spName = $sp ? $sp->name : 'Salesperson';

        foreach ($debts as $debt) {
            if ($debt->reference_type === 'sales_order') {
                $impactSummary[] = "Unpaid customer balance of {$debt->remaining_amount} ETB for {$cName} will be cleared";
                $impactNodes[] = [
                    'id' => "debt-{$debt->id}",
                    'category' => 'debt',
                    'title' => "Receivable ({$cName})",
                    'reversal' => "Clears {$debt->remaining_amount} ETB open debt",
                    'detail' => 'Sales order debt cancelled',
                    'direction' => 'neutral',
                ];
            } elseif ($debt->reference_type === 'salesperson_bonus') {
                $impactSummary[] = "Sales commission bonus of {$debt->original_amount} ETB for {$spName} will be cancelled";
                $impactNodes[] = [
                    'id' => "bonus-{$debt->id}",
                    'category' => 'bonus',
                    'title' => "Bonus ({$spName})",
                    'reversal' => "Cancels {$debt->original_amount} ETB bonus",
                    'detail' => 'Commission payable removed',
                    'direction' => 'neutral',
                ];
            }
        }

        $impactSummary[] = "Order #{$order->order_number} and all financial revenue records will be completely removed";

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $performedBy = $log->user instanceof User ? $log->user->name : 'Staff';
        $orderDate = $order->order_date ? Carbon::parse($order->order_date)->format('M d, Y h:i A') : 'Unknown';
        $actor = $spName;

        return [
            'action' => $log->action,
            'entity_type' => 'SalesOrder',
            'entity_id' => $order->id,
            'performed_by' => $performedBy,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => 'This action cannot be undone again. The sale record will be permanently deleted and inventory returned.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Sale Order #{$order->order_number}",
                    'badge' => strtoupper($order->payment_status ?: 'COMPLETED'),
                    'subtitle' => "Total: {$order->total_amount} ETB · Paid: {$order->paid_amount} ETB",
                    'timestamp' => $orderDate,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Voided & Clean Reversal',
                    'summary' => 'Stock is restored, account cash is reversed by relative delta, and debts are cleared.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $order = SalesOrder::with([
                'items.inventoryUnit',
                'items.variant',
                'exchangeUnit',
            ])->where('tenant_id', $log->tenant_id)
                ->find($log->entity_id);

            if (! $order) {
                throw new UndoBlockedException('This sale record no longer exists or was already removed.');
            }

            // 1. Dependency validation
            $blockedReasons = $this->checker->checkSale($order, $log);
            if (count($blockedReasons) > 0) {
                throw new UndoBlockedException(
                    'Cannot undo this sale because subsequent actions depend on it.',
                    $blockedReasons
                );
            }

            $orderNumber = $order->order_number;

            // 2. Reverse sold inventory units
            $variantIdsToSync = [];
            foreach ($order->items as $item) {
                /** @var SalesOrderItem $item */
                /** @var InventoryUnit|null $invUnit */
                $invUnit = $item->inventoryUnit;
                if ($invUnit) {
                    $invUnit->update([
                        'status' => 'in_stock',
                        'sold_at' => null,
                    ]);
                    $variantIdsToSync[$invUnit->variant_id] = true;
                } elseif ($item->variant_id) {
                    // Non-serialized item stock restoration
                    $stock = InventoryStock::where('tenant_id', $order->tenant_id)
                        ->where('variant_id', $item->variant_id)
                        ->first();
                    if ($stock) {
                        $stock->increment('quantity_on_hand', $item->quantity);
                    }
                    $variantIdsToSync[$item->variant_id] = true;
                }
            }

            // 3. Reverse trade-in exchange device (if any)
            if ($order->exchange_unit_id) {
                /** @var InventoryUnit|null $exUnit */
                $exUnit = $order->exchangeUnit;
                if ($exUnit) {
                    $exVariantId = $exUnit->variant_id;
                    $exUnit->delete();
                    $variantIdsToSync[$exVariantId] = true;
                }
            }

            // 4. Synchronize inventory stock levels
            $this->stockSync->execute();

            // 5. Reverse cash received into financial accounts via RELATIVE DELTAS
            if (is_array($order->payment_splits) && count($order->payment_splits) > 0) {
                $accountIds = [];
                foreach ($order->payment_splits as $split) {
                    if (! empty($split['financial_account_id'])) {
                        $accountIds[] = $split['financial_account_id'];
                    }
                }
                if (! empty($accountIds)) {
                    $accounts = FinancialAccount::whereIn('id', $accountIds)->lockForUpdate()->get()->keyBy('id');
                    foreach ($order->payment_splits as $split) {
                        $accId = $split['financial_account_id'] ?? null;
                        $amount = (float) ($split['amount'] ?? 0);
                        if ($accId && $amount > 0 && isset($accounts[$accId])) {
                            $accounts[$accId]->decrement('current_balance', $amount);
                        }
                    }
                }
            } elseif ($order->financial_account_id && (float) $order->paid_amount > 0) {
                $acc = FinancialAccount::where('id', $order->financial_account_id)->lockForUpdate()->first();
                if ($acc) {
                    $acc->decrement('current_balance', (float) $order->paid_amount);
                }
            }

            // 6. Delete financial transactions linked to this order
            // Search by exact revert_group_id if available, or reference description
            if (! empty($log->revert_group_id)) {
                FinancialTransaction::where('tenant_id', $order->tenant_id)
                    ->where(function ($q) use ($orderNumber) {
                        $q->where('description', 'like', "%#{$orderNumber}%")
                            ->orWhere('reference_number', $orderNumber);
                    })->delete();
            } else {
                FinancialTransaction::where('tenant_id', $order->tenant_id)
                    ->where('description', 'like', "%#{$orderNumber}%")
                    ->delete();
            }

            // 7. Delete debts and debt payments created by this sale
            $debts = Debt::where('tenant_id', $order->tenant_id)
                ->where('reference_id', $order->id)
                ->whereIn('reference_type', ['sales_order', 'brokered_sourcing', 'salesperson_bonus', 'consignment_sale'])
                ->get();

            foreach ($debts as $debt) {
                DebtPayment::where('debt_id', $debt->id)->delete();
                $debt->delete();
            }

            // 8. Delete sales order items and order
            $order->items()->delete();
            $order->delete();

            // 9. Mark related audit logs as reverted
            if (! empty($log->revert_group_id)) {
                AuditLog::where('tenant_id', $log->tenant_id)
                    ->where('revert_group_id', $log->revert_group_id)
                    ->update([
                        'reverted_at' => now(),
                        'reverted_by' => auth()->id(),
                    ]);
            } else {
                $log->update([
                    'reverted_at' => now(),
                    'reverted_by' => auth()->id(),
                ]);
            }

            // 10. Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'SalesOrder',
                entityId: (string) $log->entity_id,
                newValues: [
                    'original_action' => 'sale_created',
                    'order_number' => $orderNumber,
                    'revert_group_id' => $log->revert_group_id,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Sale #{$orderNumber} has been reversed. Devices are back in stock, cash balances were corrected, and all related records were removed.";
        });
    }
}
