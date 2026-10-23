<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('statement_token', 64)->nullable()->unique()->after('notes');
        });

        // Backfill existing contacts with unique random tokens
        $contacts = DB::table('contacts')->get(['id']);
        foreach ($contacts as $contact) {
            DB::table('contacts')
                ->where('id', $contact->id)
                ->update(['statement_token' => Str::random(32)]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropColumn('statement_token');
        });
    }
};
