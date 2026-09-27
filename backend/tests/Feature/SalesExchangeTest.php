<?php

use App\Actions\RecordSaleAction;
use App\Models\Contact;
use App\Models\FinancialAccount;
use App\Models\InventoryStock;
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
        'name' => 'Bole Electronics Exchange Shop',
        'slug' => 'bole-exchange-test',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->user = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yoni Owner',
        'email' => 'yoni_exchange@example.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);

    $this->actingAs($this->user);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Telebirr Main',
        'type' => 'mobile_money',
        'currency' => 'ETB',
        'current_balance' => 100000.00,
    ]);

    // Outgoing phone (Pixel 8)
    $this->outgoingProduct = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Google Pixel 8',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->outgoingVariant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->outgoingProduct->id,
        'storage' => '128GB',
        'color' => 'Obsidian',
        'default_selling_price' => 100000.00,
    ]);

    $this->outgoingUnit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->outgoingVariant->id,
        'imei_or_serial' => '358999001122334',
        'condition' => 'new',
        'cost_basis' => 75000.00,
        'status' => 'in_stock',
        'source_type' => 'purchase',
    ]);

    InventoryStock::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->outgoingVariant->id,
        'quantity_on_hand' => 1,
        'average_cost' => 75000.00,
    ]);

    // Incoming phone model (Pixel 5)
    $this->incomingProduct = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Google Pixel 5',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->incomingVariant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->incomingProduct->id,
        'storage' => '128GB',
        'color' => 'Just Black',
        'default_selling_price' => 60000.00,
    ]);

    $this->customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Customer',
        'phone' => '+251911002233',
        'roles' => ['customer'],
    ]);
});

test('sale with exchange device deposits incoming unit correctly into inventory and credits only cash received', function () {
    $action = app(RecordSaleAction::class);

    $initialBalance = (float) $this->account->fresh()->current_balance;

    // Pixel 8 is sold for 100,000 ETB.
    // Customer gives Pixel 5 (trade-in value: 50,000 ETB) + pays 50,000 ETB in Telebirr.
    $order = $action->execute([
        'customer_id' => $this->customer->id,
        'paid_amount' => 50000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->outgoingVariant->id,
                'inventory_unit_id' => $this->outgoingUnit->id,
                'quantity' => 1,
                'unit_price' => 100000.00,
                'sourcing_type' => 'internal_stock',
            ],
        ],
        'exchange' => [
            'variant_id' => $this->incomingVariant->id,
            'trade_in_value' => 50000.00,
            'imei_or_serial' => '354888009988776',
            'condition' => 'used_clean',
            'battery_health' => 88,
            'cycle_count' => 120,
            'sim_type' => 'physical',
            'location' => 'Shop Counter',
            'notes' => 'Customer trade-in from Abebe',
        ],
    ]);

    // 1. SalesOrder assertions
    expect($order)->not->toBeNull();
    expect((float) $order->total_amount)->toBe(100000.00);
    expect((float) $order->exchange_allowance)->toBe(50000.00);
    expect((float) $order->paid_amount)->toBe(50000.00);
    expect($order->payment_status)->toBe('paid');
    expect($order->exchange_unit_id)->not->toBeNull();

    // 2. Outgoing unit (Pixel 8) must be sold
    expect($this->outgoingUnit->fresh()->status)->toBe('sold');
    expect(InventoryStock::where('variant_id', $this->outgoingVariant->id)->value('quantity_on_hand'))->toBe(0);

    // 3. Incoming unit (Pixel 5) must be deposited in inventory
    $depositedUnit = InventoryUnit::find($order->exchange_unit_id);
    expect($depositedUnit)->not->toBeNull();
    expect($depositedUnit->variant_id)->toBe($this->incomingVariant->id);
    expect($depositedUnit->imei_or_serial)->toBe('354888009988776');
    expect($depositedUnit->status)->toBe('in_stock');
    expect($depositedUnit->source_type)->toBe('exchange');
    expect((float) $depositedUnit->cost_basis)->toBe(50000.00);
    expect($depositedUnit->battery_health)->toBe(88);
    expect($depositedUnit->exchange_sales_order_id)->toBe($order->id);

    // 4. Aggregated InventoryStock for Pixel 5 must be incremented
    $incomingStock = InventoryStock::where('variant_id', $this->incomingVariant->id)->first();
    expect($incomingStock)->not->toBeNull();
    expect($incomingStock->quantity_on_hand)->toBe(1);
    expect((float) $incomingStock->average_cost)->toBe(50000.00);

    // 5. Financial Account must only be credited with actual cash paid (50,000 ETB, NOT 100,000 ETB)
    $finalBalance = (float) $this->account->fresh()->current_balance;
    expect($finalBalance)->toBe($initialBalance + 50000.00);
});

