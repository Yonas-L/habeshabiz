<?php

use App\Actions\RecordSaleAction;
use App\Models\Contact;
use App\Models\FinancialAccount;
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
        'name' => 'Bole Tech Hub',
        'slug' => 'bole-tech-hub-test-sync',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->user = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yoni',
        'email' => 'yoni_sync@example.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);

    $this->actingAs($this->user);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Cash Drawer',
        'type' => 'cash',
        'current_balance' => 50000.00,
    ]);
});

test('non-serialized sale decrements inventory_stock and marks matching inventory_units as sold', function () {
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Fast Charger 45W',
        'category' => 'accessories',
        'has_serials' => false,
    ]);

    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'color' => 'Black',
        'default_selling_price' => 1500.00,
    ]);

    // Create 3 unit records with imei = null (intake behavior)
    for ($i = 0; $i < 3; $i++) {
        InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $variant->id,
            'imei_or_serial' => null,
            'condition' => 'new',
            'cost_basis' => 800.00,
            'status' => 'in_stock',
        ]);
    }

    // Set stock record
    InventoryStock::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $variant->id,
        'quantity_on_hand' => 3,
        'average_cost' => 800.00,
    ]);

    $action = new RecordSaleAction;
    $order = $action->execute([
        'paid_amount' => 3000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $variant->id,
                'quantity' => 2,
                'unit_price' => 1500.00,
                'sourcing_type' => 'internal_stock',
            ],
        ],
    ]);

    expect($order->payment_status)->toBe('paid');

    // InventoryStock must be decremented from 3 to 1
    $stock = InventoryStock::where('variant_id', $variant->id)->first();
    expect($stock->quantity_on_hand)->toBe(1);

    // Exactly 2 InventoryUnit records must be marked sold, and 1 remains in_stock
    $soldUnitsCount = InventoryUnit::where('variant_id', $variant->id)->where('status', 'sold')->count();
    $inStockUnitsCount = InventoryUnit::where('variant_id', $variant->id)->where('status', 'in_stock')->count();

    expect($soldUnitsCount)->toBe(2);
    expect($inStockUnitsCount)->toBe(1);
});

test('serialized sale marks specific unit sold and decrements inventory_stock', function () {
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Pixel 9 Pro',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'storage' => '256GB',
        'default_selling_price' => 120000.00,
    ]);

    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $variant->id,
        'imei_or_serial' => '351122334455667',
        'condition' => 'new',
        'cost_basis' => 90000.00,
        'status' => 'in_stock',
    ]);

    InventoryStock::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $variant->id,
        'quantity_on_hand' => 1,
        'average_cost' => 90000.00,
    ]);

    $action = new RecordSaleAction;
    $order = $action->execute([
        'paid_amount' => 120000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $variant->id,
                'inventory_unit_id' => $unit->id,
                'quantity' => 1,
                'unit_price' => 120000.00,
                'sourcing_type' => 'internal_stock',
            ],
        ],
    ]);

    expect($order->payment_status)->toBe('paid');

    $refreshedUnit = $unit->fresh();
    expect($refreshedUnit->status)->toBe('sold');
    expect($refreshedUnit->sold_at)->not->toBeNull();

    $stock = InventoryStock::where('variant_id', $variant->id)->first();
    expect($stock->quantity_on_hand)->toBe(0);
});
