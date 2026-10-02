<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'is_archived')) {
                $table->boolean('is_archived')->default(false)->after('is_active');
                $table->index('is_archived');
            }
        });

        Schema::table('inventory_units', function (Blueprint $table) {
            if (!Schema::hasColumn('inventory_units', 'funding_source')) {
                $table->string('funding_source', 50)->nullable()->after('source_type');
            }
            if (!Schema::hasColumn('inventory_units', 'payment_account_id')) {
                $table->foreignUuid('payment_account_id')->nullable()->constrained('financial_accounts')->nullOnDelete()->after('funding_source');
            }
            if (!Schema::hasColumn('inventory_units', 'receivable_contact_id')) {
                $table->foreignUuid('receivable_contact_id')->nullable()->constrained('contacts')->nullOnDelete()->after('payment_account_id');
            }
            if (!Schema::hasColumn('inventory_units', 'receivable_offset_amount')) {
                $table->decimal('receivable_offset_amount', 15, 2)->default(0)->after('receivable_contact_id');
            }
        });

        Schema::table('sales_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('sales_orders', 'is_vendor_sourced')) {
                $table->boolean('is_vendor_sourced')->default(false)->after('status');
            }
            if (!Schema::hasColumn('sales_orders', 'vendor_contact_id')) {
                $table->foreignUuid('vendor_contact_id')->nullable()->constrained('contacts')->nullOnDelete()->after('is_vendor_sourced');
            }
            if (!Schema::hasColumn('sales_orders', 'vendor_cost_basis')) {
                $table->decimal('vendor_cost_basis', 15, 2)->nullable()->after('vendor_contact_id');
            }
            if (!Schema::hasColumn('sales_orders', 'vendor_payment_status')) {
                $table->string('vendor_payment_status', 30)->nullable()->after('vendor_cost_basis');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'is_archived')) {
                $table->dropIndex(['is_archived']);
                $table->dropColumn('is_archived');
            }
        });

        Schema::table('inventory_units', function (Blueprint $table) {
            if (Schema::hasColumn('inventory_units', 'payment_account_id')) {
                $table->dropConstrainedForeignId('payment_account_id');
            }
            if (Schema::hasColumn('inventory_units', 'receivable_contact_id')) {
                $table->dropConstrainedForeignId('receivable_contact_id');
            }
            if (Schema::hasColumn('inventory_units', 'funding_source')) {
                $table->dropColumn('funding_source');
            }
            if (Schema::hasColumn('inventory_units', 'receivable_offset_amount')) {
                $table->dropColumn('receivable_offset_amount');
            }
        });

        Schema::table('sales_orders', function (Blueprint $table) {
            if (Schema::hasColumn('sales_orders', 'vendor_contact_id')) {
                $table->dropConstrainedForeignId('vendor_contact_id');
            }
            $colsToDrop = [];
            foreach (['is_vendor_sourced', 'vendor_cost_basis', 'vendor_payment_status'] as $col) {
                if (Schema::hasColumn('sales_orders', $col)) {
                    $colsToDrop[] = $col;
                }
            }
            if (!empty($colsToDrop)) {
                $table->dropColumn($colsToDrop);
            }
        });
    }
};
