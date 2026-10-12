<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Synchronize historical sales_order_items variant_id where the underlying inventory unit
        // was updated but the sales order item still referenced the old variant.
        DB::statement("
            UPDATE sales_order_items soi
            SET variant_id = iu.variant_id
            FROM inventory_units iu
            WHERE soi.inventory_unit_id = iu.id
              AND soi.variant_id != iu.variant_id
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data synchronization is irreversible and preserves canonical unit variant references.
    }
};
