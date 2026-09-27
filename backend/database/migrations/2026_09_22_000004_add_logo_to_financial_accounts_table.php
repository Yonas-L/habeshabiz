<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_accounts', function (Blueprint $table) {
            if (! Schema::hasColumn('financial_accounts', 'logo')) {
                $table->text('logo')->nullable()->after('currency');
            }
        });
    }

    public function down(): void
    {
        Schema::table('financial_accounts', function (Blueprint $table) {
            if (Schema::hasColumn('financial_accounts', 'logo')) {
                $table->dropColumn('logo');
            }
        });
    }
};
