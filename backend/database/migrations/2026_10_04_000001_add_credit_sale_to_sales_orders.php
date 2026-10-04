<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('sales_orders', 'credit_sale')) {
                $table->boolean('credit_sale')->default(false)->after('payment_status');
                $table->index(['tenant_id', 'credit_sale']);
            }
        });

        // Preserve the meaning of historical unpaid/partially-paid sales.
        DB::table('sales_orders')
            ->whereColumn('paid_amount', '<', DB::raw('GREATEST(0, total_amount - discount_amount - exchange_allowance)'))
            ->update(['credit_sale' => true]);
    }

    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            if (Schema::hasColumn('sales_orders', 'credit_sale')) {
                $table->dropIndex(['tenant_id', 'credit_sale']);
                $table->dropColumn('credit_sale');
            }
        });
    }
};
