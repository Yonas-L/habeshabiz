<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proforma_invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('proforma_number');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('customer_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->string('customer_name');
            $table->string('customer_phone', 50)->nullable();
            $table->string('customer_email')->nullable();
            $table->string('customer_address')->nullable();
            $table->string('customer_tin', 50)->nullable();
            $table->date('issue_date');
            $table->date('valid_until')->nullable();
            $table->string('currency', 10)->default('ETB');
            $table->string('status', 30)->default('draft'); // draft, sent, accepted, expired, converted_to_sale
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('discount_total', 14, 2)->default(0);
            $table->decimal('taxable_amount', 14, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->default(15.00);
            $table->decimal('vat_total', 14, 2)->default(0);
            $table->decimal('withholding_rate', 5, 2)->default(0); // 1.50 for standard Ethiopian WHT
            $table->decimal('withholding_total', 14, 2)->default(0);
            $table->decimal('shipping_fee', 14, 2)->default(0);
            $table->decimal('total_amount', 14, 2)->default(0); // Gross amount with VAT + shipping
            $table->decimal('net_payable', 14, 2)->default(0); // Total amount - withholding_total
            $table->string('payment_terms')->nullable();
            $table->string('payment_method')->nullable();
            $table->foreignUuid('bank_account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->string('reference_number')->nullable();
            $table->string('prepared_by')->nullable();
            $table->text('notes')->nullable();
            $table->text('delivery_terms')->nullable();
            $table->json('signature_stamp_config')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'proforma_number']);
            $table->index(['tenant_id', 'issue_date']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('proforma_invoice_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('proforma_invoice_id')->constrained('proforma_invoices')->cascadeOnDelete();
            $table->integer('item_number')->default(1);
            $table->foreignUuid('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignUuid('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->text('description');
            $table->string('sku')->nullable();
            $table->string('unit_of_measure', 30)->default('Pcs');
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 14, 2)->default(0);
            $table->string('discount_type', 20)->default('percentage'); // percentage, fixed
            $table->decimal('discount_rate', 8, 2)->default(0);
            $table->decimal('discount_amount', 14, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(15.00);
            $table->decimal('taxable_amount', 14, 2)->default(0);
            $table->decimal('tax_amount', 14, 2)->default(0);
            $table->decimal('line_total', 14, 2)->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'proforma_invoice_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proforma_invoice_items');
        Schema::dropIfExists('proforma_invoices');
    }
};
