<?php

use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\SalesOrderItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // 1. Identify all tenant/name combinations with duplicates among active products
            $duplicateGroups = DB::table('products')
                ->selectRaw('tenant_id, LOWER(TRIM(name)) as lower_name, count(*) as count')
                ->whereNull('deleted_at')
                ->groupBy('tenant_id', DB::raw('LOWER(TRIM(name))'))
                ->havingRaw('count(*) > 1')
                ->get();

            foreach ($duplicateGroups as $group) {
                // Fetch all products matching this lower_name, ordered by oldest created
                $products = Product::with(['variants.stock'])
                    ->where('tenant_id', $group->tenant_id)
                    ->whereNull('deleted_at')
                    ->whereRaw('LOWER(TRIM(name)) = ?', [$group->lower_name])
                    ->orderBy('created_at', 'asc')
                    ->get();

                if ($products->count() <= 1) {
                    continue;
                }

                $canonicalProduct = $products->first();
                $duplicateProducts = $products->slice(1);

                foreach ($duplicateProducts as $dupProduct) {
                    // Inherit valid brand if canonical product brand is missing or mismatched
                    if ((empty($canonicalProduct->brand) || ($canonicalProduct->brand === 'Samsung' && str_contains(strtolower($canonicalProduct->name), 'iphone'))) && ! empty($dupProduct->brand) && $dupProduct->brand !== 'Samsung') {
                        $canonicalProduct->brand = $dupProduct->brand;
                        $canonicalProduct->save();
                    }

                    // Reassign proforma invoice items
                    DB::table('proforma_invoice_items')
                        ->where('product_id', $dupProduct->id)
                        ->update(['product_id' => $canonicalProduct->id]);

                    foreach ($dupProduct->variants as $dupVariant) {
                        // Check if canonical product already has an identical variant
                        $identicalVariant = $canonicalProduct->variants->first(function ($cv) use ($dupVariant) {
                            $storageMatch = trim(strtolower($cv->storage ?? '')) === trim(strtolower($dupVariant->storage ?? ''));
                            $ramMatch = trim(strtolower($cv->ram ?? '')) === trim(strtolower($dupVariant->ram ?? ''));
                            $colorMatch = trim(strtolower($cv->color ?? '')) === trim(strtolower($dupVariant->color ?? ''));
                            $specsMatch = json_encode($cv->specs ?? []) === json_encode($dupVariant->specs ?? []);

                            return $storageMatch && $ramMatch && $colorMatch && $specsMatch;
                        });

                        if ($identicalVariant) {
                            // Point inventory units to the identical canonical variant
                            InventoryUnit::where('variant_id', $dupVariant->id)
                                ->update(['variant_id' => $identicalVariant->id]);

                            // Point sales order items to the identical canonical variant
                            SalesOrderItem::where('variant_id', $dupVariant->id)
                                ->update(['variant_id' => $identicalVariant->id]);

                            // Point proforma invoice items to the identical canonical variant
                            DB::table('proforma_invoice_items')
                                ->where('variant_id', $dupVariant->id)
                                ->update(['variant_id' => $identicalVariant->id]);

                            // Merge stock quantities
                            $dupStock = InventoryStock::where('variant_id', $dupVariant->id)->first();
                            if ($dupStock) {
                                $canonicalStock = InventoryStock::where('variant_id', $identicalVariant->id)->first();
                                if ($canonicalStock) {
                                    $canonicalStock->quantity_on_hand += $dupStock->quantity_on_hand;
                                    $canonicalStock->save();
                                }
                                $dupStock->delete();
                            }

                            // Delete duplicate variant
                            $dupVariant->forceDelete();
                        } else {
                            // Reassign distinct variant to canonical product
                            $dupVariant->product_id = $canonicalProduct->id;
                            $dupVariant->save();

                            // Add to memory list of canonical variants
                            $canonicalProduct->variants->push($dupVariant);
                        }
                    }

                    // Delete the now empty duplicate product
                    $dupProduct->forceDelete();
                }
            }
        });

        // 2. Add partial unique index on (tenant_id, LOWER(TRIM(name))) where deleted_at IS NULL
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_lower_name_unique ON products (tenant_id, LOWER(TRIM(name))) WHERE deleted_at IS NULL;');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS products_tenant_lower_name_unique;');
    }
};
