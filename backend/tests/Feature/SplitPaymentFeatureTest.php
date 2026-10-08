<?php

use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create(['name' => 'Split Pay Store', 'slug' => 'split-store-' . uniqid()]);
    TenantScope::setForcedTenantId($this->tenant->id);
    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Split Owner',
        'email' => 'split' . uniqid() . '@store.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);
    $this->actingAs($this->owner);

    $this->accCbe = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 100000,
    ]);

    $this->accTelebirr = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Telebirr Shop',
        'type' => 'mobile_money',
        'currency' => 'ETB',
        'current_balance' => 50000,
    ]);

    $this->partner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Nati Vendor',
        'roles' => ['vendor', 'customer'],
    ]);
});

test('settling payable debt split across CBE and Telebirr deducts both accounts and logs individual transactions', function () {
    $payableDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->partner->id,
        'type' => 'payable',
        'original_amount' => 60000,
        'paid_amount' => 0,
        'remaining_amount' => 60000,
        'status' => 'open',
    ]);

    $response = $this->postJson("/api/v1/debts/{$payableDebt->id}/payments", [
        'amount' => 50000,
        'payment_splits' => [
            ['financial_account_id' => $this->accCbe->id, 'amount' => 30000],
            ['financial_account_id' => $this->accTelebirr->id, 'amount' => 20000],
        ],
        'notes' => 'Split payoff to Nati',
    ]);

    $response->assertOk();

    // Verify balances deducted
    expect((float) $this->accCbe->fresh()->current_balance)->toBe(70000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(30000.0);

    // Verify debt updated
    $debt = $payableDebt->fresh();
    expect((float) $debt->paid_amount)->toBe(50000.0)
        ->and((float) $debt->remaining_amount)->toBe(10000.0)
        ->and($debt->status)->toBe('partially_paid');

    // Verify 2 DebtPayment rows created
    $payments = DebtPayment::where('debt_id', $payableDebt->id)->get();
    expect($payments)->toHaveCount(2);
    expect($payments[0]->split_group_id)->not->toBeNull()
        ->and($payments[0]->split_group_id)->toBe($payments[1]->split_group_id);

    // Verify 2 FinancialTransactions created
    $cbeTxn = FinancialTransaction::where('source_account_id', $this->accCbe->id)->first();
    $teleTxn = FinancialTransaction::where('source_account_id', $this->accTelebirr->id)->first();
    expect($cbeTxn)->not->toBeNull()
        ->and((float) $cbeTxn->amount)->toBe(30000.0)
        ->and($teleTxn)->not->toBeNull()
        ->and((float) $teleTxn->amount)->toBe(20000.0);

    // Verify account ledger endpoints display only their own transaction
    $cbeLedger = $this->getJson("/api/v1/accounts/{$this->accCbe->id}/activities")->json('data.activities');
    expect(count($cbeLedger))->toBe(1)
        ->and((float) $cbeLedger[0]['amount'])->toBe(30000.0);

    $teleLedger = $this->getJson("/api/v1/accounts/{$this->accTelebirr->id}/activities")->json('data.activities');
    expect(count($teleLedger))->toBe(1)
        ->and((float) $teleLedger[0]['amount'])->toBe(20000.0);
});

