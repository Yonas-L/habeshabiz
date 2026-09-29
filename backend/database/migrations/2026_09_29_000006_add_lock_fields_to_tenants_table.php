<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->boolean('is_locked')->default(false)->after('is_active');
            $table->string('lock_reason')->nullable()->after('is_locked');
            $table->timestamp('locked_at')->nullable()->after('lock_reason');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['is_locked', 'lock_reason', 'locked_at']);
        });
    }
};
