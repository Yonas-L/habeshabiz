<?php

use App\Models\Contact;
use App\Models\Debt;
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

    $this->cashAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Main Cash Drawer',
        'type' => 'cash',
        'current_balance' => 100000.00,
        'is_active' => true,
    ]);
});

test('owner can manually record a receivable balance without cash movement', function () {
    $response = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'receivable',
        'contact_name' => 'Abebe Customer',
        'contact_phone' => '+251911223344',
        'amount' => 15000.00,
        'due_date' => now()->addDays(14)->toDateString(),
        'notes' => 'Lent money for emergency purchase',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.type', 'receivable')
        ->assertJsonPath('data.original_amount', '15000.00')
        ->assertJsonPath('data.remaining_amount', '15000.00');

    expect(Debt::where('type', 'receivable')->count())->toBe(1);
    expect(Contact::where('name', 'Abebe Customer')->exists())->toBeTrue();
    // Cash drawer was untouched
    expect((float) $this->cashAccount->fresh()->current_balance)->toBe(100000.00);
});

test('owner can manually record a receivable with immediate cash disbursement', function () {
    $contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Dawit Peer Trader',
        'roles' => ['customer'],
    ]);

    $response = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'receivable',
        'contact_id' => $contact->id,
        'amount' => 25000.00,
        'disburse_account_id' => $this->cashAccount->id,
        'notes' => 'Cash lent out from drawer for neighbour stock purchase',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true);

    // Cash drawer decremented by 25,000 ETB
    expect((float) $this->cashAccount->fresh()->current_balance)->toBe(75000.00);
});

test('owner can manually record a payable with immediate cash receipt', function () {
    $response = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'payable',
        'contact_name' => 'Haji Supplier (Electronics Importer)',
        'amount' => 50000.00,
        'disburse_account_id' => $this->cashAccount->id,
        'notes' => 'Borrowed working capital from Haji',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.type', 'payable');

    // Cash drawer incremented by 50,000 ETB
    expect((float) $this->cashAccount->fresh()->current_balance)->toBe(150000.00);
});

test('owner can record peer vendor payout with immediate cash out which settles payable', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Broker Dawit',
        'roles' => ['peer_vendor'],
    ]);

    $response = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'payable',
        'contact_id' => $vendor->id,
        'amount' => 30000.00,
        'disburse_account_id' => $this->cashAccount->id,
        'cash_flow_direction' => 'out',
        'notes' => 'Settled accessory batch payout to Dawit',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'settled')
        ->assertJsonPath('data.remaining_amount', '0.00')
        ->assertJsonPath('data.paid_amount', '30000.00');

    // Balance decreased by 30,000 ETB
    expect((float) $this->cashAccount->fresh()->current_balance)->toBe(70000.00);

    // No open debt remaining
    expect(Debt::where('contact_id', $vendor->id)->where('status', 'open')->count())->toBe(0);
});

test('owner can record customer payment with immediate cash in which settles receivable', function () {
    $customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Sara Buyer',
        'roles' => ['customer'],
    ]);

    $response = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'receivable',
        'contact_id' => $customer->id,
        'amount' => 15000.00,
        'disburse_account_id' => $this->cashAccount->id,
        'cash_flow_direction' => 'in',
        'notes' => 'Advance deposit for upcoming order',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'settled')
        ->assertJsonPath('data.remaining_amount', '0.00')
        ->assertJsonPath('data.paid_amount', '15000.00');

    // Balance increased by 15,000 ETB
    expect((float) $this->cashAccount->fresh()->current_balance)->toBe(115000.00);

    // No open debt remaining
    expect(Debt::where('contact_id', $customer->id)->where('status', 'open')->count())->toBe(0);
});

test('salesperson is forbidden from creating manual debts (403)', function () {
    $this->actingAs($this->seller)->postJson('/api/v1/debts', [
        'type' => 'payable',
        'contact_name' => 'Unauthorized Loan',
        'amount' => 10000.00,
    ])->assertStatus(403);
});

