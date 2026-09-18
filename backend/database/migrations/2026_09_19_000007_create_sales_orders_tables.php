<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('order_number')->unique();
            $table->foreignUuid('customer_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->foreignId('salesperson_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('total_amount', 14, 2);
            $table->decimal('discount_amount', 14, 2)->default(0);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->string('payment_status', 30)->default('paid'); // paid, partially_paid, unpaid
            $table->string('payment_method', 30)->default('cash'); // cash, telebirr, bank_transfer, credit
            $table->foreignUuid('financial_account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('order_date');
            $table->timestamps();

            $table->index(['tenant_id', 'order_date']);
            $table->index(['tenant_id', 'payment_status']);
            $table->index(['tenant_id', 'salesperson_id']);
        });

        Schema::create('sales_order_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('sales_order_id')->constrained('sales_orders')->cascadeOnDelete();
            $table->foreignUuid('variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->foreignUuid('inventory_unit_id')->nullable()->constrained('inventory_units')->nullOnDelete();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 14, 2);
            $table->decimal('unit_cost', 14, 2);
            $table->decimal('profit', 14, 2);
            $table->string('sourcing_type', 30)->default('internal_stock'); // internal_stock, brokered_neighbour
            $table->foreignUuid('vendor_contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->decimal('vendor_cost', 14, 2)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'sales_order_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_order_items');
        Schema::dropIfExists('sales_orders');
    }
};
