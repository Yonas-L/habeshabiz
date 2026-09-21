<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->decimal('handover_payout', 14, 2)->nullable()->after('return_deadline');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->dropColumn('handover_payout');
        });
    }
};
