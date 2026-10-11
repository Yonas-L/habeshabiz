<?php

use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Bole Mega Electronics',
        'slug' => 'bole-mega-electronics-waterfall',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Person',
        'email' => 'owner.waterfall@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->cashAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Main Cash Drawer',
        'type' => 'cash',
        'current_balance' => 50000.00,
        'is_active' => true,
    ]);

    $this->contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yonas Tech',
        'phone' => '+251911998877',
        'roles' => ['customer', 'supplier'],
        'is_active' => true,
    ]);
});

test('waterfall settlement clears oldest debt and cascades remaining amount to next debt (30k, 35k, 50k scenario)', function () {
    // Contact has 3 receivable debts: 30k, 35k, and 50k
    $debt1 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'original_amount' => 30000,
        'paid_amount' => 0,
        'remaining_amount' => 30000,
        'status' => 'open',
        'created_at' => now()->subDays(3),
    ]);

    $debt2 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'original_amount' => 35000,
        'paid_amount' => 0,
        'remaining_amount' => 35000,
        'status' => 'open',
        'created_at' => now()->subDays(2),
    ]);

    $debt3 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'original_amount' => 50000,
        'paid_amount' => 0,
        'remaining_amount' => 50000,
        'status' => 'open',
        'created_at' => now()->subDays(1),
    ]);

    // Customer pays 32,000 ETB via party waterfall endpoint
    $response = $this->actingAs($this->owner)->postJson('/api/v1/debts/settle-party', [
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'amount' => 32000,
        'financial_account_id' => $this->cashAccount->id,
        'notes' => 'Lump sum payment for open receivables',
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $debt1->refresh();
    $debt2->refresh();
    $debt3->refresh();

    // Debt 1 (30k) should be 100% complete / settled
    expect((float) $debt1->paid_amount)->toBe(30000.0)
        ->and((float) $debt1->remaining_amount)->toBe(0.0)
        ->and($debt1->status)->toBe('settled');

    // Debt 2 (35k) should have received leftover 2,000 ETB
    expect((float) $debt2->paid_amount)->toBe(2000.0)
        ->and((float) $debt2->remaining_amount)->toBe(33000.0)
        ->and($debt2->status)->toBe('partially_paid');

    // Debt 3 (50k) should remain completely open
    expect((float) $debt3->paid_amount)->toBe(0.0)
        ->and((float) $debt3->remaining_amount)->toBe(50000.0)
        ->and($debt3->status)->toBe('open');

    // Account balance should have increased by 32,000 ETB
    $this->cashAccount->refresh();
    expect((float) $this->cashAccount->current_balance)->toBe(82000.0);
});

test('waterfall returns dynamically backward when a payment is deleted or refunded', function () {
    $debt1 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'original_amount' => 30000,
        'paid_amount' => 0,
        'remaining_amount' => 30000,
        'status' => 'open',
        'created_at' => now()->subDays(3),
    ]);

    $debt2 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'original_amount' => 35000,
        'paid_amount' => 0,
        'remaining_amount' => 35000,
        'status' => 'open',
        'created_at' => now()->subDays(2),
    ]);

    // Settle 32,000
    $this->actingAs($this->owner)->postJson('/api/v1/debts/settle-party', [
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'amount' => 32000,
        'financial_account_id' => $this->cashAccount->id,
    ]);

    $debt1->refresh();
    $debt2->refresh();
    expect($debt1->status)->toBe('settled')
        ->and($debt2->status)->toBe('partially_paid');

    // When payments on debt 2 are deleted or reversed
    $debt2->payments()->delete();
    $debt2->recalculateSettlement();

    expect((float) $debt2->paid_amount)->toBe(0.0)
        ->and((float) $debt2->remaining_amount)->toBe(35000.0)
        ->and($debt2->status)->toBe('open');

    // And when payments on debt 1 are reversed
    $debt1->payments()->delete();
    $debt1->recalculateSettlement();

    expect((float) $debt1->paid_amount)->toBe(0.0)
        ->and((float) $debt1->remaining_amount)->toBe(30000.0)
        ->and($debt1->status)->toBe('open');
});

test('single debt settlement cascading to next debt when paying more than single debt remaining', function () {
    $debt1 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'original_amount' => 10000,
        'paid_amount' => 0,
        'remaining_amount' => 10000,
        'status' => 'open',
        'created_at' => now()->subDays(2),
    ]);

    $debt2 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->contact->id,
        'type' => 'receivable',
        'original_amount' => 15000,
        'paid_amount' => 0,
        'remaining_amount' => 15000,
        'status' => 'open',
        'created_at' => now()->subDays(1),
    ]);

    // Call single debt settle on debt1 with 14,000 ETB (exceeds 10,000 remaining on debt1)
    $response = $this->actingAs($this->owner)->postJson("/api/v1/debts/{$debt1->id}/payments", [
        'amount' => 14000,
        'financial_account_id' => $this->cashAccount->id,
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $debt1->refresh();
    $debt2->refresh();

    // Debt1 must be fully settled
    expect((float) $debt1->paid_amount)->toBe(10000.0)
        ->and((float) $debt1->remaining_amount)->toBe(0.0)
        ->and($debt1->status)->toBe('settled');

    // Debt2 must have received the excess 4,000
    expect((float) $debt2->paid_amount)->toBe(4000.0)
        ->and((float) $debt2->remaining_amount)->toBe(11000.0)
        ->and($debt2->status)->toBe('partially_paid');
});
