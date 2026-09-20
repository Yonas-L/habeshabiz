<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->string('handover_to', 100)->nullable()->after('location');
            $table->timestamp('handed_out_at')->nullable()->after('handover_to');
            $table->text('return_reason')->nullable()->after('notes');
            $table->timestamp('returned_at')->nullable()->after('return_reason');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            $table->dropColumn(['handover_to', 'handed_out_at', 'return_reason', 'returned_at']);
        });
    }
};
