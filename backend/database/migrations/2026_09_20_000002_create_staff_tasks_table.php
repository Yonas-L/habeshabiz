<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->boolean('is_completed')->default(false);
            $table->string('priority', 20)->default('normal'); // high, normal, low
            $table->date('due_date')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'is_completed']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_tasks');
    }
};
