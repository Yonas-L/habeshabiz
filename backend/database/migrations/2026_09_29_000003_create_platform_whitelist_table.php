<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_whitelist', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email')->unique()->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamp('used_at')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('platform_admins')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_whitelist');
    }
};
