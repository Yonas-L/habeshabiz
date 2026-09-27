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
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->foreignUuid('exchange_sales_order_id')->nullable()->after('supplier_contact_id')->constrained('sales_orders')->nullOnDelete();
        });

        Schema::table('sales_orders', function (Blueprint $table) {
            $table->decimal('exchange_allowance', 14, 2)->default(0)->after('discount_amount');
            $table->foreignUuid('exchange_unit_id')->nullable()->after('financial_account_id')->constrained('inventory_units')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropForeign(['exchange_unit_id']);
            $table->dropColumn(['exchange_allowance', 'exchange_unit_id']);
        });

        Schema::table('inventory_units', function (Blueprint $table) {
            $table->dropForeign(['exchange_sales_order_id']);
            $table->dropColumn('exchange_sales_order_id');
        });
    }
};
