<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            if (! Schema::hasColumn('inventory_units', 'serial_number')) {
                $table->string('serial_number', 100)->nullable()->after('imei_or_serial');
                $table->index(['tenant_id', 'serial_number']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventory_units', function (Blueprint $table) {
            if (Schema::hasColumn('inventory_units', 'serial_number')) {
                $table->dropIndex(['tenant_id', 'serial_number']);
                $table->dropColumn('serial_number');
            }
        });
    }
};