test('api endpoint stores exchange device and returns order with exchange unit', function () {
    $response = $this->actingAs($this->user)->postJson('/api/v1/sales', [
        'customer_id' => $this->customer->id,
        'paid_amount' => 50000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->outgoingVariant->id,
                'inventory_unit_id' => $this->outgoingUnit->id,
                'quantity' => 1,
                'unit_price' => 100000.00,
            ],
        ],
        'exchange' => [
            'variant_id' => $this->incomingVariant->id,
            'trade_in_value' => 50000.00,
            'imei_or_serial' => '998877665544332',
            'condition' => 'used_clean',
            'battery_health' => 90,
            'sim_type' => 'physical',
        ],
    ]);

    $response->assertCreated();
    $data = $response->json('data');

    expect((float) $data['total_amount'])->toBe(100000.00);
    expect((float) $data['exchange_allowance'])->toBe(50000.00);
    expect((float) $data['paid_amount'])->toBe(50000.00);
    expect($data['payment_status'])->toBe('paid');
    expect($data['exchange_unit_id'])->not->toBeNull();

    // Verify exchange unit is in inventory units response
    $unitsResponse = $this->actingAs($this->user)->getJson('/api/v1/inventory/units?source_type=exchange');
    $unitsResponse->assertOk();
    $unitsList = $unitsResponse->json('data');
    expect(count($unitsList))->toBeGreaterThanOrEqual(1);
    expect($unitsList[0]['imei_or_serial'])->toBe('998877665544332');
    expect($unitsList[0]['source_type'])->toBe('exchange');
});

test('subsequent sale of an exchanged unit preserves exchange source_type in sales history API', function () {
    // 1. Take in an exchange unit (Pixel 5)
    $action = app(RecordSaleAction::class);
    $initialOrder = $action->execute([
        'customer_id' => $this->customer->id,
        'paid_amount' => 50000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->outgoingVariant->id,
                'inventory_unit_id' => $this->outgoingUnit->id,
                'quantity' => 1,
                'unit_price' => 100000.00,
            ],
        ],
        'exchange' => [
            'variant_id' => $this->incomingVariant->id,
            'trade_in_value' => 50000.00,
            'imei_or_serial' => '889900112233445',
            'condition' => 'used_clean',
            'battery_health' => 92,
            'sim_type' => 'physical',
        ],
    ]);

    $exchangedUnit = InventoryUnit::where('imei_or_serial', '889900112233445')->first();
    expect($exchangedUnit)->not->toBeNull();
    expect($exchangedUnit->source_type)->toBe('exchange');
    expect($exchangedUnit->status)->toBe('in_stock');

    // 2. A new customer buys this exchanged unit
    $buyer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Sara Buyer',
        'phone' => '+251922334455',
        'roles' => ['customer'],
    ]);

    $resaleResponse = $this->actingAs($this->user)->postJson('/api/v1/sales', [
        'customer_id' => $buyer->id,
        'paid_amount' => 60000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->incomingVariant->id,
                'inventory_unit_id' => $exchangedUnit->id,
                'quantity' => 1,
                'unit_price' => 60000.00,
            ],
        ],
    ]);

    $resaleResponse->assertCreated();
    $resaleData = $resaleResponse->json('data');

    // Verify item inventory_unit relationship is loaded and flagged as exchange
    expect($resaleData['items'][0]['inventory_unit'])->not->toBeNull();
    expect($resaleData['items'][0]['inventory_unit']['source_type'])->toBe('exchange');
    expect($resaleData['items'][0]['inventory_unit']['imei_or_serial'])->toBe('889900112233445');

    // 3. Verify getSales list endpoint returns the item with inventory_unit and supports source_type=exchange filter
    $listResponse = $this->actingAs($this->user)->getJson('/api/v1/sales?source_type=exchange');
    $listResponse->assertOk();
    $orders = $listResponse->json('data');
    
    // Both the original exchange order and the resale order match source_type=exchange filter
    expect(count($orders))->toBe(2);
    $resaleOrderInList = collect($orders)->firstWhere('order_number', $resaleData['order_number']);
    expect($resaleOrderInList)->not->toBeNull();
    expect($resaleOrderInList['items'][0]['inventory_unit']['source_type'])->toBe('exchange');
});
