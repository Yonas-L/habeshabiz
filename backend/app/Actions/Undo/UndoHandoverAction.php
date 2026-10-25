<?php

namespace App\Actions\Undo;

use App\Actions\SynchronizeInventoryStockAction;
use App\Actions\Undo\Contracts\UndoActionInterface;
use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class UndoHandoverAction implements UndoActionInterface
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

        $blockedReasons = $this->checker->checkHandover($unit);
        $isBlocked = count($blockedReasons) > 0;

        /** @var ProductVariant|null $variant */
        $variant = $unit->variant;
        /** @var Product|null $product */
        $product = $variant?->product;
        $pName = $product ? $product->name : 'Device';
        $ident = $unit->imei_or_serial ?: $unit->id;
        $handoverTo = $unit->handover_to ?? 'Staff/Broker';

        $impactSummary = [
            "Device {$pName} ({$ident}) will return to 'In Stock'",
            "Handover responsibility assigned to '{$handoverTo}' will be cancelled",
            'Temporary holding debt will be cleared',
        ];

        $impactNodes = [
            [
                'id' => "unit-handover-{$unit->id}",
                'category' => 'inventory',
                'title' => $pName,
                'reversal' => 'Returns to In Stock',
                'detail' => "SN/IMEI: {$ident} · Recovers possession",
                'direction' => 'in',
            ],
            [
                'id' => "holding-debt-{$unit->id}",
                'category' => 'debt',
                'title' => "Holding: {$handoverTo}",
                'reversal' => 'Holding debt cancelled',
                'detail' => 'Clears consignment liability',
                'direction' => 'neutral',
            ],
        ];

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $actor = $log->user instanceof User ? $log->user->name : 'Staff';
        $handedOutAt = $unit->handed_out_at ? Carbon::parse($unit->handed_out_at)->format('M d, Y h:i A') : 'Unknown';

        return [
            'action' => $log->action,
            'entity_type' => 'InventoryUnit',
            'entity_id' => $unit->id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => 'This device will be returned to inventory stock and removed from staff custody.',
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Handed Out: {$pName}",
                    'badge' => 'CUSTODY OUT',
                    'subtitle' => "With: {$handoverTo}",
                    'timestamp' => $handedOutAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Handover Cancelled',
                    'summary' => 'Device is back In Stock in the shop and holding liabilities are cleared.',
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

            $blockedReasons = $this->checker->checkHandover($unit);
            if (count($blockedReasons) > 0) {
                throw new UndoBlockedException('Cannot undo this handover.', $blockedReasons);
            }

            $oldValues = is_array($log->old_values) ? $log->old_values : [];
            $prevLocation = isset($oldValues['unit_location_before']) ? (string) $oldValues['unit_location_before'] : 'Store Shelf';
            /** @var ProductVariant|null $variant */
            $variant = $unit->variant;
            /** @var Product|null $product */
            $product = $variant?->product;
            $pName = $product ? $product->name : 'Device';
            $ident = $unit->imei_or_serial ?: $unit->id;

            // 1. Restore unit status and location
            $unit->update([
                'status' => 'in_stock',
                'handover_to' => null,
                'handed_out_at' => null,
                'location' => $prevLocation,
            ]);

            // 2. Delete the handover holding debt
            Debt::where('tenant_id', $unit->tenant_id)
                ->where('reference_type', 'handover_holding')
                ->where('reference_id', $unit->id)
                ->delete();

            // 3. Synchronize stock
            $this->stockSync->execute();

            // 4. Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            // 5. Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'InventoryUnit',
                entityId: (string) $unit->id,
                newValues: [
                    'original_action' => 'unit_handover',
                    'imei_or_serial' => $ident,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Handover of {$pName} ({$ident}) has been cancelled. Device is now marked In Stock.";
        });
    }
}
