<?php

namespace App\Actions\Undo;

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

class UndoAgreedPayoutAction implements UndoActionInterface
{
    public function preview(AuditLog $log): array
    {
        $unit = InventoryUnit::with(['variant.product', 'supplier'])->find($log->entity_id);

        if (! $unit) {
            return [
                'can_undo' => false,
                'blocked' => true,
                'blocked_reasons' => ['The inventory device record was not found.'],
                'impact_summary' => [],
                'hierarchy_tree' => null,
            ];
        }

        $blockedReasons = [];
        if ($unit->status === 'sold') {
            $blockedReasons[] = 'The device has already been marked as sold. Undo the sale first to revert the agreed price.';
        }

        $isBlocked = count($blockedReasons) > 0;

        /** @var ProductVariant|null $variant */
        $variant = $unit->variant;
        /** @var Product|null $product */
        $product = $variant?->product;
        $pName = $product ? $product->name : 'Device';
        $ident = $unit->imei_or_serial ?: $unit->id;
        $partnerName = $unit->handover_to ?: ($unit->supplier?->name ?? 'Partner');

        $oldVals = is_array($log->old_values) ? $log->old_values : [];
        $newVals = is_array($log->new_values) ? $log->new_values : [];

        $isPayoutAdj = array_key_exists('handover_payout', $newVals) && array_key_exists('handover_payout', $oldVals);
        $oldPayout = (float) ($oldVals['handover_payout'] ?? 0);
        $newPayout = (float) ($newVals['handover_payout'] ?? 0);

        $isCostAdj = array_key_exists('cost_basis', $newVals) && array_key_exists('cost_basis', $oldVals);
        $oldCost = (float) ($oldVals['cost_basis'] ?? 0);
        $newCost = (float) ($newVals['cost_basis'] ?? 0);

        $impactSummary = [];
        $impactNodes = [];

        if ($isPayoutAdj && abs($oldPayout - $newPayout) > 0.01) {
            $impactSummary[] = "Agreed payout for {$pName} will revert from ".number_format($newPayout, 2).' ETB to '.number_format($oldPayout, 2).' ETB';
            $impactSummary[] = "Holding receivable debt with {$partnerName} will be recalculated to ".number_format($oldPayout, 2).' ETB';

            $impactNodes[] = [
                'id' => "payout-revert-{$unit->id}",
                'category' => 'inventory',
                'title' => $pName,
                'reversal' => number_format($oldPayout, 2).' ETB Payout',
                'detail' => "Reverts agreed handover price with {$partnerName}",
                'direction' => $oldPayout > $newPayout ? 'in' : 'out',
            ];

            $impactNodes[] = [
                'id' => "debt-revert-{$unit->id}",
                'category' => 'debt',
                'title' => "Holding: {$partnerName}",
                'reversal' => number_format($oldPayout, 2).' ETB',
                'detail' => 'Recalculates settlement and partner statement balance',
                'direction' => 'neutral',
            ];
        }

        if ($isCostAdj && abs($oldCost - $newCost) > 0.01) {
            $impactSummary[] = "Unit cost basis will revert from ".number_format($newCost, 2).' ETB to '.number_format($oldCost, 2).' ETB';
            $impactNodes[] = [
                'id' => "cost-revert-{$unit->id}",
                'category' => 'inventory',
                'title' => "Cost Basis: {$pName}",
                'reversal' => number_format($oldCost, 2).' ETB Cost',
                'detail' => 'Restores original inventory capital cost',
                'direction' => 'neutral',
            ];
        }

        $performedAt = $log->created_at ? Carbon::parse($log->created_at)->format('M d, Y h:i A') : 'Recent';
        $actor = $log->user instanceof User ? $log->user->name : 'Owner';

        return [
            'action' => $log->action,
            'entity_type' => 'InventoryUnit',
            'entity_id' => $unit->id,
            'performed_by' => $actor,
            'performed_at' => $performedAt,
            'can_undo' => ! $isBlocked,
            'blocked' => $isBlocked,
            'blocked_reasons' => $blockedReasons,
            'warning' => "This will revert the agreed transaction price for {$pName} ({$ident}) and recalculate partner balances.",
            'impact_summary' => $impactSummary,
            'hierarchy_tree' => [
                'current_state' => [
                    'title' => "Price Adjusted: {$pName}",
                    'badge' => 'PRICE MODIFIED',
                    'subtitle' => "With: {$partnerName} · ".($isPayoutAdj ? number_format($newPayout, 2).' ETB' : number_format($newCost, 2).' ETB'),
                    'timestamp' => $performedAt,
                    'actor' => $actor,
                ],
                'impact_nodes' => $impactNodes,
                'resulting_state' => [
                    'title' => 'Price Reverted',
                    'summary' => 'Agreed amount restored to '.($isPayoutAdj ? number_format($oldPayout, 2).' ETB' : number_format($oldCost, 2).' ETB').' and partner statement updated.',
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

            if ($unit->status === 'sold') {
                throw new UndoBlockedException('Cannot revert agreed price: the device has already been marked as sold.');
            }

            $oldVals = is_array($log->old_values) ? $log->old_values : [];

            $isPayoutAdj = array_key_exists('handover_payout', $oldVals);
            $oldPayout = (float) ($oldVals['handover_payout'] ?? 0);

            $isCostAdj = array_key_exists('cost_basis', $oldVals);
            $oldCost = (float) ($oldVals['cost_basis'] ?? 0);

            $updates = [];

            if ($isPayoutAdj) {
                $updates['handover_payout'] = $oldPayout > 0 ? $oldPayout : null;

                if ($unit->status === 'out') {
                    $holdingDebts = Debt::where('tenant_id', $unit->tenant_id)
                        ->where('reference_type', 'handover_holding')
                        ->where('reference_id', $unit->id)
                        ->whereIn('status', ['open', 'partially_paid'])
                        ->get();

                    foreach ($holdingDebts as $hDebt) {
                        $hDebt->original_amount = $oldPayout;
                        $hDebt->recalculateSettlement();
                    }
                }
            }

            if ($isCostAdj) {
                $updates['cost_basis'] = $oldCost;

                $payableDebts = Debt::where('tenant_id', $unit->tenant_id)
                    ->whereIn('reference_type', ['stock_intake', 'consignment_sale'])
                    ->where('reference_id', $unit->id)
                    ->whereIn('status', ['open', 'partially_paid'])
                    ->get();

                foreach ($payableDebts as $pDebt) {
                    $pDebt->original_amount = $oldCost;
                    $pDebt->recalculateSettlement();
                }
            }

            if (! empty($updates)) {
                $unit->update($updates);
            }

            // Mark audit log as reverted
            $log->update([
                'reverted_at' => now(),
                'reverted_by' => auth()->id(),
            ]);

            /** @var ProductVariant|null $variant */
            $variant = $unit->variant;
            /** @var Product|null $product */
            $product = $variant?->product;
            $pName = $product ? $product->name : 'Device';
            $ident = $unit->imei_or_serial ?: $unit->id;
            $partnerName = $unit->handover_to ?: ($unit->supplier?->name ?? 'Partner');

            // Record undo audit log
            AuditLog::record(
                action: 'undo_performed',
                entityType: 'InventoryUnit',
                entityId: (string) $unit->id,
                newValues: [
                    'original_action' => 'unit_agreed_payout_adjusted',
                    'imei_or_serial' => $ident,
                    'product_name' => $pName,
                    'partner_name' => $partnerName,
                    'handover_to' => $unit->handover_to,
                    'reverted_handover_payout' => $oldPayout,
                    'reverted_cost_basis' => $oldCost,
                    'undone_by' => auth()->user() instanceof User ? auth()->user()->name : 'Owner',
                ],
                userId: auth()->id(),
                revertGroupId: $log->revert_group_id
            );

            return "Agreed price for {$pName} ({$ident}) with {$partnerName} has been reverted to ".($isPayoutAdj ? number_format($oldPayout, 2).' ETB' : number_format($oldCost, 2).' ETB').'.';
        });
    }
}
