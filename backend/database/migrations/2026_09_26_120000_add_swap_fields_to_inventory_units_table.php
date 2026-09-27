<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->boolean('is_swapped')->default(false)->after('is_repaired');
            $table->timestamp('swapped_at')->nullable()->after('is_swapped');
            $table->foreignUuid('swapped_sales_order_id')->nullable()->after('swapped_at')->constrained('sales_orders')->nullOnDelete();
            $table->foreignUuid('swapped_from_unit_id')->nullable()->after('swapped_sales_order_id')->constrained('inventory_units')->nullOnDelete();
            $table->foreignUuid('swapped_replacement_unit_id')->nullable()->after('swapped_from_unit_id')->constrained('inventory_units')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->dropForeign(['swapped_sales_order_id']);
            $table->dropForeign(['swapped_from_unit_id']);
            $table->dropForeign(['swapped_replacement_unit_id']);
            $table->dropColumn([
                'is_swapped',
                'swapped_at',
                'swapped_sales_order_id',
                'swapped_from_unit_id',
                'swapped_replacement_unit_id',
            ]);
        });
    }
};
