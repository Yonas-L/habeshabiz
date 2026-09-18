<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('transaction_number')->unique();
            $table->foreignUuid('source_account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->foreignUuid('destination_account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->string('type', 30); // income, expense, transfer, customer_payment, supplier_payment, owner_draw, valuation_adjustment
            $table->decimal('amount', 14, 2);
            $table->decimal('fee', 10, 2)->default(0);
            $table->string('reference_number')->nullable();
            $table->foreignUuid('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->text('description')->nullable();
            $table->timestamp('date');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'date']);
            $table->index(['tenant_id', 'type']);
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('financial_account_id')->constrained('financial_accounts')->cascadeOnDelete();
            $table->string('category', 50)->default('other'); // ride, food, rent, utilities, maintenance, personal_owner_draw, other
            $table->decimal('amount', 14, 2);
            $table->boolean('is_owner_draw')->default(false);
            $table->string('description');
            $table->timestamp('date');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'date']);
            $table->index(['tenant_id', 'category']);
            $table->index(['tenant_id', 'is_owner_draw']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('financial_transactions');
    }
};
