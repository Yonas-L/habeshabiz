<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_waitlist', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email');
            $table->string('phone')->nullable();
            $table->string('business_name')->nullable();
            $table->text('message')->nullable();
            $table->boolean('consented')->default(false);
            $table->string('status', 20)->default('pending');
            $table->timestamp('contacted_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'consented']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_waitlist');
    }
};
