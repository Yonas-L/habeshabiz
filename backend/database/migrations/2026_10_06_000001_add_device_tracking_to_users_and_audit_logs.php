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
        Schema::table('users', function (Blueprint $table) {
            $table->string('last_device', 100)->nullable()->after('is_active');
            $table->string('last_device_type', 30)->nullable()->after('last_device'); // desktop, mobile, tablet
            $table->string('last_browser', 50)->nullable()->after('last_device_type');
            $table->string('last_login_ip', 45)->nullable()->after('last_browser');
            $table->timestamp('last_login_at')->nullable()->after('last_login_ip');
        });

        if (Schema::hasTable('audit_logs') && !Schema::hasColumn('audit_logs', 'user_agent')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->string('user_agent', 255)->nullable()->after('ip_address');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'last_device',
                'last_device_type',
                'last_browser',
                'last_login_ip',
                'last_login_at',
            ]);
        });

        if (Schema::hasTable('audit_logs') && Schema::hasColumn('audit_logs', 'user_agent')) {
            Schema::table('audit_logs', function (Blueprint $table) {
                $table->dropColumn('user_agent');
            });
        }
    }
};
