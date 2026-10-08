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
        if (Schema::hasTable('debts') && ! Schema::hasColumn('debts', 'payment_splits')) {
            Schema::table('debts', function (Blueprint $table) {
                $table->json('payment_splits')->nullable()->after('notes');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('debts') && Schema::hasColumn('debts', 'payment_splits')) {
            Schema::table('debts', function (Blueprint $table) {
                $table->dropColumn('payment_splits');
            });
        }
    }
};
