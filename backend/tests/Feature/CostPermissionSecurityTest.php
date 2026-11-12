<?php

use App\Models\Contact;
use App\Models\FinancialAccount;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\MaintenanceRecord;
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
        'name' => 'Security Audit Store',
        'slug' => 'security-audit-store',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Store Owner',
        'email' => 'owner@security-audit.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->staff = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Sales Staff Without Cost Access',
        'email' => 'staff@security-audit.com',
        'password' => Hash::make('password123'),
        'role' => 'salesperson',
        'permissions' => ['can_view_costs' => false],
    ]);

    $this->staffWithCost = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Sales Staff With Cost Access',
        'email' => 'staff_cost@security-audit.com',
        'password' => Hash::make('password123'),
        'role' => 'salesperson',
        'permissions' => ['can_view_costs' => true],
    ]);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'current_balance' => 500000.00,
        'is_custom_asset' => false,
    ]);

    $this->customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Customer',
        'phone' => '0911223344',
        'type' => 'customer',
        'roles' => ['customer'],
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro',
        'category' => 'Smartphones',
        'brand' => 'Apple',
        'has_serials' => true,
        'is_active' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 150000.00,
    ]);

    $this->stock = InventoryStock::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'quantity_on_hand' => 5,
        'average_cost' => 110000.00,
    ]);

    $this->unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-TEST-998877',
        'cost_basis' => 112000.00,
        'selling_price' => 155000.00,
        'status' => 'sold',
        'payment_account_id' => $this->account->id,
    ]);

    $this->maintenance = MaintenanceRecord::create([
        'tenant_id' => $this->tenant->id,
        'inventory_unit_id' => $this->unit->id,
        'cost' => 3500.00,
        'is_capitalized' => true,
        'billing_type' => 'shop',
        'description' => 'Screen glass repair',
        'date' => now(),
    ]);

    $this->order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'SO-AUDIT-001',
        'customer_id' => $this->customer->id,
        'salesperson_id' => $this->staff->id,
        'total_amount' => 155000.00,
        'paid_amount' => 155000.00,
        'payment_status' => 'paid',
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'vendor_cost_basis' => 108000.00,
        'order_date' => now(),
    ]);

    $this->orderItem = SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $this->order->id,
        'variant_id' => $this->variant->id,
        'inventory_unit_id' => $this->unit->id,
        'quantity' => 1,
        'unit_price' => 155000.00,
        'unit_cost' => 112000.00,
        'profit' => 43000.00,
        'vendor_cost' => 108000.00,
        'sourcing_type' => 'internal_stock',
    ]);

    $this->staffWithCostOrder = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'SO-COST-002',
        'customer_id' => $this->customer->id,
        'salesperson_id' => $this->staffWithCost->id,
        'total_amount' => 155000.00,
        'paid_amount' => 155000.00,
        'payment_status' => 'paid',
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'vendor_cost_basis' => 108000.00,
        'order_date' => now(),
    ]);

    $this->staffWithCostOrderItem = SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $this->staffWithCostOrder->id,
        'variant_id' => $this->variant->id,
        'inventory_unit_id' => $this->unit->id,
        'quantity' => 1,
        'unit_price' => 155000.00,
        'unit_cost' => 112000.00,
        'profit' => 43000.00,
        'vendor_cost' => 108000.00,
        'sourcing_type' => 'internal_stock',
    ]);

    $this->swappedOrder = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'SO-SWAP-001',
        'customer_id' => $this->customer->id,
        'salesperson_id' => $this->staff->id,
        'total_amount' => 140000.00,
        'paid_amount' => 140000.00,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'vendor_cost_basis' => 95000.00,
        'order_date' => now(),
    ]);

    $this->swappedUnit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-SWAP-112233',
        'cost_basis' => 98000.00,
        'selling_price' => 140000.00,
        'status' => 'in_stock',
        'is_swapped' => true,
        'swapped_at' => now(),
        'swapped_sales_order_id' => $this->swappedOrder->id,
        'payment_account_id' => $this->account->id,
    ]);
});

