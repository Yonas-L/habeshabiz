<?php

use App\Actions\OffsetStaffBonusDebtAction;
use App\Actions\RecordSaleAction;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;

beforeEach(function () {
    $this->tenant = Tenant::create(['name' => 'Bole Shop', 'slug' => 'bole-offset-test']);
    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $this->salesperson = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'salesperson',
        'name' => 'Yonas Sales',
        'phone' => '+251911998877',
        'is_active' => true,
    ]);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Cash in Safe',
        'type' => 'cash',
        'currency' => 'ETB',
        'current_balance' => 500000.00,
        'is_active' => true,
    ]);

    $this->customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abel Customer',
        'phone' => '+251911001122',
        'roles' => ['customer'],
        'is_active' => true,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Samsung S25 Ultra',
        'brand' => 'Samsung',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Titanium Black',
        'default_selling_price' => 150000.00,
    ]);

    $this->unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => '359871109988776',
        'cost_basis' => 130000.00,
        'status' => 'in_stock',
        'source_type' => 'purchase',
    ]);
});

test('staff commission bonus can be used to settle an open receivable debt', function () {
    // 1. Create a sale by Yonas with 5,000 ETB bonus
    $this->actingAs($this->salesperson);
    $action = app(RecordSaleAction::class);
    $order = $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'paid_amount' => 155000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 155000.00, // +5,000 over 150,000 default price
            ],
        ],
    ]);

    expect((float) $order->total_bonus_amount)->toBe(5000.0);

    // Find the bonus debt
    $bonusDebt = Debt::where('salesperson_id', $this->salesperson->id)
        ->where('reference_type', 'salesperson_bonus')
        ->first();

    expect($bonusDebt)->not->toBeNull();
    expect((float) $bonusDebt->remaining_amount)->toBe(5000.0);
    expect($bonusDebt->status)->toBe('open');

    // 2. Create a customer receivable of 4,000 ETB
    $this->actingAs($this->owner);
    $receivable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->customer->id,
        'type' => 'receivable',
        'reference_type' => 'direct_credit',
        'original_amount' => 4000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 4000.00,
        'status' => 'open',
        'notes' => 'Customer credit balance',
    ]);

    // 3. Offset 4,000 ETB of Yonas bonus to settle Abel receivable
    $offsetAction = app(OffsetStaffBonusDebtAction::class);
    $result = $offsetAction->execute($this->salesperson, [
        'amount' => 4000.00,
        'receivable_debt_id' => $receivable->id,
        'notes' => 'Applied to Abel account',
    ]);

    expect($result['amount_offset'])->toBe(4000.0);

    // 4. Verify receivable is now fully settled
    $receivable->refresh();
    expect((float) $receivable->paid_amount)->toBe(4000.0);
    expect((float) $receivable->remaining_amount)->toBe(0.0);
    expect($receivable->status)->toBe('settled');

    // 5. Verify staff bonus is partially settled (1,000 ETB remaining)
    $bonusDebt->refresh();
    expect((float) $bonusDebt->paid_amount)->toBe(4000.0);
    expect((float) $bonusDebt->remaining_amount)->toBe(1000.0);
    expect($bonusDebt->status)->toBe('partially_paid');

    // 6. Verify payments exist
    $recPayment = DebtPayment::where('debt_id', $receivable->id)->first();
    expect($recPayment)->not->toBeNull();
    expect((float) $recPayment->amount)->toBe(4000.0);
    expect($recPayment->financial_account_id)->toBeNull(); // No cash account touched
    expect($recPayment->reference_number)->toContain('OFFSET-STAFF-BONUS');

    $bonusPayment = DebtPayment::where('debt_id', $bonusDebt->id)->first();
    expect($bonusPayment)->not->toBeNull();
    expect((float) $bonusPayment->amount)->toBe(4000.0);
    expect($bonusPayment->notes)->toContain('Used for debt');

    // 7. Verify sales order bonus_info flags as used for debt
    $order->refresh();
    expect($order->bonus_info)->not->toBeNull();
    expect($order->bonus_info['used_for_debt'])->toBeTrue();
    expect($order->bonus_info['status'])->toBe('used_for_debt');
});

