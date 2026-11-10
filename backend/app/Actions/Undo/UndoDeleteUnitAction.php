<?php

namespace App\Actions\Undo;

use App\Actions\SynchronizeInventoryStockAction;
use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UndoDeleteUnitAction implements UndoActionInterface
{
    public function __construct(
        protected SynchronizeInventoryStockAction $stockSync = new SynchronizeInventoryStockAction
    ) {}

    public function preview(AuditLog $log): array
    {
        $unit = InventoryUnit::withTrashed()->find($log->entity_id);

        if (! $unit) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The deleted inventory unit was not found in the database archive.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        if (! $unit->trashed() && $unit->status !== 'archived') {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['This inventory unit has already been restored and is active.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $oldValues = $log->old_values ?? [];
        $newValues = $log->new_values ?? [];
        $variant = $unit->variant;
        $product = $variant instanceof ProductVariant ? $variant->product : null;
        $productName = $oldValues['product_name'] ?? ($product instanceof Product ? $product->name : 'Device');
        $serialNumber = $oldValues['imei_or_serial'] ?? $unit->imei_or_serial ?: 'Standard stock';
        $costBasis = (float) ($oldValues['cost_basis'] ?? $unit->cost_basis ?? 0);

        $blockedReasons = [];
        $impactSummary = [
            "Device '{$productName}' (SN: {$serialNumber}) will be restored to active inventory",
        ];

        $impactNodes = [
            [
                'id' => "unit-restore-{$unit->id}",
                'category' => 'inventory',
                'title' => $productName,
                'reversal' => 'Restored to Stock',
                'detail' => "SN: {$serialNumber} (Cost: ".number_format($costBasis, 2).' ETB)',
                'direction' => 'in',
            ],
        ];

        // Check if bank refund was issued upon deletion
        $bankRefundIssued = $newValues['bank_refund_issued'] ?? false;
        if ($bankRefundIssued) {
            $paymentSplits = $oldValues['payment_splits'] ?? [];
            if (! empty($paymentSplits) && is_array($paymentSplits)) {
                foreach ($paymentSplits as $split) {
                    $splitAccId = $split['financial_account_id'] ?? null;
                    $splitAmt = (float) ($split['amount'] ?? 0);
                    if ($splitAccId && $splitAmt > 0) {
                        $acc = FinancialAccount::where('tenant_id', $log->tenant_id)->find($splitAccId);
                        $accName = $acc ? $acc->name : 'Financial Account';
                        if ($acc && (float) $acc->current_balance < $splitAmt) {
                            $blockedReasons[] = "Account '{$accName}' has insufficient balance (".number_format((float) $acc->current_balance, 2).' ETB) to reverse the deletion refund of '.number_format($splitAmt, 2).' ETB.';
                        }
                        $impactSummary[] = "Account '{$accName}' balance will decrease by -".number_format($splitAmt, 2).' ETB (reversal of deletion refund)';
                        $impactNodes[] = [
                            'id' => "acc-rev-{$splitAccId}",
                            'category' => 'financial',
                            'title' => $accName,
                            'reversal' => '-'.number_format($splitAmt, 2).' ETB',
                            'detail' => 'Reverses deletion purchase refund',
                            'direction' => 'out',
                        ];
                    }
                }
            } elseif (($targetAccId = $oldValues['payment_account_id'] ?? null) && $costBasis > 0) {
                $acc = FinancialAccount::where('tenant_id', $log->tenant_id)->find($targetAccId);
                $accName = $acc ? $acc->name : 'Financial Account';
                if ($acc && (float) $acc->current_balance < $costBasis) {
                    $blockedReasons[] = "Account '{$accName}' has insufficient balance (".number_format((float) $acc->current_balance, 2).' ETB) to reverse the deletion refund of '.number_format($costBasis, 2).' ETB.';
                }
                $impactSummary[] = "Account '{$accName}' balance will decrease by -".number_format($costBasis, 2).' ETB (reversal of deletion refund)';
                $impactNodes[] = [
                    'id' => "acc-rev-{$targetAccId}",
                    'category' => 'financial',
                    'title' => $accName,
                    'reversal' => '-'.number_format($costBasis, 2).' ETB',
                    'detail' => 'Reverses deletion purchase refund',
                    'direction' => 'out',
                ];
            }
        }

        // Check if debts were voided upon deletion
        $voidedDebtsCount = (int) ($newValues['unpaid_debts_voided'] ?? 0);
        if ($voidedDebtsCount > 0) {
            $impactSummary[] = "{$voidedDebtsCount} supplier payable debt(s) previously cancelled on deletion will be reopened";
            $impactNodes[] = [
                'id' => "debt-restore-{$unit->id}",
                'category' => 'debt',
                'title' => 'Supplier Payable',
                'reversal' => 'Debt Reopened',
                'detail' => 'Restores cancelled supplier balance',
                'direction' => 'in',
            ];
        }

        $isBlocked = count($blockedReasons) > 0;
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
            'warning' => 'This unit will be restored to your active inventory with live stock tracking.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Deleted Unit: {$productName}",
                    'badge' => 'ARCHIVED',
                    'subtitle' => "SN: {$serialNumber} · Deleted",
                    'timestamp' => $performedAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Unit Restored to Stock',
                    'summary' => 'Unit is restored to in-stock status and catalog count is incremented.',
                ],
            ],
        ];
    }

    public function execute(AuditLog $log): string
    {
        return DB::transaction(function () use ($log) {
            $unit = InventoryUnit::withTrashed()->findOrFail($log->entity_id);

            $oldValues = $log->old_values ?? [];
            $newValues = $log->new_values ?? [];
            $variant = $unit->variant;
            $product = $variant instanceof ProductVariant ? $variant->product : null;
            $productName = $oldValues['product_name'] ?? ($product instanceof Product ? $product->name : 'Device');
            $serialNumber = $oldValues['imei_or_serial'] ?? $unit->imei_or_serial ?: 'Standard stock';
            $costBasis = (float) ($oldValues['cost_basis'] ?? $unit->cost_basis ?? 0);

            // 1. Reverse bank refund if one was issued
            $bankRefundIssued = $newValues['bank_refund_issued'] ?? false;
            if ($bankRefundIssued) {
                $paymentSplits = $oldValues['payment_splits'] ?? [];
                if (! empty($paymentSplits) && is_array($paymentSplits)) {
                    foreach ($paymentSplits as $split) {
                        $splitAccId = $split['financial_account_id'] ?? null;
                        $splitAmt = (float) ($split['amount'] ?? 0);
                        if ($splitAccId && $splitAmt > 0) {
                            $acc = FinancialAccount::where('tenant_id', $log->tenant_id)->lockForUpdate()->find($splitAccId);
                            if ($acc) {
                                if ((float) $acc->current_balance < $splitAmt) {
                                    throw new UndoBlockedException("Cannot undo deletion: Account '{$acc->name}' has insufficient funds to reverse refund.");
                                }
                                $acc->decrement('current_balance', $splitAmt);
                                FinancialTransaction::create([
                                    'tenant_id' => $log->tenant_id,
                                    'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                                    'destination_account_id' => $acc->id,
                                    'type' => 'supplier_payment',
                                    'amount' => $splitAmt,
                                    'contact_id' => $unit->supplier_contact_id,
                                    'description' => "Undo unit deletion: Reversal of deletion refund for {$productName} (SN: {$serialNumber})",
                                    'date' => now(),
                                    'created_by' => auth()->id(),
                                ]);
                            }
                        }
                    }
                } elseif (($targetAccId = $oldValues['payment_account_id'] ?? null) && $costBasis > 0) {
                    $acc = FinancialAccount::where('tenant_id', $log->tenant_id)->lockForUpdate()->find($targetAccId);
                    if ($acc) {
                        if ((float) $acc->current_balance < $costBasis) {
                            throw new UndoBlockedException("Cannot undo deletion: Account '{$acc->name}' has insufficient funds to reverse refund.");
                        }
                        $acc->decrement('current_balance', $costBasis);
                        FinancialTransaction::create([
                            'tenant_id' => $log->tenant_id,
                            'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                            'destination_account_id' => $acc->id,
                            'type' => 'supplier_payment',
                            'amount' => $costBasis,
                            'contact_id' => $unit->supplier_contact_id,
                            'description' => "Undo unit deletion: Reversal of deletion refund for {$productName} (SN: {$serialNumber})",
                            'date' => now(),
                            'created_by' => auth()->id(),
                        ]);
                    }
                }
            }

            // 2. Reopen cancelled debts
            $voidedDebts = Debt::where('tenant_id', $log->tenant_id)
                ->where('reference_id', $unit->id)
                ->where('status', 'cancelled')
                ->get();

            foreach ($voidedDebts as $d) {
                $cleanNotes = str_replace("[Voided upon deletion of unit {$unit->imei_or_serial}]", '', $d->notes ?? '');
                $d->update([
                    'status' => 'unpaid',
                    'remaining_amount' => $d->original_amount,
                    'notes' => trim($cleanNotes),
                ]);
            }

            if ($unit->supplier_contact_id) {
                Debt::reconcileContactMutualDebts($log->tenant_id, (string) $unit->supplier_contact_id);
            }

            // 3. Restore unit to active inventory
            $oldStatus = $oldValues['status'] ?? 'in_stock';
            if ($oldStatus === 'archived' || $oldStatus === 'deleted') {
                $oldStatus = 'in_stock';
            }

            $unit->restore();
            $unit->update([
                'status' => $oldStatus,
            ]);

            // 4. Synchronize stock
            $this->stockSync->execute();

            // 5. Mark log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // 6. Record reversal audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'InventoryUnit',
                entityId: (string) $unit->id,
                oldValues: [
                    'status' => 'archived',
                    'deleted_at' => $newValues['deleted_at'] ?? null,
                ],
                newValues: [
                    'original_action' => 'deleted_unit',
                    'status' => $oldStatus,
                    'product_name' => $productName,
                    'imei_or_serial' => $serialNumber,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id()
            );

            return "Inventory unit '{$productName}' (SN: {$serialNumber}) has been restored to stock.";
        });
    }
}
