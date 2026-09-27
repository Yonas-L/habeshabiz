<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->boolean('is_repaired')->default(false)->after('status');
            $table->index(['tenant_id', 'is_repaired']);
        });

        // Backfill units that already have maintenance records
        DB::statement('UPDATE inventory_units SET is_repaired = true WHERE id IN (SELECT DISTINCT inventory_unit_id FROM maintenance_records WHERE inventory_unit_id IS NOT NULL)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'is_repaired']);
            $table->dropColumn('is_repaired');
        });
    }
};
