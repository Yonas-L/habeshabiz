<?php

use App\Models\Contact;
use App\Models\Debt;
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
        'slug' => 'bole-tech-hub',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->user = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yoni Owner',
        'email' => 'yoni.consignment@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->broker = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Mekdi Bole Sourcing',
        'phone' => '+251922110001',
        'roles' => ['peer_vendor', 'supplier', 'partner'],
        'is_active' => true,
    ]);

    $this->telebirr = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'TeleBirr Counter',
        'type' => 'mobile_money',
        'current_balance' => 100000.00,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 16 Pro Max',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Desert Titanium',
        'default_selling_price' => 180000.00,
    ]);
});

test('can intake vendor consignment stock from broker into inventory', function () {
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '354890123456789',
            'condition' => 'new',
            'cost_basis' => 160000.00, // Agreed broker payout
            'selling_price' => 180000.00,
            'source_type' => 'consignment',
            'supplier_contact_id' => $this->broker->id,
            'return_deadline' => now()->addDays(7)->toDateString(),
            'notes' => '7-day test agreement with Mekdi',
        ]);

    $response->assertStatus(201);
    expect($response->json('data.source_type'))->toBe('consignment');
    expect($response->json('data.supplier_contact_id'))->toBe($this->broker->id);
    expect((float) $response->json('data.cost_basis'))->toBe(160000.00);

    $unit = InventoryUnit::where('imei_or_serial', '354890123456789')->first();
    expect($unit)->not->toBeNull();
    expect($unit->source_type)->toBe('consignment');
    expect($unit->status)->toBe('in_stock');
    expect($unit->return_deadline->toDateString())->toBe(now()->addDays(7)->toDateString());

    // Verified in units list
    $listRes = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/v1/inventory/units?status=vendor_stock');
    $listRes->assertOk();
    expect($listRes->json('data'))->toHaveCount(1);
    expect($listRes->json('counts.vendor_stock'))->toBe(1);
});

test('can return unsold vendor consignment stock back to broker', function () {
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => '354890999999999',
        'condition' => 'new',
        'cost_basis' => 160000.00,
        'status' => 'in_stock',
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->broker->id,
        'return_deadline' => now()->addDays(3)->toDateString(),
    ]);

    InventoryStock::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'quantity_on_hand' => 1,
        'average_cost' => 160000.00,
    ]);

    $returnRes = $this->actingAs($this->user, 'sanctum')
        ->postJson("/api/v1/inventory/units/{$unit->id}/return-to-vendor", [
            'return_reason' => 'Unsold after 3 days, returned to Mekdi',
        ]);

    $returnRes->assertOk();
    expect($returnRes->json('data.status'))->toBe('returned_to_vendor');

    $freshUnit = $unit->fresh();
    expect($freshUnit->status)->toBe('returned_to_vendor');
    expect($freshUnit->returned_at)->not->toBeNull();
    expect($freshUnit->return_reason)->toBe('Unsold after 3 days, returned to Mekdi');

    // Stock on hand decremented
    $stock = InventoryStock::where('variant_id', $this->variant->id)->first();
    expect($stock->quantity_on_hand)->toBe(0);

    // No debt created
    expect(Debt::where('contact_id', $this->broker->id)->count())->toBe(0);
});

test('selling a vendor consignment unit credits shop account and auto-creates payable to broker', function () {
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => '354890111222333',
        'condition' => 'new',
        'cost_basis' => 160000.00, // Agreed broker payout
        'status' => 'in_stock',
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->broker->id,
    ]);

    InventoryStock::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'quantity_on_hand' => 1,
        'average_cost' => 160000.00,
    ]);

    $initialBalance = (float) $this->telebirr->current_balance;

    // Record sale: Customer buys for 180,000 ETB, paying fully via Telebirr
    $saleResponse = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/v1/sales', [
            'payment_method' => 'telebirr',
            'financial_account_id' => $this->telebirr->id,
            'paid_amount' => 180000.00,
            'items' => [
                [
                    'variant_id' => $this->variant->id,
                    'inventory_unit_id' => $unit->id,
                    'quantity' => 1,
                    'unit_price' => 180000.00,
                    'sourcing_type' => 'internal_stock',
                ],
            ],
        ]);

    $saleResponse->assertStatus(201);

    // 1. Shop Account is topped up with the full 180,000 ETB
    $this->telebirr->refresh();
    expect((float) $this->telebirr->current_balance)->toBe($initialBalance + 180000.00);

    // 2. Unit is marked sold
    $unit->refresh();
    expect($unit->status)->toBe('sold');

    // 3. Stock is decremented
    $stock = InventoryStock::where('variant_id', $this->variant->id)->first();
    expect($stock->quantity_on_hand)->toBe(0);

    // 4. Automatic Payable (Debt) is created for the broker for their 160,000 ETB agreed cut
    $payable = Debt::where('contact_id', $this->broker->id)
        ->where('type', 'payable')
        ->where('reference_type', 'consignment_sale')
        ->first();

    expect($payable)->not->toBeNull();
    expect((float) $payable->original_amount)->toBe(160000.00);
    expect((float) $payable->remaining_amount)->toBe(160000.00);
    expect($payable->status)->toBe('open');

    // 5. Order Item records the shop profit: 180,000 - 160,000 = 20,000 ETB profit
    $orderId = $saleResponse->json('data.id');
    $orderItem = \App\Models\SalesOrderItem::where('sales_order_id', $orderId)->first();
    expect((float) $orderItem->unit_cost)->toBe(160000.00);
    expect((float) $orderItem->profit)->toBe(20000.00);
});
