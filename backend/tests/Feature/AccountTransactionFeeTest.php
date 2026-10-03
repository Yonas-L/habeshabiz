<?php

use App\Models\Category;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create(['name' => 'Fee Test Store', 'slug' => 'fee-store-' . uniqid()]);
    TenantScope::setForcedTenantId($this->tenant->id);
    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Fee Owner',
        'email' => 'owner' . uniqid() . '@fee.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);
    $this->actingAs($this->owner);
});

test('outgoing fee is automatically applied on direct vendor counter payout', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Telebirr Wallet',
        'type' => 'mobile_money',
        'currency' => 'ETB',
        'current_balance' => 100000,
        'default_fee_type' => 'percentage',
        'default_fee_amount' => 1.5,
    ]);

    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Mekdi Vendor',
        'roles' => ['vendor'],
    ]);

    $category = Category::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Phones',
        'slug' => 'phones',
        'icon' => 'Smartphone',
        'has_serials' => true,
    ]);

    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15',
        'category_id' => $category->id,
        'category' => 'Phones',
        'has_serials' => true,
    ]);

    $variant = ProductVariant::create([
        'product_id' => $product->id,
        'storage' => '128GB',
        'color' => 'Black',
    ]);

    $response = $this->postJson('/api/v1/sales/vendor-direct', [
        'product_id' => $product->id,
        'variant_id' => $variant->id,
        'imei_or_serial' => '99887766554433',
        'condition' => 'Brand New',
        'vendor_contact_id' => $vendor->id,
        'vendor_cost' => 50000,
        'vendor_payment_method' => 'paid_now',
        'vendor_payment_account_id' => $account->id,
        'selling_price' => 60000,
        'paid_amount' => 60000,
        'payment_method' => 'telebirr',
        'financial_account_id' => $account->id,
    ]);

    $response->assertCreated();

    // Outgoing fee: 1.5% of 50,000 = 750 ETB
    // Total vendor deduction: 50,000 + 750 = 50,750 ETB
    // Customer payment received into account: +60,000 ETB
    // Initial: 100,000. Final balance: 100,000 - 50,750 + 60,000 = 109,250 ETB
    $account->refresh();
    expect((float) $account->current_balance)->toBe(109250.0);

    $payoutTxn = FinancialTransaction::where('source_account_id', $account->id)
        ->where('type', 'supplier_payment')
        ->latest()
        ->first();

    expect($payoutTxn)->not->toBeNull();
    expect((float) $payoutTxn->amount)->toBe(50000.0);
    expect((float) $payoutTxn->fee)->toBe(750.0);
});

test('outgoing fee is automatically applied on debt payable settlement', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 50000,
        'default_fee_type' => 'fixed',
        'default_fee_amount' => 15.0,
    ]);

    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Peer Supplier',
        'roles' => ['vendor'],
    ]);

    $debt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'payable',
        'original_amount' => 20000,
        'paid_amount' => 0,
        'remaining_amount' => 20000,
        'status' => 'open',
    ]);

    $response = $this->postJson("/api/v1/debts/{$debt->id}/payments", [
        'amount' => 20000,
        'financial_account_id' => $account->id,
    ]);

    $response->assertOk();

    // Outgoing fixed fee = 15 ETB
    // Account balance should be 50,000 - (20,000 + 15) = 29,985 ETB
    $account->refresh();
    expect((float) $account->current_balance)->toBe(29985.0);

    $txn = FinancialTransaction::where('source_account_id', $account->id)->latest()->first();
    expect((float) $txn->fee)->toBe(15.0);
});
