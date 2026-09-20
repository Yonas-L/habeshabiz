<?php

use App\Models\Category;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Bole Mega Electronics',
        'slug' => 'bole-mega-electronics',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yoni Owner',
        'email' => 'yoni.mega@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->seller = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husa Seller',
        'email' => 'husa.mega@example.com',
        'password' => Hash::make('password123'),
        'role' => 'salesperson',
    ]);
});

test('user can list categories with product and stock counts', function () {
    $cat = Category::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'TVs & Smart Displays',
        'slug' => 'tvs',
        'icon' => 'tv',
        'has_serials' => true,
        'spec_fields' => ['screen_size', 'resolution'],
    ]);

    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'category_id' => $cat->id,
        'category' => 'tvs',
        'name' => 'LG C3 OLED 65-inch',
        'has_serials' => true,
    ]);

    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'specs' => ['screen_size' => '65"', 'resolution' => '4K OLED'],
        'default_selling_price' => 145000.00,
    ]);

    InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $variant->id,
        'imei_or_serial' => 'LG-OLED-65-8821',
        'condition' => 'new',
        'cost_basis' => 120000.00,
        'status' => 'in_stock',
    ]);

    $response = $this->actingAs($this->owner)->getJson('/api/v1/categories');

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $data = collect($response->json('data'));
    $tvCat = $data->firstWhere('slug', 'tvs');
    expect($tvCat)->not->toBeNull();
    expect($tvCat['products_count'])->toBe(1);
    expect($tvCat['in_stock_units_count'])->toBe(1);
});

test('owner can create custom category but salesperson is forbidden (403)', function () {
    // Seller attempt
    $sellerRes = $this->actingAs($this->seller)->postJson('/api/v1/categories', [
        'name' => 'Smart Watches & Wearables',
        'icon' => 'watch',
        'has_serials' => true,
    ]);
    $sellerRes->assertStatus(403);

    // Owner attempt
    $ownerRes = $this->actingAs($this->owner)->postJson('/api/v1/categories', [
        'name' => 'Smart Watches & Wearables',
        'icon' => 'watch',
        'has_serials' => true,
        'spec_fields' => ['case_size', 'connectivity'],
    ]);

    $ownerRes->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.name', 'Smart Watches & Wearables')
        ->assertJsonPath('data.has_serials', true);

    expect(Category::where('slug', 'smart-watches-wearables')->exists())->toBeTrue();
});

test('owner can create product with custom category and variants with dynamic specs', function () {
    $cat = Category::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'PlayStation & Consoles',
        'slug' => 'gaming-consoles',
        'icon' => 'gamepad-2',
        'has_serials' => true,
    ]);

    $response = $this->actingAs($this->owner)->postJson('/api/v1/products', [
        'name' => 'Sony PlayStation 5 Slim',
        'brand' => 'Sony',
        'category_id' => $cat->id,
        'variants' => [
            [
                'storage' => '1TB',
                'color' => 'White',
                'specs' => ['edition' => 'Disc Edition', 'region' => 'Middle East'],
                'default_selling_price' => 78000.00,
            ],
            [
                'storage' => '1TB',
                'color' => 'White',
                'specs' => ['edition' => 'Digital Edition', 'region' => 'USA'],
                'default_selling_price' => 69000.00,
            ],
        ],
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.name', 'Sony PlayStation 5 Slim')
        ->assertJsonPath('data.category', 'gaming-consoles');

    $product = Product::where('name', 'Sony PlayStation 5 Slim')->first();
    expect($product->variants)->toHaveCount(2);
    expect($product->variants[0]->specs['edition'])->toBe('Disc Edition');
});

test('owner can add a new variant with custom specs to an existing product', function () {
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Apple MacBook Pro 16-inch',
        'category' => 'laptops',
        'has_serials' => true,
    ]);

    $response = $this->actingAs($this->owner)->postJson("/api/v1/products/{$product->id}/variants", [
        'storage' => '1TB SSD',
        'ram' => '36GB',
        'color' => 'Space Black',
        'specs' => ['processor' => 'M3 Max 14-core', 'screen' => '16.2-inch Liquid Retina XDR'],
        'default_selling_price' => 380000.00,
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true);

    expect($product->variants()->count())->toBe(1);
    $variant = $product->variants()->first();
    expect($variant->specs['processor'])->toBe('M3 Max 14-core');
    expect($variant->color)->toBe('Space Black');
});

test('bulk serialized intake creates individual units and updates inventory stock', function () {
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 16 Pro',
        'category' => 'smartphones',
        'has_serials' => true,
    ]);

    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'storage' => '256GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 165000.00,
    ]);

    // Intake 3 units at once by providing multiple IMEIs
    $imeis = [
        '359871109911111',
        '359871109922222',
        '359871109933333',
    ];

    $response = $this->actingAs($this->owner)->postJson('/api/v1/inventory/units', [
        'variant_id' => $variant->id,
        'imeis' => $imeis,
        'battery_health' => 100,
        'condition' => 'new',
        'cost_basis' => 140000.00,
        'location' => 'Shop Counter',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('units_created', 3);

    expect(InventoryUnit::where('variant_id', $variant->id)->count())->toBe(3);

    $stock = InventoryStock::where('variant_id', $variant->id)->first();
    expect($stock->quantity_on_hand)->toBe(3);
    expect((float) $stock->average_cost)->toBe(140000.0);
});

test('batch intake for non-serialized items creates quantity units and tracks stock', function () {
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro Max 9D Privacy Glass',
        'category' => 'screen-protectors',
        'has_serials' => false,
    ]);

    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'color' => 'Privacy Matte',
        'specs' => ['glass_type' => '9D Edge-to-Edge Privacy'],
        'default_selling_price' => 800.00,
    ]);

    // Intake batch of 50 screen protectors
    $response = $this->actingAs($this->owner)->postJson('/api/v1/inventory/units', [
        'variant_id' => $variant->id,
        'quantity' => 50,
        'condition' => 'new',
        'cost_basis' => 300.00,
        'selling_price' => 850.00,
        'location' => 'Accessory Display Wall',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('units_created', 50);

    expect(InventoryUnit::where('variant_id', $variant->id)->count())->toBe(50);
    $stock = InventoryStock::where('variant_id', $variant->id)->first();
    expect($stock->quantity_on_hand)->toBe(50);
    expect((float) $stock->average_cost)->toBe(300.0);
    expect((float) $variant->fresh()->default_selling_price)->toBe(850.0);
});
