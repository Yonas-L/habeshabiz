<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('contact_id')->constrained('contacts')->cascadeOnDelete();
            $table->string('type', 20); // receivable, payable
            $table->string('reference_type', 40)->default('direct_credit'); // sales_order, brokered_sourcing, purchase, direct_credit
            $table->uuid('reference_id')->nullable();
            $table->decimal('original_amount', 14, 2);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('remaining_amount', 14, 2);
            $table->date('due_date')->nullable();
            $table->string('status', 30)->default('open'); // open, partially_paid, settled, disputed_loss
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'type', 'status']);
            $table->index(['tenant_id', 'contact_id']);
        });

        Schema::create('debt_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('debt_id')->constrained('debts')->cascadeOnDelete();
            $table->foreignUuid('financial_account_id')->constrained('financial_accounts')->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->timestamp('payment_date');
            $table->string('reference_number')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'debt_id']);
            $table->index(['tenant_id', 'financial_account_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('debt_payments');
        Schema::dropIfExists('debts');
    }
};