test('staff bonus debt offset can be undone via audit log reversal', function () {
    $this->actingAs($this->salesperson);
    $action = app(RecordSaleAction::class);
    $order = $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'paid_amount' => 155000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 155000.00,
            ],
        ],
    ]);

    $bonusDebt = Debt::where('salesperson_id', $this->salesperson->id)
        ->where('reference_type', 'salesperson_bonus')
        ->first();

    $this->actingAs($this->owner);
    $receivable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->customer->id,
        'type' => 'receivable',
        'reference_type' => 'direct_credit',
        'original_amount' => 5000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 5000.00,
        'status' => 'open',
    ]);

    // Offset full 5,000 ETB
    $offsetAction = app(OffsetStaffBonusDebtAction::class);
    $offsetAction->execute($this->salesperson, [
        'amount' => 5000.00,
        'receivable_debt_id' => $receivable->id,
    ]);

    $receivable->refresh();
    $bonusDebt->refresh();
    expect($receivable->status)->toBe('settled');
    expect($bonusDebt->status)->toBe('settled');

    // Find the audit log for the action
    $log = \App\Models\AuditLog::where('action', 'bonus_used_for_debt')->latest()->first();
    expect($log)->not->toBeNull();

    // Check undo preview
    $previewRes = $this->getJson("/api/v1/audit-logs/{$log->id}/undo-preview");
    $previewRes->assertOk();
    $previewData = $previewRes->json('data');
    expect($previewData['can_undo'])->toBeTrue();
    expect($previewData['blocked'])->toBeFalse();

    // Perform undo
    $undoRes = $this->postJson("/api/v1/audit-logs/{$log->id}/undo");
    $undoRes->assertOk();

    // Both debts should be reopened
    $receivable->refresh();
    $bonusDebt->refresh();

    expect((float) $receivable->remaining_amount)->toBe(5000.0);
    expect((float) $receivable->paid_amount)->toBe(0.0);
    expect($receivable->status)->toBe('open');

    expect((float) $bonusDebt->remaining_amount)->toBe(5000.0);
    expect((float) $bonusDebt->paid_amount)->toBe(0.0);
    expect($bonusDebt->status)->toBe('open');

    // Order bonus_info should no longer be used for debt
    $order->refresh();
    expect($order->bonus_info['used_for_debt'])->toBeFalse();
    expect($order->bonus_info['status'])->toBe('uncollected');
});

test('staff offset-bonus-debt endpoint works via API', function () {
    $this->actingAs($this->salesperson);
    $action = app(RecordSaleAction::class);
    $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'paid_amount' => 155000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 155000.00,
            ],
        ],
    ]);

    $this->actingAs($this->owner);
    $receivable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->customer->id,
        'type' => 'receivable',
        'reference_type' => 'direct_credit',
        'original_amount' => 3000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 3000.00,
        'status' => 'open',
    ]);

    $response = $this->postJson("/api/v1/staff/{$this->salesperson->id}/offset-bonus-debt", [
        'amount' => 3000.00,
        'receivable_debt_id' => $receivable->id,
        'notes' => 'Settled via API endpoint',
    ]);

    $response->assertOk()
        ->assertJson([
            'success' => true,
        ]);

    $receivable->refresh();
    expect((float) $receivable->remaining_amount)->toBe(0.0);
    expect($receivable->status)->toBe('settled');

    // Also check staff statement API returns debt offset flags
    $stmtRes = $this->getJson("/api/v1/staff/{$this->salesperson->id}/statement");
    $stmtRes->assertOk();
    $stmtData = $stmtRes->json('data');
    expect($stmtData['bonus_ledger'][0]['has_debt_offset'])->toBeTrue();
    expect($stmtData['sales_orders'][0]['bonus_used_for_debt'])->toBeTrue();
});

