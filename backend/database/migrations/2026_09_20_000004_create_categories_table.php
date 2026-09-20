<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create categories table
        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('slug', 100);
            $table->string('icon', 50)->default('tag');
            $table->text('description')->nullable();
            $table->boolean('has_serials')->default(true);
            $table->json('spec_fields')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'slug']);
            $table->index(['tenant_id', 'sort_order']);
        });

        // 2. Add category_id to products table
        Schema::table('products', function (Blueprint $table) {
            $table->foreignUuid('category_id')->nullable()->after('brand')->constrained('categories')->nullOnDelete();
        });

        // 3. Add specs JSON to product_variants table
        Schema::table('product_variants', function (Blueprint $table) {
            $table->json('specs')->nullable()->after('color');
        });

        // 4. Seed default categories for all existing tenants
        $tenants = DB::table('tenants')->get();

        $defaultCategories = [
            [
                'name' => 'Smartphones (iPhone & Android)',
                'slug' => 'smartphones',
                'icon' => 'smartphone',
                'description' => 'Apple iPhones, Samsung Galaxy, Google Pixel and flagship Android devices',
                'has_serials' => true,
                'spec_fields' => json_encode(['storage', 'ram', 'color', 'sim_type']),
                'sort_order' => 1,
            ],
            [
                'name' => 'Mac & Windows Laptops',
                'slug' => 'laptops',
                'icon' => 'laptop',
                'description' => 'Apple MacBook Air/Pro, Dell XPS, HP, Lenovo & Gaming Laptops',
                'has_serials' => true,
                'spec_fields' => json_encode(['processor', 'ram', 'storage', 'screen_size']),
                'sort_order' => 2,
            ],
            [
                'name' => 'PlayStation & Consoles',
                'slug' => 'gaming-consoles',
                'icon' => 'gamepad-2',
                'description' => 'Sony PlayStation 5, PS4, Xbox Series X/S, Nintendo Switch',
                'has_serials' => true,
                'spec_fields' => json_encode(['edition', 'storage', 'color']),
                'sort_order' => 3,
            ],
            [
                'name' => 'TVs & Smart Displays',
                'slug' => 'tvs',
                'icon' => 'tv',
                'description' => 'Samsung, LG, Sony 4K/8K OLED, QLED and Smart LED TVs',
                'has_serials' => true,
                'spec_fields' => json_encode(['screen_size', 'resolution', 'panel_type']),
                'sort_order' => 4,
            ],
            [
                'name' => 'Headsets, Earphones & Speakers',
                'slug' => 'audio',
                'icon' => 'headphones',
                'description' => 'AirPods, JBL, Sony noise-cancelling headphones and Bluetooth speakers',
                'has_serials' => true,
                'spec_fields' => json_encode(['connectivity', 'color', 'edition']),
                'sort_order' => 5,
            ],
            [
                'name' => 'Gaming Joysticks & Controllers',
                'slug' => 'joysticks',
                'icon' => 'gamepad',
                'description' => 'PS5 DualSense, Xbox wireless controllers, fight pads',
                'has_serials' => true,
                'spec_fields' => json_encode(['platform', 'color', 'connectivity']),
                'sort_order' => 6,
            ],
            [
                'name' => 'Game Discs & CDs',
                'slug' => 'game-discs',
                'icon' => 'disc',
                'description' => 'PS5, PS4, Xbox physical games (FC 25, GTA, Spider-Man)',
                'has_serials' => false,
                'spec_fields' => json_encode(['platform', 'genre', 'edition']),
                'sort_order' => 7,
            ],
            [
                'name' => 'Mac Mini & Desktops',
                'slug' => 'desktops',
                'icon' => 'monitor',
                'description' => 'Apple Mac Mini M2/M4, Mac Studio, iMac and desktop towers',
                'has_serials' => true,
                'spec_fields' => json_encode(['processor', 'memory', 'storage']),
                'sort_order' => 8,
            ],
            [
                'name' => 'Screen Protectors & Glass Covers',
                'slug' => 'screen-protectors',
                'icon' => 'shield-check',
                'description' => '9D tempered glass, privacy screen protectors, camera lens glass',
                'has_serials' => false,
                'spec_fields' => json_encode(['phone_model', 'glass_type']),
                'sort_order' => 9,
            ],
            [
                'name' => 'Wireless Chargers & Power',
                'slug' => 'chargers',
                'icon' => 'zap',
                'description' => 'MagSafe wireless chargers, fast 20W/65W adapters, power banks',
                'has_serials' => false,
                'spec_fields' => json_encode(['wattage', 'port_type', 'cable_length']),
                'sort_order' => 10,
            ],
            [
                'name' => 'Electronic Gadgets & Accessories',
                'slug' => 'gadgets',
                'icon' => 'sparkles',
                'description' => 'Smart watches, phone cases, OTG adapters, smart ring and tech gadgets',
                'has_serials' => false,
                'spec_fields' => json_encode(['type', 'color', 'compatibility']),
                'sort_order' => 11,
            ],
        ];

        foreach ($tenants as $tenant) {
            foreach ($defaultCategories as $cat) {
                $catId = (string) Str::uuid();
                DB::table('categories')->insert([
                    'id' => $catId,
                    'tenant_id' => $tenant->id,
                    'name' => $cat['name'],
                    'slug' => $cat['slug'],
                    'icon' => $cat['icon'],
                    'description' => $cat['description'],
                    'has_serials' => $cat['has_serials'],
                    'spec_fields' => $cat['spec_fields'],
                    'sort_order' => $cat['sort_order'],
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                // Migrate existing products for this tenant
                if ($cat['slug'] === 'smartphones') {
                    DB::table('products')
                        ->where('tenant_id', $tenant->id)
                        ->where(function ($q) {
                            $q->where('category', 'phones')
                              ->orWhere('category', 'smartphone');
                        })
                        ->update(['category_id' => $catId, 'category' => 'smartphones']);
                } elseif ($cat['slug'] === 'joysticks') {
                    DB::table('products')
                        ->where('tenant_id', $tenant->id)
                        ->where('category', 'gaming')
                        ->where('name', 'ilike', '%controller%')
                        ->update(['category_id' => $catId, 'category' => 'joysticks']);
                } elseif ($cat['slug'] === 'chargers') {
                    DB::table('products')
                        ->where('tenant_id', $tenant->id)
                        ->where('category', 'accessories')
                        ->where('name', 'ilike', '%power%')
                        ->update(['category_id' => $catId, 'category' => 'chargers']);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('specs');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');
        });

        Schema::dropIfExists('categories');
    }
};
