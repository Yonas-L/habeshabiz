<?php

use App\Actions\RecordSaleAction;
use App\Models\Contact;
use App\Models\FinancialAccount;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;

beforeEach(function (): void {
    $this->tenant = Tenant::create(['name' => 'Acc Shop', 'slug' => 'acc-shop']);
    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'owner',
        'name' => 'Shop Owner',
        'is_active' => true,
    ]);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 20000,
        'is_active' => true,
    ]);

    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 16 Pro',
        'brand' => 'Apple',
        'category' => 'smartphones',
        'has_serials' => true,
    ]);

    $this->phoneVariant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'storage' => '256GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 120000,
    ]);

    $this->phoneUnit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->phoneVariant->id,
        'imei_or_serial' => 'IMEI-PHONE-1234',
        'status' => 'in_stock',
        'cost_basis' => 100000,
        'selling_price' => 120000,
        'condition' => 'brand_new',
        'sim_type' => 'physical',
    ]);

    $accProduct = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => '20W USB-C Adapter',
        'brand' => 'Apple',
        'category' => 'accessories',
        'has_serials' => false,
    ]);

    $this->accVariant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $accProduct->id,
        'storage' => '20W',
        'color' => 'White',
        'default_selling_price' => 1500,
    ]);

    $this->accUnit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->accVariant->id,
        'imei_or_serial' => null,
        'status' => 'in_stock',
        'cost_basis' => 900,
        'selling_price' => 1500,
        'condition' => 'brand_new',
        'sim_type' => 'na',
    ]);

    $this->vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Broker Abebe',
        'roles' => ['peer_vendor'],
    ]);
});

it('records a stock sale with attached in-stock accessory and absorbs gift cost when price is 0', function (): void {
    $action = app(RecordSaleAction::class);

    $saleData = [
        'customer_name' => 'Abebe Customer',
        'salesperson_id' => $this->owner->id,
        'paid_amount' => 120000, // Phone price only; charger is a free gift
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->phoneVariant->id,
                'inventory_unit_id' => $this->phoneUnit->id,
                'is_accessory' => false,
                'quantity' => 1,
                'unit_price' => 120000,
                'sourcing_type' => 'internal_stock',
            ],
            [
                'variant_id' => $this->accVariant->id,
                'inventory_unit_id' => $this->accUnit->id,
                'is_accessory' => true,
                'accessory_name' => '20W USB-C Adapter (Gift)',
                'quantity' => 1,
                'unit_price' => 0, // Free of charge
                'sourcing_type' => 'internal_stock',
            ],
        ],
    ];

    $order = $action->execute($saleData);

    expect($order)->toBeInstanceOf(SalesOrder::class)
        ->and($order->items)->toHaveCount(2);

    $phoneItem = $order->items->firstWhere('is_accessory', false);
    $accItem = $order->items->firstWhere('is_accessory', true);

    expect($phoneItem->unit_price)->toEqual('120000.00')
        ->and($phoneItem->unit_cost)->toEqual('100000.00')
        ->and($phoneItem->profit)->toEqual('20000.00');

    expect($accItem->unit_price)->toEqual('0.00')
        ->and($accItem->unit_cost)->toEqual('900.00')
        ->and($accItem->profit)->toEqual('-900.00') // Negative profit absorbed!
        ->and($accItem->parent_item_id)->toEqual($phoneItem->id);

    // Units must be marked sold
    expect($this->phoneUnit->fresh()->status)->toBe('sold')
        ->and($this->accUnit->fresh()->status)->toBe('sold');
});

it('records a vendor direct sale with an on-the-fly brokered accessory and paid on the spot', function (): void {
    $payload = [
        'product_name' => 'iPhone 16 Pro Max',
        'storage' => '256GB',
        'color' => 'Black Titanium',
        'vendor_contact_id' => $this->vendor->id,
        'vendor_cost' => 110000,
        'vendor_payment_method' => 'owed',
        'selling_price' => 125000,
        'paid_amount' => 125500, // 125,000 phone + 500 accessory
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'accessories' => [
            [
                'is_accessory' => true,
                'accessory_name' => 'Anker 30W Fast Charger',
                'quantity' => 1,
                'unit_price' => 500,
                'sourcing_type' => 'brokered_neighbour',
                'vendor_contact_id' => $this->vendor->id,
                'vendor_cost' => 400,
                'vendor_paid_now' => true,
                'vendor_paid_amount' => 400,
                'vendor_payment_account_id' => $this->account->id,
            ],
        ],
    ];

    $res = $this->actingAs($this->owner)
        ->postJson('/api/v1/sales/vendor-direct', $payload)
        ->assertCreated();

    $orderId = $res->json('data.id');
    $order = SalesOrder::with('items')->find($orderId);

    expect($order->items)->toHaveCount(2);

    $accItem = $order->items->firstWhere('is_accessory', true);
    expect($accItem->accessory_name)->toBe('Anker 30W Fast Charger')
        ->and($accItem->unit_price)->toEqual('500.00')
        ->and($accItem->vendor_cost)->toEqual('400.00')
        ->and($accItem->profit)->toEqual('100.00');

    // Financial account should have paid out 400 ETB for accessory and received 125,500 ETB
    // Initial 20,000 - 400 (acc payout) + 125,500 (customer payment) = 145,100
    expect((float) $this->account->fresh()->current_balance)->toEqual(145100.00);
});

it('records a sale with vendored accessory paid now via split accounts and displays correctly on partner statement', function (): void {
    $secondAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Cash in Safe',
        'type' => 'cash',
        'currency' => 'ETB',
        'current_balance' => 10000,
        'is_active' => true,
    ]);

    $payload = [
        'product_name' => 'iPhone 16 Pro',
        'storage' => '128GB',
        'color' => 'Desert Titanium',
        'vendor_contact_id' => $this->vendor->id,
        'vendor_cost' => 100000,
        'vendor_payment_method' => 'owed',
        'selling_price' => 110000,
        'paid_amount' => 110000,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'accessories' => [
            [
                'is_accessory' => true,
                'accessory_name' => 'MagSafe 25W Charger',
                'quantity' => 1,
                'unit_price' => 0, // Free gift
                'sourcing_type' => 'brokered_neighbour',
                'vendor_contact_id' => $this->vendor->id,
                'vendor_cost' => 3000,
                'vendor_paid_now' => true,
                'vendor_paid_amount' => 3000,
                'vendor_payment_splits' => [
                    ['financial_account_id' => $this->account->id, 'amount' => 1000],
                    ['financial_account_id' => $secondAccount->id, 'amount' => 2000],
                ],
            ],
        ],
    ];

    $res = $this->actingAs($this->owner)
        ->postJson('/api/v1/sales/vendor-direct', $payload)
        ->assertCreated();

    // CBE balance: 20,000 - 1,000 (split 1) + 110,000 (customer sale) = 129,000
    expect((float) $this->account->fresh()->current_balance)->toEqual(129000.00);
    // Cash in Safe balance: 10,000 - 2,000 (split 2) = 8,000
    expect((float) $secondAccount->fresh()->current_balance)->toEqual(8000.00);

    // Verify partner statement
    $statementAction = app(\App\Actions\GeneratePartnerStatementAction::class);
    $statement = $statementAction->execute($this->vendor);

    $ledger = collect($statement['ledger']);
    $accRow = $ledger->first(fn ($r) => str_contains($r['context'], 'MagSafe 25W Charger'));

    expect($accRow)->not->toBeNull()
        ->and($accRow['context'])->toContain('Vendored Accessory: MagSafe 25W Charger');
});
