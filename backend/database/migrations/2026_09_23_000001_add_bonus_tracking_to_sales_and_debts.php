<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->decimal('setted_price', 14, 2)->nullable()->after('unit_price');
            $table->decimal('bonus_amount', 14, 2)->default(0)->after('profit');
        });

        Schema::table('sales_orders', function (Blueprint $table) {
            $table->decimal('total_bonus_amount', 14, 2)->default(0)->after('discount_amount');
        });

        Schema::table('debts', function (Blueprint $table) {
            $table->foreignId('salesperson_id')->nullable()->after('contact_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('debts', function (Blueprint $table) {
            $table->dropForeign(['salesperson_id']);
            $table->dropColumn('salesperson_id');
        });

        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropColumn('total_bonus_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn(['setted_price', 'bonus_amount']);
        });
    }
};
