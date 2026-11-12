<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_logos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('category', 50)->default('bank')->index();
            $table->string('name')->nullable();
            $table->longText('logo_url');
            $table->integer('sort_order')->default(0)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_logos');
    }
};
