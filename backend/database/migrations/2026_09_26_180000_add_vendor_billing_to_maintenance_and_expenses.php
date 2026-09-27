<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_records', function (Blueprint $table) {
            $table->string('billing_type', 30)->default('shop')->after('is_capitalized');
            $table->foreignUuid('vendor_contact_id')->nullable()->after('billing_type')->constrained('contacts')->nullOnDelete();
            $table->foreignUuid('vendor_debt_id')->nullable()->after('vendor_contact_id')->constrained('debts')->nullOnDelete();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->string('vendor_billing', 30)->nullable()->after('inventory_unit_id');
            $table->foreignUuid('vendor_contact_id')->nullable()->after('vendor_billing')->constrained('contacts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['vendor_contact_id']);
            $table->dropColumn(['vendor_billing', 'vendor_contact_id']);
        });

        Schema::table('maintenance_records', function (Blueprint $table) {
            $table->dropForeign(['vendor_contact_id']);
            $table->dropForeign(['vendor_debt_id']);
            $table->dropColumn(['billing_type', 'vendor_contact_id', 'vendor_debt_id']);
        });
    }
};
