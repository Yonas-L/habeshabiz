<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 30); // bank, mobile_money, cash, asset_gold, asset_fx
            $table->string('account_number')->nullable();
            $table->string('currency', 10)->default('ETB');
            $table->decimal('current_balance', 16, 2)->default(0);
            $table->boolean('is_custom_asset')->default(false);
            $table->jsonb('asset_details')->nullable(); // e.g. {"grams": 40, "karat": 21, "usd": 11800, "usdt": 720}
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'type']);
            $table->index(['tenant_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_accounts');
    }
};