test('settle receivable payment via debt drawer endpoint using staff bonus', function () {
    $this->actingAs($this->salesperson);
    $action = app(RecordSaleAction::class);
    $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'paid_amount' => 155000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 155000.00,
            ],
        ],
    ]);

    $this->actingAs($this->owner);
    $receivable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->customer->id,
        'type' => 'receivable',
        'reference_type' => 'direct_credit',
        'original_amount' => 2500.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 2500.00,
        'status' => 'open',
    ]);

    $response = $this->postJson("/api/v1/debts/{$receivable->id}/payments", [
        'payment_method' => 'staff_bonus',
        'staff_id' => $this->salesperson->id,
        'amount' => 2500.00,
        'notes' => 'Settled from Debt Drawer using staff bonus',
    ]);

    $response->assertOk()
        ->assertJson([
            'success' => true,
        ]);

    $receivable->refresh();
    expect((float) $receivable->remaining_amount)->toBe(0.0);
    expect($receivable->status)->toBe('settled');

    $bonusDebt = Debt::where('salesperson_id', $this->salesperson->id)
        ->where('reference_type', 'salesperson_bonus')
        ->first();

    expect((float) $bonusDebt->remaining_amount)->toBe(2500.0);
});

test('creating a receivable loan to a staff member does not automatically clear or offset their open sales bonus', function () {
    // 1. Staff makes a sale with 5,000 ETB bonus
    $action = app(RecordSaleAction::class);
    $order = $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'customer_id' => $this->customer->id,
        'order_date' => now()->format('Y-m-d'),
        'subtotal' => 155000.00,
        'total_amount' => 155000.00,
        'salesperson_bonus_amount' => 5000.00,
        'paid_amount' => 155000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 155000.00,
            ],
        ],
    ]);

    $bonusDebt = Debt::where('salesperson_id', $this->salesperson->id)
        ->where('reference_type', 'salesperson_bonus')
        ->first();

    expect($bonusDebt)->not->toBeNull();
    expect((float) $bonusDebt->remaining_amount)->toBe(5000.00);
    expect($bonusDebt->status)->toBe('open');

    // Find or create the contact associated with this salesperson
    $staffContact = Contact::firstOrCreate(
        [
            'tenant_id' => $this->tenant->id,
            'phone' => $this->salesperson->phone,
        ],
        [
            'name' => $this->salesperson->name,
            'roles' => ['staff', 'salesperson'],
            'is_active' => true,
        ]
    );

    // 2. Owner lends 20,000 ETB in cash to this staff member via DebtController
    $this->actingAs($this->owner);
    $response = $this->postJson('/api/v1/debts', [
        'contact_id' => $staffContact->id,
        'type' => 'receivable',
        'amount' => 20000.00,
        'financial_account_id' => $this->account->id,
        'direction' => 'out',
        'notes' => 'Cash loan to staff for personal use',
    ]);

    $response->assertCreated();
    $receivableId = $response->json('data.id');

    // 3. Verify that the bonus debt was NOT touched or cleared!
    $bonusDebt->refresh();
    expect((float) $bonusDebt->paid_amount)->toBe(0.00);
    expect((float) $bonusDebt->remaining_amount)->toBe(5000.00);
    expect($bonusDebt->status)->toBe('open');
    expect($bonusDebt->payments)->toHaveCount(0);

    // 4. Verify that the receivable debt is 100% open with 0 paid!
    $receivableDebt = Debt::find($receivableId);
    expect((float) $receivableDebt->paid_amount)->toBe(0.00);
    expect((float) $receivableDebt->remaining_amount)->toBe(20000.00);
    expect($receivableDebt->status)->toBe('open');
    expect($receivableDebt->payments)->toHaveCount(0);
});

