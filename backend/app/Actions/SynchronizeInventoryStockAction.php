<?php

namespace App\Actions;

use App\Models\InventoryStock;
use App\Models\ProductVariant;

class SynchronizeInventoryStockAction
{
    /**
     * Synchronize stock quantity on hand and ensure InventoryStock records exist for all variants.
     *
     * @return array Summary of synchronized variants
     */
    public function execute(): array
    {
        $synchronized = [];

        $variants = ProductVariant::with(['product', 'stock', 'inventoryUnits'])->get();

        foreach ($variants as $variant) {
            $product = $variant->product;
            if (! $product) {
                continue;
            }

            $inStockUnits = $variant->inventoryUnits->where('status', 'in_stock');
            $inStockCount = $inStockUnits->count();
            $avgCost = $inStockCount > 0 ? (float) $inStockUnits->avg('cost_basis') : 0.0;

            $stock = $variant->stock;

            if (! $stock) {
                $qty = $product->has_serials ? $inStockCount : 0;
                $stock = InventoryStock::create([
                    'tenant_id' => $variant->tenant_id,
                    'variant_id' => $variant->id,
                    'quantity_on_hand' => $qty,
                    'average_cost' => $avgCost,
                ]);

                $synchronized[] = [
                    'product' => $product->name,
                    'sku' => $variant->sku,
                    'action' => 'created',
                    'quantity_on_hand' => $qty,
                ];
                continue;
            }

            if ($product->has_serials) {
                if ($stock->quantity_on_hand !== $inStockCount) {
                    $oldQty = $stock->quantity_on_hand;
                    $stock->quantity_on_hand = $inStockCount;
                    if ($inStockCount > 0 && $avgCost > 0) {
                        $stock->average_cost = $avgCost;
                    }
                    $stock->save();

                    $synchronized[] = [
                        'product' => $product->name,
                        'sku' => $variant->sku,
                        'action' => 'updated_quantity',
                        'old_qty' => $oldQty,
                        'new_qty' => $inStockCount,
                    ];
                }
            } else {
                // For non-serialized items, if explicit in_stock units exist, keep them in sync
                if ($variant->inventoryUnits->isNotEmpty() && $inStockCount !== $stock->quantity_on_hand) {
                    $oldQty = $stock->quantity_on_hand;
                    $stock->quantity_on_hand = $inStockCount;
                    $stock->save();

                    $synchronized[] = [
                        'product' => $product->name,
                        'sku' => $variant->sku,
                        'action' => 'updated_non_serial_quantity',
                        'old_qty' => $oldQty,
                        'new_qty' => $inStockCount,
                    ];
                }
            }
        }

        return $synchronized;
    }
}
