<?php

use App\Models\Contact;
use App\Models\Debt;
use App\Models\Expense;
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

    $this->cbe = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Commercial Bank of Ethiopia',
        'type' => 'bank',
        'current_balance' => 50000.00,
        'is_active' => true,
    ]);
});

test('owner can record expense and bank balance is deducted', function () {
    $response = $this->actingAs($this->owner)->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->cbe->id,
        'category' => 'food',
        'amount' => 1200.00,
        'description' => 'Team Lunch',
    ]);

    $response->assertStatus(201);
    expect((float) $this->cbe->fresh()->current_balance)->toBe(48800.00);
    expect(Expense::count())->toBe(1);
});

test('owner can delete an expense and financial balance is restored', function () {
    // Record expense
    $res = $this->actingAs($this->owner)->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->cbe->id,
        'category' => 'ride',
        'amount' => 500.00,
        'description' => 'Delivery ride',
    ]);
    $res->assertStatus(201);
    $expenseId = $res->json('data.id');

    expect((float) $this->cbe->fresh()->current_balance)->toBe(49500.00);
    expect(FinancialTransaction::where('type', 'expense')->count())->toBe(1);

    // Delete expense
    $delRes = $this->actingAs($this->owner)->deleteJson("/api/v1/expenses/{$expenseId}");
    $delRes->assertStatus(200)
        ->assertJsonPath('success', true);

    // Balance restored
    expect((float) $this->cbe->fresh()->current_balance)->toBe(50000.00);
    expect(Expense::find($expenseId))->toBeNull();
    expect(FinancialTransaction::where('type', 'expense')->count())->toBe(0);
});

test('deleting a vendor payout expense reverts settled vendor debts back to open', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Dagi Supplier',
        'roles' => ['supplier'],
    ]);

    // Create open payable debt to vendor for 20,000 ETB
    $payable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'payable',
        'original_amount' => 20000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 20000.00,
        'status' => 'open',
    ]);

    // Pay off 15,000 ETB via Expense payout
    $payRes = $this->actingAs($this->owner)->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->cbe->id,
        'category' => 'vendor_payout',
        'vendor_contact_id' => $vendor->id,
        'amount' => 15000.00,
        'description' => 'Wire transfer to Dagi Supplier',
    ]);
    $payRes->assertStatus(201);
    $expenseId = $payRes->json('data.id');

    expect((float) $this->cbe->fresh()->current_balance)->toBe(35000.00);
    $payable->refresh();
    expect((float) $payable->paid_amount)->toBe(15000.00);
    expect((float) $payable->remaining_amount)->toBe(5000.00);
    expect($payable->status)->toBe('partially_paid');

    // Now delete this accidentally recorded expense
    $delRes = $this->actingAs($this->owner)->deleteJson("/api/v1/expenses/{$expenseId}");
    $delRes->assertStatus(200);

    // Bank balance refunded back to 50,000 ETB
    expect((float) $this->cbe->fresh()->current_balance)->toBe(50000.00);

    // Vendor debt reverted back to 20,000 ETB remaining and 'open'
    $payable->refresh();
    expect((float) $payable->paid_amount)->toBe(0.00);
    expect((float) $payable->remaining_amount)->toBe(20000.00);
    expect($payable->status)->toBe('open');
});

test('non-owner cannot delete an expense', function () {
    $res = $this->actingAs($this->owner)->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->cbe->id,
        'category' => 'food',
        'amount' => 300.00,
        'description' => 'Coffee for office',
    ]);
    $expenseId = $res->json('data.id');

    $delRes = $this->actingAs($this->seller)->deleteJson("/api/v1/expenses/{$expenseId}");
    $delRes->assertStatus(403);

    expect(Expense::find($expenseId))->not->toBeNull();
});
