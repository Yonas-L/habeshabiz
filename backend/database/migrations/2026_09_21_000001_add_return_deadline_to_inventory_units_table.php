<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->date('return_deadline')->nullable()->after('returned_at');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->dropColumn('return_deadline');
        });
    }
};
