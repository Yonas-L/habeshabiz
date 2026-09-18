<?php

use App\Actions\RecordSaleAction;
use App\Actions\SettleDebtPaymentAction;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
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
        'name' => 'Yoni',
        'email' => 'yoni@example.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);

    $this->actingAs($this->user);

    $this->mekdi = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Mekdi',
        'roles' => ['peer_vendor', 'supplier'],
    ]);

    $this->customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Customer Dawit',
        'roles' => ['customer'],
    ]);

    $this->cbeAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'current_balance' => 100000.00,
    ]);

    $this->telebirrAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'TeleBirr Counter',
        'type' => 'mobile_money',
        'current_balance' => 10000.00,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Anker Power Bank 20000mAh',
        'category' => 'accessories',
        'has_serials' => false,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'color' => 'Black',
        'default_selling_price' => 20000.00,
    ]);
});

test('brokered neighbour sale creates order, profit, and auto-generates peer payable', function () {
    $action = new RecordSaleAction;

    $order = $action->execute([
        'customer_id' => $this->customer->id,
        'salesperson_id' => $this->user->id,
        'discount_amount' => 0,
        'paid_amount' => 20000.00,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->telebirrAccount->id,
        'notes' => 'Sourced from Mekdi for walk-in customer',
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'quantity' => 1,
                'unit_price' => 20000.00,
                'sourcing_type' => 'brokered_neighbour',
                'vendor_contact_id' => $this->mekdi->id,
                'vendor_cost' => 15000.00,
            ],
        ],
    ]);

    // Verify order totals
    expect((float) $order->total_amount)->toBe(20000.00)
        ->and((float) $order->paid_amount)->toBe(20000.00)
        ->and($order->payment_status)->toBe('paid');

    // Verify item profit calculation: 20000 - 15000 = 5000 ETB
    $item = $order->items->first();
    expect((float) $item->profit)->toBe(5000.00)
        ->and($item->sourcing_type)->toBe('brokered_neighbour');

    // Verify automated payable generated for Mekdi
    $payable = Debt::where('contact_id', $this->mekdi->id)->first();
    expect($payable)->not->toBeNull()
        ->and($payable->type)->toBe('payable')
        ->and((float) $payable->original_amount)->toBe(15000.00)
        ->and((float) $payable->remaining_amount)->toBe(15000.00)
        ->and($payable->status)->toBe('open');

    // Verify TeleBirr balance incremented by 20,000 ETB (from 10,000 to 30,000)
    $this->telebirrAccount->refresh();
    expect((float) $this->telebirrAccount->current_balance)->toBe(30000.00);
});

test('settling debt payment decrements remaining balance and synchronizes treasury', function () {
    // Create an existing payable to Mekdi for 15,000 ETB
    $payable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->mekdi->id,
        'type' => 'payable',
        'reference_type' => 'brokered_sourcing',
        'original_amount' => 15000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 15000.00,
        'status' => 'open',
    ]);

    $settleAction = new SettleDebtPaymentAction;

    // Make partial settlement of 10,000 ETB from CBE
    $settleAction->execute($payable, [
        'amount' => 10000.00,
        'financial_account_id' => $this->cbeAccount->id,
        'reference_number' => 'CBE-TX-99881',
        'notes' => 'Partial cash transfer to Mekdi',
    ]);

    $payable->refresh();
    expect((float) $payable->paid_amount)->toBe(10000.00)
        ->and((float) $payable->remaining_amount)->toBe(5000.00)
        ->and($payable->status)->toBe('partially_paid');

    // Verify CBE balance decremented by 10,000 ETB (from 100,000 to 90,000)
    $this->cbeAccount->refresh();
    expect((float) $this->cbeAccount->current_balance)->toBe(90000.00);
});
