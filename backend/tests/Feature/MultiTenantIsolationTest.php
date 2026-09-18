<?php

use App\Models\Contact;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    // Create Tenant A
    $this->tenantA = Tenant::create([
        'name' => 'Bole Electronics Tenant A',
        'slug' => 'tenant-a',
    ]);

    $this->userA = User::create([
        'tenant_id' => $this->tenantA->id,
        'name' => 'User A',
        'email' => 'user.a@example.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);

    // Create Tenant B
    $this->tenantB = Tenant::create([
        'name' => 'Merkato Wholesale Tenant B',
        'slug' => 'tenant-b',
    ]);

    $this->userB = User::create([
        'tenant_id' => $this->tenantB->id,
        'name' => 'User B',
        'email' => 'user.b@example.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);
});

test('tenant A cannot see products belonging to tenant B', function () {
    // Seed product under Tenant B
    TenantScope::setForcedTenantId($this->tenantB->id);
    Product::create([
        'tenant_id' => $this->tenantB->id,
        'name' => 'Exclusive Samsung S25 for Tenant B',
        'category' => 'phones',
    ]);

    // Switch context to Tenant A
    TenantScope::setForcedTenantId($this->tenantA->id);
    $this->actingAs($this->userA);

    $products = Product::all();
    expect($products)->toBeEmpty();
});

test('tenant A cannot access financial accounts belonging to tenant B', function () {
    // Seed account under Tenant B
    TenantScope::setForcedTenantId($this->tenantB->id);
    FinancialAccount::create([
        'tenant_id' => $this->tenantB->id,
        'name' => 'Tenant B Private CBE Account',
        'type' => 'bank',
        'current_balance' => 500000.00,
    ]);

    // Switch context to Tenant A
    TenantScope::setForcedTenantId($this->tenantA->id);
    $this->actingAs($this->userA);

    $accounts = FinancialAccount::all();
    expect($accounts)->toBeEmpty();
});

test('creating contact auto-assigns active tenant id without leakage', function () {
    TenantScope::setForcedTenantId($this->tenantA->id);
    $this->actingAs($this->userA);

    $contact = Contact::create([
        'name' => 'Mekdi Peer Shop',
        'roles' => ['peer_vendor', 'supplier'],
    ]);

    expect($contact->tenant_id)->toBe($this->tenantA->id);
});