test('owner can see all top-level and nested cost, profit, and margin data', function () {
    // 1. Products endpoint includes average_cost in nested stock
    $productRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/products');
    $productRes->assertOk();
    $variants = $productRes->json('data.0.variants');
    expect($variants[0]['stock'])->toHaveKey('average_cost');
    expect((float) $variants[0]['stock']['average_cost'])->toBe(110000.00);

    // 2. Inventory units list includes cost_basis
    $unitsRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/inventory/units?status=all');
    $unitsRes->assertOk();
    $unitData = collect($unitsRes->json('data'))->firstWhere('id', $this->unit->id);
    expect($unitData)->toHaveKey('cost_basis');
    expect((float) $unitData['cost_basis'])->toBe(112000.00);

    // 3. Inventory unit details include nested maintenance cost and sales order item cost/profit
    $unitDetailRes = $this->actingAs($this->owner, 'sanctum')->getJson("/api/v1/inventory/units/{$this->unit->id}");
    $unitDetailRes->assertOk();
    $detail = $unitDetailRes->json();
    expect($detail)->toHaveKey('cost_basis');
    expect($detail['maintenance_records'][0])->toHaveKey('cost');
    expect((float) $detail['maintenance_records'][0]['cost'])->toBe(3500.00);
    expect($detail['sales_order_item'])->toHaveKey('unit_cost');
    expect($detail['sales_order_item'])->toHaveKey('profit');
    expect($detail['sales_order_item'])->toHaveKey('vendor_cost');
    expect((float) $detail['sales_order_item']['unit_cost'])->toBe(112000.00);
    expect((float) $detail['sales_order_item']['profit'])->toBe(43000.00);

    // 4. Swapped unit details include swapped_sales_order vendor_cost_basis
    $swappedDetailRes = $this->actingAs($this->owner, 'sanctum')->getJson("/api/v1/inventory/units/{$this->swappedUnit->id}");
    $swappedDetailRes->assertOk();
    $swappedDetail = $swappedDetailRes->json();
    expect($swappedDetail)->toHaveKey('cost_basis');
    expect($swappedDetail['swapped_sales_order'])->toHaveKey('vendor_cost_basis');
    expect((float) $swappedDetail['swapped_sales_order']['vendor_cost_basis'])->toBe(95000.00);

    // 5. Sales endpoint includes order item unit_cost, profit, and vendor_cost
    $salesRes = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/sales');
    $salesRes->assertOk();
    $orderData = collect($salesRes->json('data'))->firstWhere('id', $this->order->id);
    expect($orderData)->toHaveKey('vendor_cost_basis');
    expect((float) $orderData['vendor_cost_basis'])->toBe(108000.00);
    expect($orderData['items'][0])->toHaveKey('unit_cost');
    expect($orderData['items'][0])->toHaveKey('profit');
    expect($orderData['items'][0])->toHaveKey('vendor_cost');
});

test('staff WITH cost permission can see all top-level and nested cost data', function () {
    // 1. Products endpoint includes average_cost in nested stock
    $productRes = $this->actingAs($this->staffWithCost, 'sanctum')->getJson('/api/v1/products');
    $productRes->assertOk();
    $variants = $productRes->json('data.0.variants');
    expect($variants[0]['stock'])->toHaveKey('average_cost');
    expect((float) $variants[0]['stock']['average_cost'])->toBe(110000.00);

    // 2. Inventory units list includes cost_basis
    $unitsRes = $this->actingAs($this->staffWithCost, 'sanctum')->getJson('/api/v1/inventory/units?status=all');
    $unitsRes->assertOk();
    $unitData = collect($unitsRes->json('data'))->firstWhere('id', $this->unit->id);
    expect($unitData)->toHaveKey('cost_basis');
    expect((float) $unitData['cost_basis'])->toBe(112000.00);

    // 3. Inventory unit details include nested maintenance cost and sales order item cost/profit
    $unitDetailRes = $this->actingAs($this->staffWithCost, 'sanctum')->getJson("/api/v1/inventory/units/{$this->unit->id}");
    $unitDetailRes->assertOk();
    $detail = $unitDetailRes->json();
    expect($detail)->toHaveKey('cost_basis');
    expect($detail['maintenance_records'][0])->toHaveKey('cost');
    expect((float) $detail['maintenance_records'][0]['cost'])->toBe(3500.00);
    expect($detail['sales_order_item'])->toHaveKey('unit_cost');
    expect($detail['sales_order_item'])->toHaveKey('profit');
    expect($detail['sales_order_item'])->toHaveKey('vendor_cost');
    expect((float) $detail['sales_order_item']['unit_cost'])->toBe(112000.00);
    expect((float) $detail['sales_order_item']['profit'])->toBe(43000.00);

    // 4. Swapped unit details include swapped_sales_order vendor_cost_basis
    $swappedDetailRes = $this->actingAs($this->staffWithCost, 'sanctum')->getJson("/api/v1/inventory/units/{$this->swappedUnit->id}");
    $swappedDetailRes->assertOk();
    $swappedDetail = $swappedDetailRes->json();
    expect($swappedDetail)->toHaveKey('cost_basis');
    expect($swappedDetail['swapped_sales_order'])->toHaveKey('vendor_cost_basis');
    expect((float) $swappedDetail['swapped_sales_order']['vendor_cost_basis'])->toBe(95000.00);

    // 5. Sales endpoint includes order item unit_cost, profit, and vendor_cost
    $salesRes = $this->actingAs($this->staffWithCost, 'sanctum')->getJson('/api/v1/sales');
    $salesRes->assertOk();
    $orderData = collect($salesRes->json('data'))->firstWhere('id', $this->staffWithCostOrder->id);
    expect($orderData)->toHaveKey('vendor_cost_basis');
    expect((float) $orderData['vendor_cost_basis'])->toBe(108000.00);
    expect($orderData['items'][0])->toHaveKey('unit_cost');
    expect($orderData['items'][0])->toHaveKey('profit');
    expect($orderData['items'][0])->toHaveKey('vendor_cost');
});

