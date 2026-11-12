<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Remove noise FinancialAccount attribute modification logs
        DB::table('audit_logs')->where('entity_type', 'FinancialAccount')->delete();

        // Also purge any lingering data:image base64 strings from audit_logs
        DB::statement("DELETE FROM audit_logs WHERE CAST(new_values AS text) LIKE '%data:image%' OR CAST(old_values AS text) LIKE '%data:image%'");
    }

    public function down(): void
    {
        // One-way cleanup of bloated technical noise
    }
};
