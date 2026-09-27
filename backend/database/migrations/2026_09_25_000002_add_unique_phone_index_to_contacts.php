<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Enforce unique phone number per tenant for active contacts
        DB::statement("
            CREATE UNIQUE INDEX contacts_tenant_phone_unique 
            ON contacts (tenant_id, phone) 
            WHERE phone IS NOT NULL 
              AND deleted_at IS NULL;
        ");
    }

    public function down(): void
    {
        DB::statement("DROP INDEX IF EXISTS contacts_tenant_phone_unique;");
    }
};
