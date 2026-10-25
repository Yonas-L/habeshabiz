<?php

use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Undo Test Electronics',
        'slug' => 'undo-test-electronics',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Dave',
        'email' => 'owner.dave@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->salesperson = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Staff Alice',
        'email' => 'staff.alice@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'salesperson',
    ]);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Main Cash Drawer',
        'type' => 'cash',
        'currency' => 'ETB',
        'current_balance' => 50000.0,
        'is_active' => true,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro',
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'color' => 'Natural Titanium',
        'storage' => '256GB',
    ]);

    $this->stock = InventoryStock::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'quantity_on_hand' => 0,
        'average_cost' => 80000.0,
    ]);
});

test('non-owner cannot preview or execute action undo', function () {
    $log = AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'action' => 'sale_created',
        'entity_type' => 'SalesOrder',
        'entity_id' => (string) Str::uuid(),
        'created_at' => now(),
    ]);

    $this->actingAs($this->salesperson)
        ->getJson("/api/v1/audit-logs/{$log->id}/undo-preview")
        ->assertStatus(403);

    $this->actingAs($this->salesperson)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo")
        ->assertStatus(403);
});

test('action outside 24-hour undo window cannot be undone', function () {
    $log = AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'action' => 'sale_created',
        'entity_type' => 'SalesOrder',
        'entity_id' => (string) Str::uuid(),
        'created_at' => now()->subHours(25),
    ]);

    $previewRes = $this->actingAs($this->owner)
        ->getJson("/api/v1/audit-logs/{$log->id}/undo-preview");

    $previewRes->assertStatus(422)
        ->assertJson([
            'success' => false,
            'expired' => true,
        ]);

    $executeRes = $this->actingAs($this->owner)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo");

    $executeRes->assertStatus(422)
        ->assertJson([
            'success' => false,
            'expired' => true,
        ]);
});

test('successfully previews and undoes a sale', function () {
    // 1. Setup a unit that was sold
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-TEST-999',
        'cost_basis' => 80000.0,
        'selling_price' => 100000.0,
        'status' => 'sold',
        'sold_at' => now(),
        'location' => 'Sold',
    ]);

    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'SO-TEST-001',
        'salesperson_id' => $this->salesperson->id,
        'total_amount' => 100000.0,
        'paid_amount' => 100000.0,
        'payment_status' => 'paid',
        'financial_account_id' => $this->account->id,
        'order_date' => now(),
    ]);

    SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $order->id,
        'variant_id' => $this->variant->id,
        'inventory_unit_id' => $unit->id,
        'quantity' => 1,
        'unit_price' => 100000.0,
        'unit_cost' => 80000.0,
        'profit' => 20000.0,
        'sourcing_type' => 'internal_stock',
    ]);

    // Initial account has received the 100k
    $this->account->increment('current_balance', 100000.0);
    $initialBalance = (float) $this->account->fresh()->current_balance;

    $revertGroupId = (string) Str::uuid();
    $log = AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->salesperson->id,
        'action' => 'sale_created',
        'entity_type' => 'SalesOrder',
        'entity_id' => $order->id,
        'revert_group_id' => $revertGroupId,
        'created_at' => now(),
    ]);

    // 2. Preview undo
    $previewRes = $this->actingAs($this->owner)
        ->getJson("/api/v1/audit-logs/{$log->id}/undo-preview")
        ->assertStatus(200);

    expect($previewRes->json('data.can_undo'))->toBeTrue()
        ->and($previewRes->json('data.blocked'))->toBeFalse()
        ->and($previewRes->json('data.hierarchy_tree'))->not->toBeNull();

    // 3. Execute undo
    $executeRes = $this->actingAs($this->owner)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo")
        ->assertStatus(200);

    expect($executeRes->json('success'))->toBeTrue();

    // Verify order is deleted
    expect(SalesOrder::find($order->id))->toBeNull();
    expect(SalesOrderItem::where('sales_order_id', $order->id)->count())->toBe(0);

    // Verify inventory unit is restored to in_stock
    $unitFresh = $unit->fresh();
    expect($unitFresh->status)->toBe('in_stock')
        ->and($unitFresh->sold_at)->toBeNull();

    // Verify account balance had 100,000 ETB refunded/deducted
    expect((float) $this->account->fresh()->current_balance)->toBe($initialBalance - 100000.0);

    // Verify audit log is marked reverted
    $logFresh = $log->fresh();
    expect($logFresh->isReverted())->toBeTrue()
        ->and($logFresh->reverted_by)->toBe($this->owner->id);

    // Verify second attempt to undo is rejected
    $secondAttempt = $this->actingAs($this->owner)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo")
        ->assertStatus(422);

    expect($secondAttempt->json('is_reverted'))->toBeTrue();
});

