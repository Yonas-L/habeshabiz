<?php

use App\Models\Contact;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Bole Tech Hub',
        'slug' => 'bole-tech-hub-'.uniqid(),
    ]);
    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Yoni',
        'email' => 'yoni.range@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
        'can_view_costs' => true,
    ]);
});

test('dashboard summary returns sales_trend and supports ranges', function () {
    $token = $this->owner->createToken('test')->plainTextToken;

    $customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Customer',
        'roles' => ['customer'],
    ]);

    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro',
        'brand' => 'Apple',
        'has_serials' => true,
    ]);
    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'name' => '128GB Black',
    ]);

    // Create order in current month
    $orderCurrent = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'customer_id' => $customer->id,
        'order_date' => now(),
        'order_number' => 'SO-RANGE-01',
        'subtotal' => 170000.00,
        'total_amount' => 170000.00,
        'discount_amount' => 0.00,
        'write_off_amount' => 0.00,
        'paid_amount' => 170000.00,
        'payment_status' => 'paid',
    ]);

    SalesOrderItem::create([
        'sales_order_id' => $orderCurrent->id,
        'variant_id' => $variant->id,
        'quantity' => 1,
        'unit_price' => 170000.00,
        'unit_cost' => 100000.00,
        'profit' => 70000.00,
    ]);

    // Create order in prior month
    $orderPrior = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'customer_id' => $customer->id,
        'order_date' => now()->subMonthNoOverflow()->startOfMonth()->addDays(5),
        'order_number' => 'SO-RANGE-02',
        'subtotal' => 150000.00,
        'total_amount' => 150000.00,
        'discount_amount' => 0.00,
        'write_off_amount' => 0.00,
        'paid_amount' => 150000.00,
        'payment_status' => 'paid',
    ]);

    SalesOrderItem::create([
        'sales_order_id' => $orderPrior->id,
        'variant_id' => $variant->id,
        'quantity' => 1,
        'unit_price' => 150000.00,
        'unit_cost' => 90000.00,
        'profit' => 60000.00,
    ]);

    // Test 1M (default)
    $res1m = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/dashboard/summary');

    $res1m->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.monthly_performance.revenue', 170000)
        ->assertJsonPath('data.sales_trend.is_up', true)
        ->assertJsonPath('data.sales_trend.comparison_label', 'vs last month');

    // Expected percentage: (170000 - 150000) / 150000 * 100 = 13.3%
    expect($res1m->json('data.sales_trend.percentage'))->toEqual(13.3);

    // Test 3M range
    $res3m = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/dashboard/summary?range=3m');

    $res3m->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.monthly_performance.revenue', 320000)
        ->assertJsonPath('data.sales_trend.range', '3m')
        ->assertJsonPath('data.sales_trend.comparison_label', 'vs prior 3 months');
});
