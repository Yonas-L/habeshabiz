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
        if (Schema::hasTable('expenses') && ! Schema::hasColumn('expenses', 'payment_splits')) {
            Schema::table('expenses', function (Blueprint $table) {
                $table->json('payment_splits')->nullable()->after('financial_account_id');
            });
        }

        if (Schema::hasTable('inventory_units') && ! Schema::hasColumn('inventory_units', 'payment_splits')) {
            Schema::table('inventory_units', function (Blueprint $table) {
                $table->json('payment_splits')->nullable()->after('payment_account_id');
            });
        }

        if (Schema::hasTable('maintenance_records') && ! Schema::hasColumn('maintenance_records', 'payment_splits')) {
            Schema::table('maintenance_records', function (Blueprint $table) {
                $table->json('payment_splits')->nullable()->after('financial_account_id');
            });
        }

        if (Schema::hasTable('debt_payments') && ! Schema::hasColumn('debt_payments', 'split_group_id')) {
            Schema::table('debt_payments', function (Blueprint $table) {
                $table->uuid('split_group_id')->nullable()->after('debt_id')->index();
            });
        }

        if (Schema::hasTable('sales_orders') && ! Schema::hasColumn('sales_orders', 'payment_splits')) {
            Schema::table('sales_orders', function (Blueprint $table) {
                $table->json('payment_splits')->nullable()->after('financial_account_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('expenses') && Schema::hasColumn('expenses', 'payment_splits')) {
            Schema::table('expenses', function (Blueprint $table) {
                $table->dropColumn('payment_splits');
            });
        }

        if (Schema::hasTable('inventory_units') && Schema::hasColumn('inventory_units', 'payment_splits')) {
            Schema::table('inventory_units', function (Blueprint $table) {
                $table->dropColumn('payment_splits');
            });
        }

        if (Schema::hasTable('maintenance_records') && Schema::hasColumn('maintenance_records', 'payment_splits')) {
            Schema::table('maintenance_records', function (Blueprint $table) {
                $table->dropColumn('payment_splits');
            });
        }

        if (Schema::hasTable('debt_payments') && Schema::hasColumn('debt_payments', 'split_group_id')) {
            Schema::table('debt_payments', function (Blueprint $table) {
                $table->dropColumn('split_group_id');
            });
        }

        if (Schema::hasTable('sales_orders') && Schema::hasColumn('sales_orders', 'payment_splits')) {
            Schema::table('sales_orders', function (Blueprint $table) {
                $table->dropColumn('payment_splits');
            });
        }
    }
};
