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
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoStockIntakeAction implements UndoActionInterface
{
    public function __construct(
        protected UndoBlockedChecker $checker = new UndoBlockedChecker,
        protected SynchronizeInventoryStockAction $stockSync = new SynchronizeInventoryStockAction
    ) {}

    public function preview(AuditLog $log): array
    {
        $newValues = $log->new_values ?? [];
        $oldValues = $log->old_values ?? [];

        $unitIds = $newValues['unit_ids'] ?? $oldValues['unit_ids_created'] ?? [];
        if (empty($unitIds) && $log->entity_id) {
            $unitIds = [$log->entity_id];
        }

        $units = InventoryUnit::with('variant.product')->whereIn('id', $unitIds)->get();

        $blockedReasons = $this->checker->checkStockIntake($unitIds);
        $isBlocked = count($blockedReasons) > 0;

        $impactSummary = [];
        $impactNodes = [];

        foreach ($units as $unit) {
            /** @var ProductVariant|null $variant */
            $variant = $unit->variant;
            /** @var Product|null $product */
            $product = $variant?->product;
            $pName = $product ? $product->name : 'Device';
            $ident = $unit->imei_or_serial ?: $unit->id;
            $impactSummary[] = "{$pName} ({$ident}) will be removed from stock inventory";
            $impactNodes[] = [
                'id' => "unit-intake-{$unit->id}",
                'category' => 'inventory',
                'title' => $pName,
                'reversal' => 'Removed from inventory',
                'detail' => "SN/IMEI: {$ident} (Cost: {$unit->cost_basis} ETB)",
                'direction' => 'out',
            ];
        }

        // Account cash refund if shop paid for this intake
        $paidAmount = (float) ($newValues['paid_amount'] ?? 0);
        $accountName = $newValues['account_name'] ?? 'Shop Account';
        if ($paidAmount > 0) {
            $impactSummary[] = "Account '{$accountName}' balance will increase by +{$paidAmount} ETB (refund of intake cost)";
            $impactNodes[] = [
                'id' => 'acc-intake-refund',
                'category' => 'financial',
                'title' => $accountName,
                'reversal' => "+{$paidAmount} ETB Refund",
                'detail' => 'Restores cash paid out for purchase',
                'direction' => 'in',
            ];
        }

        // Supplier debt cancellation if purchased on credit / consignment
        $debts = Debt::where('reference_type', 'stock_intake')->whereIn('reference_id', $unitIds)->get();
        foreach ($debts as $debt) {
            $impactSummary[] = "Supplier payable debt of {$debt->remaining_amount} ETB will be cancelled";
            $impactNodes[] = [
                'id' => "debt-intake-{$debt->id}",
                'category' => 'debt',
                'title' => 'Supplier Payable',
                'reversal' => "Cancels {$debt->remaining_amount} ETB debt",
                'detail' => 'Stock intake debt cleared',
                'direction' => 'neutral',
            ];
        }

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $actor = $log->user ? $log->user->name : 'Staff';

        return [
            'action' => $log->action,
            'entity_type' => 'InventoryUnit',
            'entity_id' => $log->entity_id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => 'This intake will be erased. The newly added stock units will be deleted permanently.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => 'Stock Intake Batch',
                    'badge' => count($units).' UNIT(S)',
                    'subtitle' => 'Added to inventory',
                    'timestamp' => $performedAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Intake Cancelled',
                    'summary' => 'Units removed, live stock recalculated, and cash accounts refunded.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $newValues = $log->new_values ?? [];
            $oldValues = $log->old_values ?? [];

            $unitIds = $newValues['unit_ids'] ?? $oldValues['unit_ids_created'] ?? [];
            if (empty($unitIds) && $log->entity_id) {
                $unitIds = [$log->entity_id];
            }

            $blockedReasons = $this->checker->checkStockIntake($unitIds);
            if (count($blockedReasons) > 0) {
                throw new UndoBlockedException('Cannot undo this stock intake.', $blockedReasons);
            }

            $units = InventoryUnit::where('tenant_id', $log->tenant_id)->whereIn('id', $unitIds)->get();
            $count = $units->count();

            // 1. Delete the inventory units
            InventoryUnit::where('tenant_id', $log->tenant_id)->whereIn('id', $unitIds)->delete();

            // 2. Synchronize stock levels
            $this->stockSync->execute();

            // 3. Refund cash to financial accounts via relative delta if cash was paid out
            $splits = $newValues['payment_splits'] ?? [];
            $accountId = $newValues['financial_account_id'] ?? null;
            $paidAmount = (float) ($newValues['paid_amount'] ?? 0);

            if (empty($splits) && $accountId && $paidAmount > 0) {
                $splits = [['financial_account_id' => $accountId, 'amount' => $paidAmount]];
            }

            foreach ($splits as $split) {
                $accId = $split['financial_account_id'] ?? null;
                $amount = (float) ($split['amount'] ?? 0);
                if ($accId && $amount > 0) {
                    $acc = FinancialAccount::where('id', $accId)->lockForUpdate()->first();
                    if ($acc) {
                        $acc->increment('current_balance', $amount);
                    }
                }
            }

            // 4. Delete supplier debts and payments
            $debts = Debt::where('tenant_id', $log->tenant_id)
                ->where('reference_type', 'stock_intake')
                ->whereIn('reference_id', $unitIds)
                ->get();

            foreach ($debts as $debt) {
                DebtPayment::where('debt_id', $debt->id)->delete();
                $debt->delete();
            }

            // 5. Delete financial transactions (supplier payouts) created for this intake
            FinancialTransaction::where('tenant_id', $log->tenant_id)
                ->where('type', 'supplier_payment')
                ->whereBetween('created_at', [$log->created_at->subSeconds(5), $log->created_at->addSeconds(5)])
                ->delete();

            // 6. Mark audit log as reverted
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

            // 7. Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'InventoryUnit',
                entityId: (string) $log->entity_id,
                newValues: [
                    'original_action' => 'stock_intake',
                    'deleted_units_count' => $count,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Stock intake of {$count} device(s) has been reversed. Units were deleted and stock levels synchronized.";
        });
    }
}
