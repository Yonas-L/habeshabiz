<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('sales_orders', 'write_off_amount')) {
                $table->decimal('write_off_amount', 15, 2)->default(0)->after('discount_amount');
                $table->index(['tenant_id', 'write_off_amount']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            if (Schema::hasColumn('sales_orders', 'write_off_amount')) {
                $table->dropIndex(['tenant_id', 'write_off_amount']);
                $table->dropColumn('write_off_amount');
            }
        });
    }
};
