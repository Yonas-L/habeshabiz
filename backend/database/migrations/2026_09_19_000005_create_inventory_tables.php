<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_units', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->string('imei_or_serial')->nullable();
            $table->integer('battery_health')->nullable();
            $table->integer('cycle_count')->nullable();
            $table->string('sim_type', 30)->default('physical'); // physical, esim, dual
            $table->string('condition', 50)->default('new'); // new, used_clean, backcrack, demo_locked
            $table->decimal('cost_basis', 14, 2);
            $table->string('status', 30)->default('in_stock'); // in_stock, reserved, sold, damaged, returned
            $table->string('source_type', 30)->default('purchase'); // purchase, consignment
            $table->foreignUuid('supplier_contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->string('location', 100)->default('Shop Counter');
            $table->text('notes')->nullable();
            $table->timestamp('sold_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'imei_or_serial']);
            $table->index(['tenant_id', 'variant_id']);
        });

        Schema::create('inventory_stocks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->integer('quantity_on_hand')->default(0);
            $table->decimal('average_cost', 14, 2)->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'variant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_stocks');
        Schema::dropIfExists('inventory_units');
    }
};
