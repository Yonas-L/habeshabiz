<?php

use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Adama Mobile Hub',
        'slug' => 'adama-mobile-hub',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Abebe',
        'email' => 'abebe@adama.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->bankAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 100000.00,
        'is_active' => true,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro',
        'category' => 'smartphones',
        'has_serials' => true,
        'is_active' => true,
        'is_archived' => false,
    ]);

    $this->variant128 = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '128GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 130000.00,
    ]);

    $this->variant256 = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Black Titanium',
        'default_selling_price' => 145000.00,
    ]);
});

test('owner can archive and unarchive product', function () {
    $response = $this->actingAs($this->owner)->postJson("/api/v1/products/{$this->product->id}/archive");
    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.is_archived', true);

    expect($this->product->fresh()->is_archived)->toBeTrue();

    // Default listing hides archived products
    $listResponse = $this->actingAs($this->owner)->getJson('/api/v1/products');
    $listResponse->assertStatus(200);
    $items = collect($listResponse->json('data'));
    expect($items->contains('id', $this->product->id))->toBeFalse();

    // Archived view shows it
    $archivedResponse = $this->actingAs($this->owner)->getJson('/api/v1/products?archived=true');
    $archivedResponse->assertStatus(200);
    $archivedItems = collect($archivedResponse->json('data'));
    expect($archivedItems->contains('id', $this->product->id))->toBeTrue();

    // Unarchive
    $unarchiveResponse = $this->actingAs($this->owner)->postJson("/api/v1/products/{$this->product->id}/unarchive");
    $unarchiveResponse->assertStatus(200)
        ->assertJsonPath('data.is_archived', false);
    expect($this->product->fresh()->is_archived)->toBeFalse();
});

test('batch stock intake adds multiple mixed devices with bank funding', function () {
    $payload = [
        'funding_source' => 'account',
        'payment_account_id' => $this->bankAccount->id,
        'units' => [
            [
                'variant_id' => $this->variant128->id,
                'imei_or_serial' => '354890123456781',
                'battery_health' => 95,
                'condition' => 'Used - Like New',
                'cost_basis' => 45000.00,
                'selling_price' => null, // Optional
            ],
            [
                'variant_id' => $this->variant256->id,
                'imei_or_serial' => '354890123456782',
                'battery_health' => 100,
                'condition' => 'Brand New',
                'cost_basis' => 50000.00,
                'selling_price' => 60000.00,
            ],
        ],
    ];

    $response = $this->actingAs($this->owner)->postJson('/api/v1/inventory/units', $payload);
    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('units_created', 2);

    expect(InventoryUnit::where('imei_or_serial', '354890123456781')->exists())->toBeTrue();
    expect(InventoryUnit::where('imei_or_serial', '354890123456782')->exists())->toBeTrue();

    // Total cost 95,000 deducted from bank (100,000 - 95,000 = 5,000)
    expect((float) $this->bankAccount->fresh()->current_balance)->toBe(5000.00);
});

test('bank funding blocks overdraft on stock intake', function () {
    $payload = [
        'funding_source' => 'account',
        'payment_account_id' => $this->bankAccount->id,
        'units' => [
            [
                'variant_id' => $this->variant128->id,
                'imei_or_serial' => '354890123456783',
                'condition' => 'Brand New',
                'cost_basis' => 150000.00, // Exceeds 100,000 balance!
            ],
        ],
    ];

    $response = $this->actingAs($this->owner)->postJson('/api/v1/inventory/units', $payload);
    $response->assertStatus(422)
        ->assertJsonValidationErrors(['payment_account_id']);
});

test('debtor receivable offset reduces debtor balance upon stock intake', function () {
    $debtor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Kebede Debtor',
        'phone' => '+251911223344',
        'roles' => ['customer'],
    ]);

    // Open receivable debt: Kebede owes 60,000 ETB
    $debt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $debtor->id,
        'type' => 'receivable',
        'reference_type' => 'manual',
        'original_amount' => 60000.00,
        'paid_amount' => 0.0,
        'remaining_amount' => 60000.00,
        'status' => 'open',
    ]);

    $payload = [
        'funding_source' => 'debtor_offset',
        'receivable_contact_id' => $debtor->id,
        'receivable_offset_amount' => 40000.00,
        'units' => [
            [
                'variant_id' => $this->variant128->id,
                'imei_or_serial' => '354890123456784',
                'condition' => 'Used - Like New',
                'cost_basis' => 40000.00,
            ],
        ],
    ];

    $response = $this->actingAs($this->owner)->postJson('/api/v1/inventory/units', $payload);
    $response->assertStatus(201);

    // Debtor debt reduced from 60,000 to 20,000
    expect((float) $debt->fresh()->remaining_amount)->toBe(20000.00);
    expect($debt->fresh()->status)->toBe('partially_paid');

    // Bank balance untouched
    expect((float) $this->bankAccount->fresh()->current_balance)->toBe(100000.00);
});

test('pos vendor direct sale completes JIT transaction in single step', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abel Tech Sourcing',
        'phone' => '+251922334455',
        'roles' => ['supplier'],
    ]);

    $customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Alemayehu Buyer',
        'phone' => '+251933445566',
        'roles' => ['customer'],
    ]);

    $payload = [
        'variant_id' => $this->variant128->id,
        'imei_or_serial' => '354890123456799',
        'condition' => 'Brand New',
        'vendor_contact_id' => $vendor->id,
        'vendor_cost' => 50000.00,
        'vendor_payment_method' => 'paid_now',
        'vendor_payment_account_id' => $this->bankAccount->id,
        'selling_price' => 62000.00,
        'customer_id' => $customer->id,
        'paid_amount' => 62000.00,
        'payment_method' => 'bank_transfer',
        'financial_account_id' => $this->bankAccount->id,
    ];

    $response = $this->actingAs($this->owner)->postJson('/api/v1/sales/vendor-direct', $payload);
    $response->assertStatus(201)
        ->assertJsonPath('success', true);

    $unit = InventoryUnit::where('imei_or_serial', '354890123456799')->first();
    expect($unit)->not->toBeNull();
    expect($unit->status)->toBe('sold');
    expect($unit->source_type)->toBe('vendor_direct');

    $order = SalesOrder::where('is_vendor_sourced', true)->first();
    expect($order)->not->toBeNull();
    expect((float) $order->vendor_cost_basis)->toBe(50000.00);
    expect($order->vendor_payment_status)->toBe('paid');

    // Bank: 100,000 - 50,000 (vendor payout) + 62,000 (customer payment) = 112,000
    expect((float) $this->bankAccount->fresh()->current_balance)->toBe(112000.00);

    // Attempting duplicate sale with same IMEI must fail with 422
    $duplicateResponse = $this->actingAs($this->owner)->postJson('/api/v1/sales/vendor-direct', $payload);
    $duplicateResponse->assertStatus(422)
        ->assertJsonValidationErrors(['imei_or_serial']);
});
