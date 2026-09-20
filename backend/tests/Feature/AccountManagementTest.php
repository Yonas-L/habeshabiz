<?php

use App\Models\FinancialAccount;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;
use App\Models\FinancialTransaction;

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
            'karat' => 21
        ]
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

test('owner cannot delete account with transactions (should deactivate instead)', function () {
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

    FinancialTransaction::create([
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

    $response->assertStatus(422)
        ->assertJsonPath('success', false);

    $account->refresh();
    expect($account->is_active)->toBeFalse();
    expect(FinancialAccount::find($account->id))->not->toBeNull();
});