test('owner can update debt details and amount', function () {
    $debt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => Contact::create(['tenant_id' => $this->tenant->id, 'name' => 'Test Person', 'roles' => ['customer']])->id,
        'type' => 'receivable',
        'original_amount' => 10000.00,
        'paid_amount' => 0,
        'remaining_amount' => 10000.00,
        'status' => 'open',
    ]);

    $response = $this->actingAs($this->owner)->putJson("/api/v1/debts/{$debt->id}", [
        'original_amount' => 12000.00,
        'notes' => 'Corrected loan amount',
        'due_date' => now()->addMonth()->toDateString(),
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.original_amount', '12000.00')
        ->assertJsonPath('data.remaining_amount', '12000.00');

    expect($debt->fresh()->notes)->toBe('Corrected loan amount');
});

test('owner can delete debt without payments, but cannot delete settled debt', function () {
    $debt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => Contact::create(['tenant_id' => $this->tenant->id, 'name' => 'Mistaken Entry', 'roles' => ['customer']])->id,
        'type' => 'receivable',
        'original_amount' => 5000.00,
        'paid_amount' => 0,
        'remaining_amount' => 5000.00,
        'status' => 'open',
    ]);

    // Delete unused debt
    $this->actingAs($this->owner)->deleteJson("/api/v1/debts/{$debt->id}")
        ->assertStatus(200);

    expect(Debt::find($debt->id))->toBeNull();

    // Try deleting debt with partial payment
    $debtWithPayment = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => Contact::create(['tenant_id' => $this->tenant->id, 'name' => 'Paying Customer', 'roles' => ['customer']])->id,
        'type' => 'receivable',
        'original_amount' => 10000.00,
        'paid_amount' => 2000.00,
        'remaining_amount' => 8000.00,
        'status' => 'partially_paid',
    ]);

    $this->actingAs($this->owner)->deleteJson("/api/v1/debts/{$debtWithPayment->id}")
        ->assertStatus(422);

    expect(Debt::find($debtWithPayment->id))->not->toBeNull();
});

test('owner can record receivable debt with bank deduction (wire transfer to contact)', function () {
    $res = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'receivable',
        'contact_name' => 'Kirubel Friend',
        'contact_phone' => '+251911998877',
        'amount' => 500.00,
        'disburse_account_id' => $this->cashAccount->id,
        'cash_flow_direction' => 'out',
        'notes' => 'Transferred for urgent supplies',
    ]);

    $res->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.type', 'receivable')
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.original_amount', '500.00')
        ->assertJsonPath('data.remaining_amount', '500.00')
        ->assertJsonPath('data.paid_amount', '0.00');

    // Balance deducted
    expect((float) $this->cashAccount->fresh()->current_balance)->toBe(99500.00);

    // Financial transaction logged
    expect(FinancialTransaction::where('type', 'loan_disbursement')->count())->toBe(1);
});

test('recording receivable automatically cancels out existing payable to the same contact', function () {
    $contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Supplier Abebe',
        'roles' => ['supplier', 'customer'],
    ]);

    // Merchant owes Abebe 10,000 ETB
    $payable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $contact->id,
        'type' => 'payable',
        'reference_type' => 'direct_credit',
        'original_amount' => 10000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 10000.00,
        'status' => 'open',
    ]);

    // Merchant records a 4,000 ETB receivable wire to Abebe
    $res = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'receivable',
        'contact_id' => $contact->id,
        'amount' => 4000.00,
        'disburse_account_id' => $this->cashAccount->id,
        'cash_flow_direction' => 'out',
        'notes' => 'Sent advance wire',
    ]);

    $res->assertStatus(201);
    $receivableId = $res->json('data.id');

    // Existing payable is paid down by 4,000 ETB
    $payable->refresh();
    expect((float) $payable->paid_amount)->toBe(4000.00);
    expect((float) $payable->remaining_amount)->toBe(6000.00);
    expect($payable->status)->toBe('partially_paid');

    // New receivable is fully absorbed / settled
    $receivable = Debt::find($receivableId);
    expect((float) $receivable->paid_amount)->toBe(4000.00);
    expect((float) $receivable->remaining_amount)->toBe(0.00);
    expect($receivable->status)->toBe('settled');

    // Bank was decremented
    expect((float) $this->cashAccount->fresh()->current_balance)->toBe(96000.00);

    // Partner statement ledger reflects the settlement cleanly
    $statementRes = $this->actingAs($this->owner)->getJson("/api/v1/contacts/{$contact->id}/statement");
    $statementRes->assertStatus(200);
    expect($statementRes->json('data.kpis.current_net_balance'))->toEqual(-6000);
});