test('staff without cost permissions CANNOT see top-level or nested cost data', function () {
    // 1. Products endpoint MUST NOT leak average_cost in nested stock
    $productRes = $this->actingAs($this->staff, 'sanctum')->getJson('/api/v1/products');
    $productRes->assertOk();
    $variants = $productRes->json('data.0.variants');
    expect($variants[0]['stock'])->not->toHaveKey('average_cost');

    // 2. Inventory units list MUST NOT leak cost_basis
    $unitsRes = $this->actingAs($this->staff, 'sanctum')->getJson('/api/v1/inventory/units?status=all');
    $unitsRes->assertOk();
    $unitData = collect($unitsRes->json('data'))->firstWhere('id', $this->unit->id);
    expect($unitData)->not->toHaveKey('cost_basis');

    // 3. Inventory unit details MUST NOT leak cost_basis, maintenance cost, or sales_order_item cost/profit
    $unitDetailRes = $this->actingAs($this->staff, 'sanctum')->getJson("/api/v1/inventory/units/{$this->unit->id}");
    $unitDetailRes->assertOk();
    $detail = $unitDetailRes->json();
    expect($detail)->not->toHaveKey('cost_basis');
    expect($detail['maintenance_records'][0])->not->toHaveKey('cost');
    expect($detail['sales_order_item'])->not->toHaveKey('unit_cost');
    expect($detail['sales_order_item'])->not->toHaveKey('profit');
    expect($detail['sales_order_item'])->not->toHaveKey('vendor_cost');

    // 4. Swapped unit details MUST NOT leak cost_basis or swapped_sales_order vendor_cost_basis
    $swappedDetailRes = $this->actingAs($this->staff, 'sanctum')->getJson("/api/v1/inventory/units/{$this->swappedUnit->id}");
    $swappedDetailRes->assertOk();
    $swappedDetail = $swappedDetailRes->json();
    expect($swappedDetail)->not->toHaveKey('cost_basis');
    expect($swappedDetail['swapped_sales_order'])->not->toHaveKey('vendor_cost_basis');

    // 5. Sales endpoint MUST NOT leak order item unit_cost, profit, vendor_cost, or order vendor_cost_basis
    $salesRes = $this->actingAs($this->staff, 'sanctum')->getJson('/api/v1/sales');
    $salesRes->assertOk();
    $orderData = collect($salesRes->json('data'))->firstWhere('id', $this->order->id);
    expect($orderData)->not->toHaveKey('vendor_cost_basis');
    expect($orderData['items'][0])->not->toHaveKey('unit_cost');
    expect($orderData['items'][0])->not->toHaveKey('profit');
    expect($orderData['items'][0])->not->toHaveKey('vendor_cost');
});
