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
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->uuid('revert_group_id')->nullable()->index()->after('entity_id');
            $table->timestamp('reverted_at')->nullable()->after('user_agent');
            $table->foreignId('reverted_by')->nullable()->after('reverted_at')->constrained('users')->nullOnDelete();

            $table->index(['tenant_id', 'revert_group_id']);
            $table->index(['tenant_id', 'reverted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'revert_group_id']);
            $table->dropIndex(['tenant_id', 'reverted_at']);
            $table->dropConstrainedForeignId('reverted_by');
            $table->dropColumn(['revert_group_id', 'reverted_at']);
        });
    }
};
