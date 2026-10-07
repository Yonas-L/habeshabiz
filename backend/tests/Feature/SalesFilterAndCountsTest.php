<?php

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
        'name' => 'Bole Electronics Filter Test Shop',
        'slug' => 'bole-filter-test',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husni Owner',
        'email' => 'husni_owner@example.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);

    $this->salesperson = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Sales',
        'email' => 'abebe_sales@example.com',
        'password' => Hash::make('password'),
        'role' => 'salesperson',
    ]);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Telebirr Test',
        'type' => 'mobile_money',
        'currency' => 'ETB',
        'current_balance' => 50000.00,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 120000.00,
    ]);

    // Order 1: Paid order (sold by Abebe)
    $this->orderPaid = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-TEST-PAID',
        'salesperson_id' => $this->salesperson->id,
        'total_amount' => 120000.00,
        'paid_amount' => 120000.00,
        'payment_status' => 'paid',
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'order_date' => now(),
    ]);

    // Order 2: Partially paid / Credit order (sold by Abebe)
    $this->orderCredit1 = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-TEST-CREDIT-PARTIAL',
        'salesperson_id' => $this->salesperson->id,
        'total_amount' => 120000.00,
        'paid_amount' => 30000.00,
        'payment_status' => 'partially_paid',
        'payment_method' => 'credit',
        'financial_account_id' => $this->account->id,
        'order_date' => now(),
    ]);

    // Order 3: Completely unpaid / Credit order (sold by Owner)
    $this->orderCredit2 = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-TEST-CREDIT-UNPAID',
        'salesperson_id' => $this->owner->id,
        'total_amount' => 120000.00,
        'paid_amount' => 0.00,
        'payment_status' => 'unpaid',
        'payment_method' => 'credit',
        'order_date' => now(),
    ]);

    // Order 4: Exchange order (trade-in)
    $this->exchangeUnit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-TRADEIN-001',
        'cost_basis' => 30000.00,
        'status' => 'in_stock',
        'source_type' => 'exchange',
        'condition' => 'used',
    ]);

    $this->orderExchange = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-TEST-EXCHANGE',
        'salesperson_id' => $this->owner->id,
        'total_amount' => 120000.00,
        'paid_amount' => 90000.00,
        'payment_status' => 'paid',
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'exchange_unit_id' => $this->exchangeUnit->id,
        'exchange_allowance' => 30000.00,
        'order_date' => now(),
    ]);
});

test('sales api returns accurate counts for all, paid, credit, and exchange tabs', function () {
    $response = $this->actingAs($this->owner)
        ->getJson('/api/v1/sales');

    $response->assertOk();
    $data = $response->json();

    expect($data)->toHaveKey('counts');
    expect($data['counts'])->toBe([
        'all' => 4,
        'paid' => 2,      // orderPaid and orderExchange
        'credit' => 2,    // orderCredit1 (partially_paid) and orderCredit2 (unpaid)
        'exchange' => 1,  // orderExchange
        'b2b' => 0,
    ]);
    expect(count($data['data']))->toBe(4);
});

test('sales api filters by payment_status=credit to include both unpaid and partially_paid', function () {
    // When requesting credit filter
    $response = $this->actingAs($this->owner)
        ->getJson('/api/v1/sales?payment_status=credit');

    $response->assertOk();
    $orders = $response->json('data');

    expect(count($orders))->toBe(2);
    $orderNumbers = collect($orders)->pluck('order_number')->all();
    expect($orderNumbers)->toContain('ORD-TEST-CREDIT-PARTIAL');
    expect($orderNumbers)->toContain('ORD-TEST-CREDIT-UNPAID');

    // Counts remain global and accurate
    expect($response->json('counts'))->toBe([
        'all' => 4,
        'paid' => 2,
        'credit' => 2,
        'exchange' => 1,
        'b2b' => 0,
    ]);
});

test('sales api filters by payment_status=paid', function () {
    $response = $this->actingAs($this->owner)
        ->getJson('/api/v1/sales?payment_status=paid');

    $response->assertOk();
    $orders = $response->json('data');

    expect(count($orders))->toBe(2);
    $orderNumbers = collect($orders)->pluck('order_number')->all();
    expect($orderNumbers)->toContain('ORD-TEST-PAID');
    expect($orderNumbers)->toContain('ORD-TEST-EXCHANGE');
});

test('sales api filters by source_type=exchange', function () {
    $response = $this->actingAs($this->owner)
        ->getJson('/api/v1/sales?source_type=exchange');

    $response->assertOk();
    $orders = $response->json('data');

    expect(count($orders))->toBe(1);
    expect($orders[0]['order_number'])->toBe('ORD-TEST-EXCHANGE');
});

test('salesperson receives tab counts scoped to their own sales', function () {
    $response = $this->actingAs($this->salesperson)
        ->getJson('/api/v1/sales');

    $response->assertOk();
    $data = $response->json();

    // Abebe sold orderPaid (paid) and orderCredit1 (partially_paid)
    expect($data['counts'])->toBe([
        'all' => 2,
        'paid' => 1,
        'credit' => 1,
        'exchange' => 0,
        'b2b' => 0,
    ]);
    expect(count($data['data']))->toBe(2);
});

test('salesperson with can_manage_inventory privilege can see all store sales for returns', function () {
    $inventoryStaff = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Kebede Returns Manager',
        'email' => 'kebede_returns@example.com',
        'password' => Hash::make('password'),
        'role' => 'salesperson',
        'permissions' => [
            'can_manage_inventory' => true,
        ],
    ]);

    $response = $this->actingAs($inventoryStaff)
        ->getJson('/api/v1/sales');

    $response->assertOk();
    $data = $response->json();

    // Kebede can see all 4 orders across the store to process returns and warranty swaps
    expect($data['counts'])->toBe([
        'all' => 4,
        'paid' => 2,
        'credit' => 2,
        'exchange' => 1,
        'b2b' => 0,
    ]);
    expect(count($data['data']))->toBe(4);
});
