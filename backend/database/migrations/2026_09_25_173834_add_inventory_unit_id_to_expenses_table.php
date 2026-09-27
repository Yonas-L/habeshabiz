<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignUuid('inventory_unit_id')->nullable()->after('financial_account_id')->constrained('inventory_units')->nullOnDelete();
            $table->index(['tenant_id', 'inventory_unit_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['inventory_unit_id']);
            $table->dropIndex(['tenant_id', 'inventory_unit_id']);
            $table->dropColumn('inventory_unit_id');
        });
    }
};