test('sale undo is blocked if downstream debt payments were collected', function () {
    $customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Credit Customer Bob',
        'roles' => ['customer'],
        'is_active' => true,
    ]);

    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'SO-TEST-CREDIT',
        'customer_id' => $customer->id,
        'salesperson_id' => $this->salesperson->id,
        'total_amount' => 50000.0,
        'paid_amount' => 0.0,
        'payment_status' => 'unpaid',
        'credit_sale' => true,
        'order_date' => now(),
    ]);

    $debt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $customer->id,
        'type' => 'receivable',
        'reference_type' => 'sales_order',
        'reference_id' => $order->id,
        'original_amount' => 50000.0,
        'paid_amount' => 0.0,
        'remaining_amount' => 50000.0,
        'status' => 'open',
    ]);

    $log = AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->salesperson->id,
        'action' => 'sale_created',
        'entity_type' => 'SalesOrder',
        'entity_id' => $order->id,
        'created_at' => now()->subMinutes(10),
    ]);

    // Downstream payment was recorded 5 minutes later
    DebtPayment::create([
        'tenant_id' => $this->tenant->id,
        'debt_id' => $debt->id,
        'financial_account_id' => $this->account->id,
        'amount' => 20000.0,
        'payment_date' => now(),
        'reference_number' => 'PAY-DOWNSTREAM',
        'notes' => 'Customer paid partial',
        'created_by' => $this->salesperson->id,
        'created_at' => now()->subMinutes(5),
    ]);

    // Preview should show blocked
    $previewRes = $this->actingAs($this->owner)
        ->getJson("/api/v1/audit-logs/{$log->id}/undo-preview")
        ->assertStatus(200);

    expect($previewRes->json('data.can_undo'))->toBeFalse()
        ->and($previewRes->json('data.blocked'))->toBeTrue()
        ->and(count($previewRes->json('data.blocked_reasons')))->toBeGreaterThan(0);

    // Execute must fail with 422
    $executeRes = $this->actingAs($this->owner)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo")
        ->assertStatus(422);

    expect($executeRes->json('blocked'))->toBeTrue();
});

test('successfully previews and undoes an expense', function () {
    $expense = Expense::create([
        'tenant_id' => $this->tenant->id,
        'financial_account_id' => $this->account->id,
        'category' => 'food',
        'amount' => 1500.0,
        'description' => 'Staff lunch Friday',
        'date' => now(),
        'created_by' => $this->owner->id,
    ]);

    // Account was deducted 1,500
    $this->account->decrement('current_balance', 1500.0);
    $balanceBeforeUndo = (float) $this->account->fresh()->current_balance;

    $log = AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'action' => 'expense_created',
        'entity_type' => 'Expense',
        'entity_id' => $expense->id,
        'created_at' => now(),
    ]);

    $previewRes = $this->actingAs($this->owner)
        ->getJson("/api/v1/audit-logs/{$log->id}/undo-preview")
        ->assertStatus(200);

    expect($previewRes->json('data.can_undo'))->toBeTrue();

    $executeRes = $this->actingAs($this->owner)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo")
        ->assertStatus(200);

    expect($executeRes->json('success'))->toBeTrue();

    // Account balance should increase back by 1500
    expect((float) $this->account->fresh()->current_balance)->toBe($balanceBeforeUndo + 1500.0);

    // Expense record should be deleted
    expect(Expense::find($expense->id))->toBeNull();
});

test('successfully previews and undoes an account transfer', function () {
    $savingsAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Bank Savings',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 20000.0,
        'is_active' => true,
    ]);

    $initialSource = (float) $this->account->current_balance;
    $initialDest = (float) $savingsAccount->current_balance;

    $transferAmount = 5000.0;
    $transferFee = 25.0;

    // Transfer executed: source -5025, dest +5000
    $this->account->decrement('current_balance', $transferAmount + $transferFee);
    $savingsAccount->increment('current_balance', $transferAmount);

    $txn = FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'TRF-TEST-123',
        'source_account_id' => $this->account->id,
        'destination_account_id' => $savingsAccount->id,
        'type' => 'transfer',
        'amount' => $transferAmount,
        'fee' => $transferFee,
        'description' => 'Transfer to savings',
        'date' => now(),
        'created_by' => $this->owner->id,
    ]);

    $log = AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'action' => 'account_transfer',
        'entity_type' => 'FinancialTransaction',
        'entity_id' => (string) $txn->id,
        'created_at' => now(),
    ]);

    $previewRes = $this->actingAs($this->owner)
        ->getJson("/api/v1/audit-logs/{$log->id}/undo-preview")
        ->assertStatus(200);

    expect($previewRes->json('data.can_undo'))->toBeTrue();

    $executeRes = $this->actingAs($this->owner)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo")
        ->assertStatus(200);

    expect($executeRes->json('success'))->toBeTrue();

    // Source account should be restored to initial balance (+5025)
    expect((float) $this->account->fresh()->current_balance)->toBe($initialSource);

    // Destination account should be restored to initial balance (-5000)
    expect((float) $savingsAccount->fresh()->current_balance)->toBe($initialDest);

    // Transaction deleted
    expect(FinancialTransaction::find($txn->id))->toBeNull();
});
