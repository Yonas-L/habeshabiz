<?php

namespace App\Actions\Undo;

use App\Actions\SynchronizeInventoryStockAction;
use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoHandoverSoldAction implements UndoActionInterface
{
    public function __construct(
        protected UndoBlockedChecker $checker = new UndoBlockedChecker,
        protected SynchronizeInventoryStockAction $stockSync = new SynchronizeInventoryStockAction
    ) {}

    public function preview(AuditLog $log): array
    {
        $unit = InventoryUnit::with('variant.product')->find($log->entity_id);

        if (! $unit) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The inventory device record was not found.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $blockedReasons = $this->checker->checkHandoverSold($unit, $log);
        $isBlocked = count($blockedReasons) > 0;

        /** @var ProductVariant|null $variant */
        $variant = $unit->variant;
        /** @var Product|null $product */
        $product = $variant?->product;
        $pName = $product ? $product->name : 'Device';
        $ident = $unit->imei_or_serial ?: $unit->id;
        $oldValues = is_array($log->old_values) ? $log->old_values : [];
        $custodian = isset($oldValues['handover_to']) ? (string) $oldValues['handover_to'] : ($unit->handover_to ?? 'Staff/Broker');

        $impactSummary = [
            "Device {$pName} ({$ident}) will revert back to 'Out with Staff/Broker'",
            'Handover sale invoice will be voided and deleted',
            "Temporary holding debt for {$custodian} will be reopened",
        ];

        $impactNodes = [
            [
                'id' => "unit-hos-{$unit->id}",
                'category' => 'inventory',
                'title' => $pName,
                'reversal' => "Reverts status to 'Out'",
                'detail' => "SN/IMEI: {$ident} · Custodian: {$custodian}",
                'direction' => 'out',
            ],
            [
                'id' => "debt-hos-{$unit->id}",
                'category' => 'debt',
                'title' => "Holding Debt ({$custodian})",
                'reversal' => 'Reopens holding debt liability',
                'detail' => 'Restores consignment balance',
                'direction' => 'in',
            ],
            [
                'id' => "order-hos-{$unit->id}",
                'category' => 'document',
                'title' => 'Handover Sale Invoice',
                'reversal' => 'Invoice voided and deleted',
                'detail' => 'Removes realized revenue from reports',
                'direction' => 'neutral',
            ],
        ];

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $actor = $log->user instanceof User ? $log->user->name : 'Staff';

        return [
            'action' => $log->action,
            'entity_type' => 'InventoryUnit',
            'entity_id' => $unit->id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => 'This sale will be voided and the item returned to active handover custody.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Handover Sold: {$pName}",
                    'badge' => 'SOLD / OFFSET',
                    'subtitle' => "Confirmed from {$custodian}",
                    'timestamp' => $performedAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Sale Reverted to Handout',
                    'summary' => 'Item is returned to handed-out custody and revenue is voided.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $unit = InventoryUnit::where('tenant_id', $log->tenant_id)->find($log->entity_id);

            if (! $unit) {
                throw new UndoBlockedException('The inventory device was not found.');
            }

            $blockedReasons = $this->checker->checkHandoverSold($unit, $log);
            if (count($blockedReasons) > 0) {
                throw new UndoBlockedException('Cannot undo this handover sale.', $blockedReasons);
            }

            $oldValues = is_array($log->old_values) ? $log->old_values : [];
            $newValues = is_array($log->new_values) ? $log->new_values : [];

            // 1. Locate and delete the sales order created for this handover sale
            $orderId = isset($newValues['sales_order_id']) && is_string($newValues['sales_order_id']) ? $newValues['sales_order_id'] : null;
            $order = null;

            if ($orderId !== null) {
                $order = SalesOrder::where('tenant_id', $log->tenant_id)->find($orderId);
            }

            if (! $order) {
                $order = SalesOrder::where('tenant_id', $log->tenant_id)
                    ->where('notes', 'like', "%[unit_id:{$unit->id}]%")
                    ->first();
            }

            if ($order) {
                // Reverse cash deposits if any
                if (is_array($order->payment_splits) && count($order->payment_splits) > 0) {
                    foreach ($order->payment_splits as $split) {
                        $accId = $split['financial_account_id'] ?? null;
                        $amount = (float) ($split['amount'] ?? 0);
                        if ($accId && $amount > 0) {
                            $acc = FinancialAccount::where('id', $accId)->lockForUpdate()->first();
                            if ($acc) {
                                $acc->decrement('current_balance', $amount);
                            }
                        }
                    }
                } elseif ($order->financial_account_id && (float) $order->paid_amount > 0) {
                    $acc = FinancialAccount::where('id', $order->financial_account_id)->lockForUpdate()->first();
                    if ($acc) {
                        $acc->decrement('current_balance', (float) $order->paid_amount);
                    }
                }

                // Delete linked transactions and debts
                FinancialTransaction::where('tenant_id', $order->tenant_id)
                    ->where('description', 'like', "%#{$order->order_number}%")
                    ->delete();

                $debts = Debt::where('tenant_id', $order->tenant_id)->where('reference_id', $order->id)->get();
                foreach ($debts as $debt) {
                    DebtPayment::where('debt_id', $debt->id)->delete();
                    $debt->delete();
                }

                $order->items()->delete();
                $order->delete();
            }

            // 2. Restore unit status to 'out'
            $custodian = $oldValues['handover_to'] ?? $newValues['handover_to'] ?? $unit->handover_to;
            $handedOutAt = $oldValues['handed_out_at'] ?? now();

            $unit->update([
                'status' => 'out',
                'handover_to' => $custodian,
                'handed_out_at' => $handedOutAt,
                'sold_at' => null,
            ]);

            // 3. Reopen holding debt if recorded in old values
            if (! empty($oldValues['holding_debt_id'])) {
                $hDebt = Debt::find($oldValues['holding_debt_id']);
                if ($hDebt) {
                    $hDebt->update([
                        'status' => 'open',
                        'remaining_amount' => $oldValues['holding_debt_remaining_before'] ?? $hDebt->original_amount,
                    ]);
                }
            }

            // 4. Synchronize stock
            $this->stockSync->execute();

            // 5. Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // 6. Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'InventoryUnit',
                entityId: (string) $unit->id,
                newValues: [
                    'original_action' => $log->action,
                    'imei_or_serial' => $unit->imei_or_serial,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Handover sale for {$unit->imei_or_serial} has been reversed. Device is back in handed-out status with {$custodian}.";
        });
    }
}
