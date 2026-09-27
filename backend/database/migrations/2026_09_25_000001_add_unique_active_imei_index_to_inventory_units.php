<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Enforce unique IMEI/Serial for active inventory units per tenant
        DB::statement("
            CREATE UNIQUE INDEX inventory_units_tenant_active_imei_unique 
            ON inventory_units (tenant_id, imei_or_serial) 
            WHERE imei_or_serial IS NOT NULL 
              AND status IN ('in_stock', 'reserved', 'out') 
              AND deleted_at IS NULL;
        ");
    }

    public function down(): void
    {
        DB::statement("DROP INDEX IF EXISTS inventory_units_tenant_active_imei_unique;");
    }
};