test('recording an expense split across accounts deducts both and reverts on deletion', function () {
    $response = $this->postJson('/api/v1/expenses', [
        'category' => 'rent',
        'amount' => 15000,
        'description' => 'Shop monthly lease',
        'payment_splits' => [
            ['financial_account_id' => $this->accCbe->id, 'amount' => 10000],
            ['financial_account_id' => $this->accTelebirr->id, 'amount' => 5000],
        ],
    ]);

    $response->assertCreated();
    $expenseId = $response->json('data.id');

    expect((float) $this->accCbe->fresh()->current_balance)->toBe(90000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(45000.0);

    // Verify 2 financial transactions
    $txns = FinancialTransaction::where('reference_number', "EXP-{$expenseId}")->get();
    expect($txns)->toHaveCount(2);

    // Delete expense and verify full refund across both accounts
    $delResponse = $this->deleteJson("/api/v1/expenses/{$expenseId}");
    $delResponse->assertOk();

    expect((float) $this->accCbe->fresh()->current_balance)->toBe(100000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(50000.0);

    expect(FinancialTransaction::where('reference_number', "EXP-{$expenseId}")->count())->toBe(0);
});

test('stock intake funded by split accounts deducts both bank accounts and logs individual supplier payments', function () {
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Pixel 8',
        'has_serials' => true,
    ]);
    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'color' => 'Obsidian',
        'storage' => '128GB',
    ]);

    $response = $this->postJson('/api/v1/inventory/units', [
        'variant_id' => $variant->id,
        'imei_or_serial' => 'IMEI-TEST-SPLIT-888',
        'condition' => 'brand_new',
        'cost_basis' => 40000,
        'source_type' => 'purchase',
        'funding_source' => 'account',
        'payment_splits' => [
            ['financial_account_id' => $this->accCbe->id, 'amount' => 25000],
            ['financial_account_id' => $this->accTelebirr->id, 'amount' => 15000],
        ],
    ]);

    $response->assertCreated();

    expect((float) $this->accCbe->fresh()->current_balance)->toBe(75000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(35000.0);

    $unit = \App\Models\InventoryUnit::where('imei_or_serial', 'IMEI-TEST-SPLIT-888')->first();
    expect($unit)->not->toBeNull()
        ->and($unit->payment_splits)->toHaveCount(2);

    $cbeTxn = FinancialTransaction::where('source_account_id', $this->accCbe->id)->where('type', 'supplier_payment')->first();
    $teleTxn = FinancialTransaction::where('source_account_id', $this->accTelebirr->id)->where('type', 'supplier_payment')->first();
    expect((float) $cbeTxn->amount)->toBe(25000.0)
        ->and((float) $teleTxn->amount)->toBe(15000.0);
});

test('collecting sales order payment split across accounts credits each account properly', function () {
    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'SO-TEST-COLLECT',
        'customer_id' => $this->partner->id,
        'total_amount' => 30000,
        'paid_amount' => 0,
        'payment_status' => 'unpaid',
        'payment_method' => 'credit',
        'order_date' => now(),
    ]);

    $response = $this->postJson("/api/v1/sales/{$order->id}/collect", [
        'amount' => 30000,
        'payment_splits' => [
            ['financial_account_id' => $this->accCbe->id, 'amount' => 20000],
            ['financial_account_id' => $this->accTelebirr->id, 'amount' => 10000],
        ],
    ]);

    $response->assertOk();

    expect((float) $this->accCbe->fresh()->current_balance)->toBe(120000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(60000.0);

    expect((float) $order->fresh()->paid_amount)->toBe(30000.0)
        ->and($order->fresh()->payment_status)->toBe('paid');
});

