<?php

use App\Actions\RecordSaleAction;
use App\Models\Contact;
use App\Models\Debt;
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
        'name' => 'HabeshaBiz Electronics',
        'slug' => 'habeshabiz-cust-test',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->user = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husni Kahmil',
        'email' => 'husni_cust@example.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);

    $this->actingAs($this->user);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Telebirr Main',
        'type' => 'mobile_money',
        'current_balance' => 50000.00,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro',
        'category' => 'phone',
        'has_serials' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '128GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 120000.00,
    ]);
});

test('sale without customer details is treated as walk-in customer', function () {
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-WALKIN-12345',
        'cost_basis' => 90000.00,
        'status' => 'in_stock',
    ]);

    $response = $this->postJson('/api/v1/sales', [
        'customer_id' => null,
        'customer_name' => null,
        'customer_phone' => null,
        'paid_amount' => 120000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $unit->id,
                'unit_price' => 120000.00,
            ],
        ],
    ]);

    $response->assertStatus(201);
    $order = SalesOrder::latest('id')->first();
    expect($order->customer_id)->toBeNull();
});

test('sale with empty customer strings is treated as walk-in customer', function () {
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-EMPTY-12345',
        'cost_basis' => 90000.00,
        'status' => 'in_stock',
    ]);

    $response = $this->postJson('/api/v1/sales', [
        'customer_id' => null,
        'customer_name' => '   ',
        'customer_phone' => '   ',
        'paid_amount' => 120000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $unit->id,
                'unit_price' => 120000.00,
            ],
        ],
    ]);

    $response->assertStatus(201);
    $order = SalesOrder::latest('id')->first();
    expect($order->customer_id)->toBeNull();
});

test('sale with new customer name and phone creates contact and links customer_id', function () {
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-NEWCUST-12345',
        'cost_basis' => 90000.00,
        'status' => 'in_stock',
    ]);

    $response = $this->postJson('/api/v1/sales', [
        'customer_name' => 'Dawit Mengistu',
        'customer_phone' => '+251 91 234 5678',
        'paid_amount' => 120000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $unit->id,
                'unit_price' => 120000.00,
            ],
        ],
    ]);

    $response->assertStatus(201);
    $order = SalesOrder::latest('id')->first();
    expect($order->customer_id)->not->toBeNull();

    $contact = Contact::find($order->customer_id);
    expect($contact)->not->toBeNull()
        ->and($contact->name)->toBe('Dawit Mengistu')
        ->and($contact->phone)->toBe('+251 91 234 5678')
        ->and($contact->hasRole('customer'))->toBeTrue();
});

test('credit sale with new customer creates contact and attaches receivable debt', function () {
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-CREDIT-12345',
        'cost_basis' => 90000.00,
        'status' => 'in_stock',
    ]);

    $response = $this->postJson('/api/v1/sales', [
        'customer_name' => 'Selamawit Kebede',
        'customer_phone' => '0922334455',
        'paid_amount' => 80000.00,
        'payment_method' => 'credit',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $unit->id,
                'unit_price' => 120000.00,
            ],
        ],
    ]);

    $response->assertStatus(201);
    $order = SalesOrder::latest('id')->first();
    expect($order->customer_id)->not->toBeNull()
        ->and($order->payment_status)->toBe('partially_paid');

    $contact = Contact::find($order->customer_id);
    expect($contact->name)->toBe('Selamawit Kebede');

    $debt = Debt::where('reference_id', $order->id)->where('type', 'receivable')->first();
    expect($debt)->not->toBeNull()
        ->and($debt->contact_id)->toBe($contact->id)
        ->and((float) $debt->remaining_amount)->toBe(40000.00);
});

test('sale with already registered phone number re-uses existing contact instead of creating duplicate', function () {
    $existing = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Original Customer',
        'phone' => '+251 91 777 8888',
        'roles' => ['customer'],
        'is_active' => true,
    ]);

    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-REUSE-12345',
        'cost_basis' => 90000.00,
        'status' => 'in_stock',
    ]);

    $response = $this->postJson('/api/v1/sales', [
        'customer_name' => 'Original Customer (Second Sale)',
        'customer_phone' => '+251 91 777 8888',
        'paid_amount' => 120000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $unit->id,
                'unit_price' => 120000.00,
            ],
        ],
    ]);

    $response->assertStatus(201);
    $order = SalesOrder::latest('id')->first();
    expect($order->customer_id)->toBe($existing->id);

    // Verify no duplicate contact was inserted
    $matchingContacts = Contact::where('tenant_id', $this->tenant->id)->where('phone', '+251 91 777 8888')->get();
    expect($matchingContacts)->toHaveCount(1);
});

