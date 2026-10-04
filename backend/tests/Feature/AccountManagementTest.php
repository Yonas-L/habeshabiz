<?php

use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Bole Mega Electronics',
        'slug' => 'bole-mega-electronics',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yoni Owner',
        'email' => 'yoni.owner@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->seller = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husa Seller',
        'email' => 'husa.seller@example.com',
        'password' => Hash::make('password123'),
        'role' => 'salesperson',
    ]);
});

test('owner can create a bank account with opening balance', function () {
    $response = $this->actingAs($this->owner)->postJson('/api/v1/accounts', [
        'name' => 'CBE Main Account',
        'type' => 'bank',
        'account_number' => '1000123456789',
        'opening_balance' => 50000.00,
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.name', 'CBE Main Account')
        ->assertJsonPath('data.type', 'bank')
        ->assertJsonPath('data.is_custom_asset', false)
        ->assertJsonPath('data.current_balance', '50000.00');

    expect(FinancialAccount::where('name', 'CBE Main Account')->count())->toBe(1);
});

test('owner can create a custom asset (gold) with asset_details', function () {
    $response = $this->actingAs($this->owner)->postJson('/api/v1/accounts', [
        'name' => 'Gold Reserve',
        'type' => 'asset_gold',
        'opening_balance' => 0,
        'asset_details' => [
            'grams' => 50,
            'karat' => 21,
        ],
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.is_custom_asset', true)
        ->assertJsonPath('data.asset_details.grams', 50);
});

test('staff cannot create accounts (403)', function () {
    $this->actingAs($this->seller)->postJson('/api/v1/accounts', [
        'name' => 'Secret Stash',
        'type' => 'cash',
        'opening_balance' => 1000.00,
    ])->assertStatus(403);
});

test('owner can update account name and adjust balance', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Petty Cash',
        'type' => 'cash',
        'current_balance' => 5000.00,
        'is_custom_asset' => false,
        'is_active' => true,
    ]);

    $response = $this->actingAs($this->owner)->putJson("/api/v1/accounts/{$account->id}", [
        'name' => 'Main Petty Cash',
        'balance_adjustment' => -500.00, // spending 500
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.name', 'Main Petty Cash')
        ->assertJsonPath('data.current_balance', '4500.00');
});

test('owner can deactivate account', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Old Bank',
        'type' => 'bank',
        'current_balance' => 0,
        'is_custom_asset' => false,
        'is_active' => true,
    ]);

    $response = $this->actingAs($this->owner)->putJson("/api/v1/accounts/{$account->id}", [
        'is_active' => false,
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.is_active', false);
});

test('owner can delete account with transactions safely via soft delete preserving data', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Active Bank',
        'type' => 'bank',
        'current_balance' => 10000.00,
        'is_custom_asset' => false,
        'is_active' => true,
    ]);

    $otherAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Other Bank',
        'type' => 'bank',
        'current_balance' => 0,
        'is_custom_asset' => false,
        'is_active' => true,
    ]);

    $txn = FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'TXN-123',
        'source_account_id' => $account->id,
        'destination_account_id' => $otherAccount->id,
        'type' => 'transfer',
        'amount' => 1000,
        'date' => now(),
        'created_by' => $this->owner->id,
    ]);

    $response = $this->actingAs($this->owner)->deleteJson("/api/v1/accounts/{$account->id}");

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    // Account is soft-deleted: excluded from active queries but preserved in DB
    expect(FinancialAccount::find($account->id))->toBeNull();
    expect(FinancialAccount::withTrashed()->find($account->id))->not->toBeNull();

    // Dependable historical data is preserved
    $txn->refresh();
    expect($txn->sourceAccount)->not->toBeNull();
    expect($txn->sourceAccount->name)->toBe('Active Bank');
});

test('owner can store and update account with logo, and staff can view logo', function () {
    $dummyLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    $createRes = $this->actingAs($this->owner)->postJson('/api/v1/accounts', [
        'name' => 'Commercial Bank of Ethiopia',
        'type' => 'bank',
        'account_number' => '1000987654321',
        'opening_balance' => 25000.00,
        'logo' => $dummyLogo,
    ]);

    $createRes->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.logo', $dummyLogo);

    $accountId = $createRes->json('data.id');

    // Update logo
    $newLogo = 'data:image/svg+xml;utf8,<svg></svg>';
    $updateRes = $this->actingAs($this->owner)->putJson("/api/v1/accounts/{$accountId}", [
        'logo' => $newLogo,
    ]);

    $updateRes->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.logo', $newLogo);

    // Staff member viewing accounts should see the logo as well
    $staffRes = $this->actingAs($this->seller)->getJson('/api/v1/accounts');
    $staffRes->assertStatus(200)
        ->assertJsonPath('success', true);

    $accounts = collect($staffRes->json('data.treasury_accounts'));
    $cbe = $accounts->firstWhere('id', $accountId);
    expect($cbe)->not->toBeNull();
    expect($cbe['logo'])->toBe($newLogo);
});