test('recording a lent receivable debt split across CBE and Telebirr deducts both accounts and logs loan disbursements', function () {
    $response = $this->postJson('/api/v1/debts', [
        'type' => 'receivable',
        'contact_id' => $this->partner->id,
        'amount' => 50000,
        'cash_flow_direction' => 'out',
        'payment_splits' => [
            ['financial_account_id' => $this->accCbe->id, 'amount' => 35000],
            ['financial_account_id' => $this->accTelebirr->id, 'amount' => 15000],
        ],
        'notes' => 'Emergency bridge loan to partner',
    ]);

    $response->assertStatus(201);
    $debtId = $response->json('data.id');

    // Verify balances deducted
    expect((float) $this->accCbe->fresh()->current_balance)->toBe(65000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(35000.0);

    // Verify debt created with splits stored
    $debt = Debt::find($debtId);
    expect($debt)->not->toBeNull()
        ->and((float) $debt->original_amount)->toBe(50000.0)
        ->and($debt->status)->toBe('open')
        ->and(count($debt->payment_splits))->toBe(2);

    // Verify 2 FinancialTransactions with loan_disbursement
    $txns = FinancialTransaction::where('reference_number', "DEBT-{$debtId}")->get();
    expect($txns)->toHaveCount(2);
    expect($txns[0]->type)->toBe('loan_disbursement');
    expect($txns[1]->type)->toBe('loan_disbursement');
});

test('recording direct payable peer vendor payout split across CBE and Telebirr settles debt immediately', function () {
    $response = $this->postJson('/api/v1/debts', [
        'type' => 'payable',
        'contact_id' => $this->partner->id,
        'amount' => 40000,
        'cash_flow_direction' => 'out',
        'payment_splits' => [
            ['financial_account_id' => $this->accCbe->id, 'amount' => 25000],
            ['financial_account_id' => $this->accTelebirr->id, 'amount' => 15000],
        ],
        'notes' => 'Immediate peer vendor settlement',
    ]);

    $response->assertStatus(201);
    $debtId = $response->json('data.id');

    // Verify balances deducted
    expect((float) $this->accCbe->fresh()->current_balance)->toBe(75000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(35000.0);

    // Verify debt is immediately settled
    $debt = Debt::find($debtId);
    expect($debt)->not->toBeNull()
        ->and((float) $debt->paid_amount)->toBe(40000.0)
        ->and((float) $debt->remaining_amount)->toBe(0.0)
        ->and($debt->status)->toBe('settled');

    // Verify 2 DebtPayment rows created
    $payments = DebtPayment::where('debt_id', $debtId)->get();
    expect($payments)->toHaveCount(2);
    expect($payments[0]->split_group_id)->not->toBeNull()
        ->and($payments[0]->split_group_id)->toBe($payments[1]->split_group_id);
});

test('recording debt with credit only does not deduct or credit any bank accounts', function () {
    $cbeInitial = (float) $this->accCbe->current_balance;
    $telebirrInitial = (float) $this->accTelebirr->current_balance;

    $response = $this->postJson('/api/v1/debts', [
        'type' => 'receivable',
        'contact_id' => $this->partner->id,
        'amount' => 20000,
        'cash_flow_direction' => 'none',
        'notes' => 'Pure store credit on phone purchase',
    ]);

    $response->assertStatus(201);
    $debtId = $response->json('data.id');

    // Account balances unchanged
    expect((float) $this->accCbe->fresh()->current_balance)->toBe($cbeInitial)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe($telebirrInitial);

    // No financial transactions created
    expect(FinancialTransaction::where('reference_number', "DEBT-{$debtId}")->count())->toBe(0);

    // Open receivable debt created
    $debt = Debt::find($debtId);
    expect($debt)->not->toBeNull()
        ->and((float) $debt->remaining_amount)->toBe(20000.0)
        ->and($debt->status)->toBe('open');
});

test('vendor fast direct sale with split vendor payout deducts multiple accounts and links settled debt payments', function () {
    $response = $this->postJson('/api/v1/sales/vendor-direct', [
        'product_name' => 'iPhone 15 Pro Max',
        'storage' => '256GB',
        'imei_or_serial' => '359123456789012',
        'condition' => 'Brand New',
        'vendor_contact_id' => $this->partner->id,
        'vendor_cost' => 80000,
        'vendor_payment_method' => 'paid_now',
        'vendor_payment_splits' => [
            ['financial_account_id' => $this->accCbe->id, 'amount' => 50000],
            ['financial_account_id' => $this->accTelebirr->id, 'amount' => 30000],
        ],
        'selling_price' => 95000,
        'paid_amount' => 95000,
        'payment_method' => 'telebirr',
        'financial_account_id' => $this->accTelebirr->id,
        'notes' => 'Fast vendor direct deal',
    ]);

    $response->assertStatus(201);
    $orderId = $response->json('data.id');

    // Customer paid 95,000 into Telebirr: 50,000 init + 95,000 = 145,000
    // Vendor payout deducted 30,000 from Telebirr: 145,000 - 30,000 = 115,000
    // Vendor payout deducted 50,000 from CBE: 100,000 - 50,000 = 50,000
    expect((float) $this->accCbe->fresh()->current_balance)->toBe(50000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(115000.0);

    // Verify 2 supplier_payment transactions logged for vendor payout
    $payoutTxns = FinancialTransaction::where('type', 'supplier_payment')
        ->where('contact_id', $this->partner->id)
        ->get();
    expect($payoutTxns)->toHaveCount(2);

    // Verify brokered debt is settled and has 2 DebtPayments linked by split_group_id
    $brokeredDebt = Debt::where('reference_type', 'brokered_sourcing')
        ->where('reference_id', $orderId)
        ->first();
    expect($brokeredDebt)->not->toBeNull()
        ->and($brokeredDebt->status)->toBe('settled')
        ->and(count($brokeredDebt->payment_splits))->toBe(2);

    $debtPayments = DebtPayment::where('debt_id', $brokeredDebt->id)->get();
    expect($debtPayments)->toHaveCount(2)
        ->and($debtPayments[0]->split_group_id)->not->toBeNull()
        ->and($debtPayments[0]->split_group_id)->toBe($debtPayments[1]->split_group_id);

    // Verify InventoryUnit has payment_splits
    $unit = \App\Models\InventoryUnit::where('imei_or_serial', '359123456789012')->first();
    expect($unit)->not->toBeNull()
        ->and($unit->funding_source)->toBe('bank')
        ->and(count($unit->payment_splits))->toBe(2);
});

test('stock intake with split funding (debtor offset + split bank accounts) applies both funding sources', function () {
    // 1. Create a debtor who owes the shop 20,000 ETB
    $debtor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Debtor Customer',
        'roles' => ['customer'],
    ]);
    $openReceivable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $debtor->id,
        'type' => 'receivable',
        'original_amount' => 20000,
        'paid_amount' => 0,
        'remaining_amount' => 20000,
        'status' => 'open',
    ]);

    // Create a product variant for intake
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Samsung S24 Ultra',
        'category' => 'phone_tablet',
        'has_serials' => true,
    ]);
    $variant = ProductVariant::create([
        'product_id' => $product->id,
        'storage' => '512GB',
        'default_selling_price' => 70000,
    ]);

    // Intake 1 device costing 50,000 ETB:
    // 20,000 ETB offset against debtor's open receivable
    // 30,000 ETB bank funding split: 20,000 from CBE + 10,000 from Telebirr
    $response = $this->postJson('/api/v1/inventory/units', [
        'variant_id' => $variant->id,
        'imei_or_serial' => '861234567890123',
        'cost_basis' => 50000,
        'selling_price' => 70000,
        'condition' => 'Brand New',
        'source_type' => 'purchase',
        'funding_source' => 'split',
        'receivable_contact_id' => $debtor->id,
        'receivable_offset_amount' => 20000,
        'payment_amount' => 30000,
        'payment_splits' => [
            ['financial_account_id' => $this->accCbe->id, 'amount' => 20000],
            ['financial_account_id' => $this->accTelebirr->id, 'amount' => 10000],
        ],
    ]);

    $response->assertStatus(201);

    // Verify debtor's debt is now settled
    expect((float) $openReceivable->fresh()->remaining_amount)->toBe(0.0)
        ->and($openReceivable->fresh()->status)->toBe('settled');

    // Verify bank account deductions: CBE 100k - 20k = 80k, Telebirr 50k - 10k = 40k
    expect((float) $this->accCbe->fresh()->current_balance)->toBe(80000.0)
        ->and((float) $this->accTelebirr->fresh()->current_balance)->toBe(40000.0);

    // Verify InventoryUnit
    $unit = \App\Models\InventoryUnit::where('imei_or_serial', '861234567890123')->first();
    expect($unit)->not->toBeNull()
        ->and($unit->funding_source)->toBe('split')
        ->and((float) $unit->receivable_offset_amount)->toBe(20000.0)
        ->and(count($unit->payment_splits))->toBe(2);
});