test('recording receivable exceeding payable settles payable and retains excess advance', function () {
    $contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Partner Chala',
        'roles' => ['supplier', 'customer'],
    ]);

    // Merchant owes Chala 5,000 ETB
    $payable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $contact->id,
        'type' => 'payable',
        'reference_type' => 'direct_credit',
        'original_amount' => 5000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 5000.00,
        'status' => 'open',
    ]);

    // Merchant wires 7,000 ETB to Chala
    $res = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'receivable',
        'contact_id' => $contact->id,
        'amount' => 7000.00,
        'disburse_account_id' => $this->cashAccount->id,
        'cash_flow_direction' => 'out',
        'notes' => 'Overpayment advance',
    ]);

    $res->assertStatus(201);
    $receivableId = $res->json('data.id');

    // Payable is fully settled
    $payable->refresh();
    expect((float) $payable->paid_amount)->toBe(5000.00);
    expect((float) $payable->remaining_amount)->toBe(0.00);
    expect($payable->status)->toBe('settled');

    // Receivable has 2,000 ETB remaining open advance
    $receivable = Debt::find($receivableId);
    expect((float) $receivable->paid_amount)->toBe(5000.00);
    expect((float) $receivable->remaining_amount)->toBe(2000.00);
    expect($receivable->status)->toBe('partially_paid');

    // Statement shows Chala now owes merchant +2,000 ETB
    $statementRes = $this->actingAs($this->owner)->getJson("/api/v1/contacts/{$contact->id}/statement");
    $statementRes->assertStatus(200);
    expect($statementRes->json('data.kpis.current_net_balance'))->toEqual(2000);
});

test('recording payable automatically cancels out existing receivable from the same contact', function () {
    $contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Borrower Dawit',
        'roles' => ['supplier', 'customer'],
    ]);

    // Dawit owes merchant 8,000 ETB
    $receivable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $contact->id,
        'type' => 'receivable',
        'reference_type' => 'direct_credit',
        'original_amount' => 8000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 8000.00,
        'status' => 'open',
    ]);

    // Merchant records a 3,000 ETB payable for Dawit (credit only)
    $res = $this->actingAs($this->owner)->postJson('/api/v1/debts', [
        'type' => 'payable',
        'contact_id' => $contact->id,
        'amount' => 3000.00,
        'notes' => 'Agreed fee / purchase credit',
    ]);

    $res->assertStatus(201);
    $payableId = $res->json('data.id');

    // Existing receivable drops by 3,000 ETB
    $receivable->refresh();
    expect((float) $receivable->paid_amount)->toBe(3000.00);
    expect((float) $receivable->remaining_amount)->toBe(5000.00);
    expect($receivable->status)->toBe('partially_paid');

    // New payable is completely settled via mutual offset
    $payable = Debt::find($payableId);
    expect((float) $payable->paid_amount)->toBe(3000.00);
    expect((float) $payable->remaining_amount)->toBe(0.00);
    expect($payable->status)->toBe('settled');

    // Statement net balance reflects +5,000 ETB
    $statementRes = $this->actingAs($this->owner)->getJson("/api/v1/contacts/{$contact->id}/statement");
    $statementRes->assertStatus(200);
    expect($statementRes->json('data.kpis.current_net_balance'))->toEqual(5000);
});