test('owner can retrieve dedicated account activities ledger with precise running balance', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Ledger Test Bank',
        'type' => 'bank',
        'account_number' => '100012345678',
        'current_balance' => 15000.00,
        'is_custom_asset' => false,
        'is_active' => true,
    ]);

    $otherAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Cash Wallet',
        'type' => 'cash',
        'current_balance' => 5000.00,
        'is_custom_asset' => false,
        'is_active' => true,
    ]);

    // Create 3 transactions:
    // 1. Initial Deposit / Sale inflow +10,000
    // 2. Transfer out -2,000 (with fee 50 = total -2050)
    // 3. Customer payment inflow +7,050
    // Live balance: 15,000
    FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'TXN-IN-01',
        'destination_account_id' => $account->id,
        'type' => 'customer_payment',
        'amount' => 10000.00,
        'fee' => 0,
        'date' => now()->subDays(3),
        'created_by' => $this->owner->id,
        'description' => 'Initial customer deposit',
    ]);

    FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'TXN-OUT-02',
        'source_account_id' => $account->id,
        'destination_account_id' => $otherAccount->id,
        'type' => 'transfer',
        'amount' => 2000.00,
        'fee' => 50.00,
        'date' => now()->subDays(2),
        'created_by' => $this->owner->id,
        'description' => 'ATM withdrawal / transfer',
    ]);

    FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'TXN-IN-03',
        'destination_account_id' => $account->id,
        'type' => 'customer_payment',
        'amount' => 7050.00,
        'fee' => 0,
        'date' => now()->subDay(),
        'created_by' => $this->owner->id,
        'description' => 'Second sale payment',
    ]);

    $res = $this->actingAs($this->owner)->getJson("/api/v1/accounts/{$account->id}/activities");

    $res->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.summary.current_balance', 15000)
        ->assertJsonPath('data.summary.total_count', 3);

    $activities = $res->json('data.activities');
    expect($activities)->toHaveCount(3);

    // Latest activity should have stamped running balance equal to current_balance (15,000)
    expect($activities[0]['transaction_number'])->toBe('TXN-IN-03');
    expect($activities[0]['direction'])->toBe('inflow');
    expect($activities[0]['balance_after'])->toEqual(15000);

    // Prior activity (transfer out of 2050): balance was 15,000 - 7,050 = 7,950
    expect($activities[1]['transaction_number'])->toBe('TXN-OUT-02');
    expect($activities[1]['direction'])->toBe('outflow');
    expect($activities[1]['balance_after'])->toEqual(7950);

    // Filter by type=transfer
    $filterRes = $this->actingAs($this->owner)->getJson("/api/v1/accounts/{$account->id}/activities?type=transfer");
    $filterRes->assertStatus(200)
        ->assertJsonPath('data.summary.filtered_count', 1);
    expect($filterRes->json('data.activities.0.transaction_number'))->toBe('TXN-OUT-02');
});

test('accounts endpoint and dashboard summary calculate historical account and asset balances based on selected month', function () {
    $bank = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Past Month Bank',
        'type' => 'bank',
        'current_balance' => 20000.00,
        'is_custom_asset' => false,
        'is_active' => true,
    ]);
    $bank->forceFill(['created_at' => now()->subMonths(2)])->saveQuietly();

    $gold = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Physical Gold 24k',
        'type' => 'asset_gold',
        'current_balance' => 80000.00,
        'is_custom_asset' => true,
        'is_active' => true,
    ]);
    $gold->forceFill(['created_at' => now()->subMonths(2)])->saveQuietly();

    $forex = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Forex USD Holding',
        'type' => 'asset_fx',
        'current_balance' => 50000.00,
        'is_custom_asset' => true,
        'is_active' => true,
    ]);
    $forex->forceFill(['created_at' => now()->subMonths(2)])->saveQuietly();

    // Transaction that occurred this month (inflow of 5,000 into bank)
    FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'TXN-THIS-MONTH',
        'destination_account_id' => $bank->id,
        'type' => 'customer_payment',
        'amount' => 5000.00,
        'fee' => 0,
        'date' => now(),
        'created_by' => $this->owner->id,
    ]);

    $pastMonth = now()->subMonth()->format('Y-m');

    // 1. Fetch accounts for past month
    $res = $this->actingAs($this->owner)->getJson("/api/v1/accounts?month={$pastMonth}");
    $res->assertStatus(200);

    $treasury = collect($res->json('data.treasury_accounts'));
    $bankInPast = $treasury->firstWhere('id', $bank->id);
    expect((float) $bankInPast['current_balance'])->toEqual(15000.00);

    // 2. Fetch dashboard summary for past month
    $dashRes = $this->actingAs($this->owner)->getJson("/api/v1/dashboard/summary?month={$pastMonth}");
    $dashRes->assertStatus(200)
        ->assertJsonPath('success', true);

    $cap = $dashRes->json('data.capital_overview');
    expect($cap)->toHaveKeys(['cash_and_banks', 'custom_assets', 'liquid_finance', 'forex_assets', 'gold_assets', 'other_assets']);
    expect($cap['gold_assets'])->toBeGreaterThanOrEqual(80000);
    expect($cap['forex_assets'])->toBeGreaterThanOrEqual(50000);
});
