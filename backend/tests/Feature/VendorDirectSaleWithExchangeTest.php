<?php

use App\Models\AuditLog;
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
        'name' => 'DropShip Test Shop',
        'slug' => 'dropship-test-shop',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Dave',
        'email' => 'owner.dropship@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->shopAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Shop Main',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 20000.0,
        'is_active' => true,
    ]);

    $this->vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Vendor Partner',
        'phone' => '+251911000111',
        'roles' => ['vendor', 'peer_vendor'],
        'is_active' => true,
    ]);

    $this->customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Kebede Customer',
        'phone' => '+251922333444',
        'roles' => ['customer'],
        'is_active' => true,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro Max',
        'has_serials' => true,
        'is_active' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'color' => 'Blue Titanium',
        'storage' => '256GB',
        'default_selling_price' => 150000.0,
    ]);

    $this->tradeInProduct = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 12',
        'has_serials' => true,
        'is_active' => true,
    ]);

    $this->tradeInVariant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->tradeInProduct->id,
        'color' => 'Black',
        'storage' => '128GB',
        'default_selling_price' => 80000.0,
    ]);
});

test('handles vendor drop-ship sale with device exchange and pay-later vendor debt, and supports clean undo', function () {
    $initialShopBalance = (float) $this->shopAccount->current_balance;

    $payload = [
        'product_id' => $this->product->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'VENDOR-IMEI-15PROMAX-99',
        'condition' => 'Brand New',
        'vendor_contact_id' => $this->vendor->id,
        'vendor_cost' => 100000.0,
        'vendor_payment_method' => 'owed',

        'selling_price' => 150000.0,
        'paid_amount' => 75000.0,
        'payment_method' => 'bank_transfer',
        'financial_account_id' => $this->shopAccount->id,
        'customer_id' => $this->customer->id,

        'exchange' => [
            'variant_id' => $this->tradeInVariant->id,
            'trade_in_value' => 75000.0,
            'imei_or_serial' => 'TRADEIN-IMEI-12-88',
            'condition' => 'used_clean',
            'battery_health' => 88,
            'cycle_count' => 320,
            'sim_type' => 'physical',
            'location' => 'Shop Counter',
            'notes' => 'Customer traded in iPhone 12 against 15 Pro Max',
        ],
    ];

    $response = $this->actingAs($this->owner)
        ->postJson('/api/v1/sales/vendor-direct', $payload)
        ->assertStatus(201);

    $orderId = $response->json('data.id');
    $order = SalesOrder::with(['items', 'exchangeUnit'])->findOrFail($orderId);

    // 1. Verify Sales Order
    expect((float) $order->total_amount)->toEqual(150000.0)
        ->and((float) $order->paid_amount)->toEqual(75000.0)
        ->and((float) $order->exchange_allowance)->toEqual(75000.0)
        ->and($order->payment_status)->toEqual('paid')
        ->and($order->is_vendor_sourced)->toBeTrue()
        ->and($order->vendor_payment_status)->toEqual('owed')
        ->and($order->exchange_unit_id)->not->toBeNull();

    // 2. Verify Traded-in Exchange Device in Inventory
    $exUnit = InventoryUnit::findOrFail($order->exchange_unit_id);
    expect($exUnit->status)->toEqual('in_stock')
        ->and($exUnit->source_type)->toEqual('exchange')
        ->and((float) $exUnit->cost_basis)->toEqual(75000.0)
        ->and($exUnit->imei_or_serial)->toEqual('TRADEIN-IMEI-12-88')
        ->and($exUnit->supplier_contact_id)->toEqual($this->customer->id)
        ->and($exUnit->exchange_sales_order_id)->toEqual($order->id);

    // 3. Verify Shop Bank Account was credited with customer's 75,000 ETB cash payment
    $shopAccountBalance = (float) $this->shopAccount->fresh()->current_balance;
    expect($shopAccountBalance)->toEqual($initialShopBalance + 75000.0);

    // 4. Verify Vendor Payable Debt (100,000 ETB recorded to be settled in Debt Manager)
    $vendorDebt = Debt::where('tenant_id', $this->tenant->id)
        ->where('contact_id', $this->vendor->id)
        ->where('reference_id', $order->id)
        ->first();

    expect($vendorDebt)->not->toBeNull()
        ->and((float) $vendorDebt->original_amount)->toEqual(100000.0)
        ->and((float) $vendorDebt->remaining_amount)->toEqual(100000.0)
        ->and($vendorDebt->status)->toEqual('open');

    // 5. Verify Customer has ZERO debt (Order was fully settled: 75k exchange + 75k bank transfer)
    $customerDebt = Debt::where('tenant_id', $this->tenant->id)
        ->where('contact_id', $this->customer->id)
        ->where('reference_id', $order->id)
        ->where('reference_type', 'sales_order')
        ->first();
    expect($customerDebt)->toBeNull();

    // 6. Test UNDO Preview via Audit Log
    $log = AuditLog::where('entity_type', 'SalesOrder')
        ->where('entity_id', $order->id)
        ->first();

    expect($log)->not->toBeNull();

    $previewRes = $this->actingAs($this->owner)
        ->getJson("/api/v1/audit-logs/{$log->id}/undo-preview")
        ->assertStatus(200);

    expect($previewRes->json('data.can_undo'))->toBeTrue()
        ->and($previewRes->json('data.blocked'))->toBeFalse();

    // 7. Execute UNDO
    $undoRes = $this->actingAs($this->owner)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo")
        ->assertStatus(200);

    // 8. Assert Clean Reversal
    expect(SalesOrder::find($order->id))->toBeNull()
        ->and(InventoryUnit::find($exUnit->id))->toBeNull()
        ->and(InventoryUnit::where('imei_or_serial', 'VENDOR-IMEI-15PROMAX-99')->first())->toBeNull()
        ->and(Debt::where('reference_id', $order->id)->count())->toEqual(0)
        ->and((float) $this->shopAccount->fresh()->current_balance)->toEqual($initialShopBalance);
});
