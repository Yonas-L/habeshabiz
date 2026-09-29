<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_signup_attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email');
            $table->string('business_name')->nullable();
            $table->string('outcome', 20); // success, waitlisted, opted_out
            $table->timestamp('created_at')->useCurrent();

            $table->index(['created_at', 'outcome']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_signup_attempts');
    }
};
