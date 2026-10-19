<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->boolean('is_accessory')->default(false)->after('inventory_unit_id');
            $table->string('accessory_name', 150)->nullable()->after('is_accessory');
            $table->foreignUuid('parent_item_id')
                ->nullable()
                ->after('accessory_name')
                ->constrained('sales_order_items')
                ->nullOnDelete();

            $table->index(['tenant_id', 'is_accessory']);
        });
    }

    public function down(): void
    {
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropForeign(['parent_item_id']);
            $table->dropIndex(['tenant_id', 'is_accessory']);
            $table->dropColumn(['is_accessory', 'accessory_name', 'parent_item_id']);
        });
    }
};
