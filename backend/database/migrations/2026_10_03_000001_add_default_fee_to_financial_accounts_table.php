<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_accounts', function (Blueprint $table) {
            if (! Schema::hasColumn('financial_accounts', 'default_fee_type')) {
                $table->string('default_fee_type', 20)->nullable()->default('none')->after('current_balance');
            }
            if (! Schema::hasColumn('financial_accounts', 'default_fee_amount')) {
                $table->decimal('default_fee_amount', 16, 4)->nullable()->default(0)->after('default_fee_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('financial_accounts', function (Blueprint $table) {
            if (Schema::hasColumn('financial_accounts', 'default_fee_amount')) {
                $table->dropColumn('default_fee_amount');
            }
            if (Schema::hasColumn('financial_accounts', 'default_fee_type')) {
                $table->dropColumn('default_fee_type');
            }
        });
    }
};
