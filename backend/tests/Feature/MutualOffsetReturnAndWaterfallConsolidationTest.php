<?php

use App\Actions\GeneratePartnerStatementAction;
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
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Consolidation Store',
        'slug' => 'consolidation-store',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Person',
        'email' => 'owner.cons@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->cbeAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE34',
        'type' => 'bank',
        'current_balance' => 500000.00,
        'is_active' => true,
    ]);

    $this->partner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Shikur Test',
        'phone' => '+251911122334',
        'roles' => ['customer', 'supplier', 'peer_vendor'],
        'is_active' => true,
    ]);
});

test('waterfall payment sets shared split_group_id and statement consolidates multi-debt payments into single row', function () {
    $debt1 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->partner->id,
        'type' => 'receivable',
        'reference_type' => 'direct_credit',
        'original_amount' => 10000,
        'paid_amount' => 0,
        'remaining_amount' => 10000,
        'status' => 'open',
        'created_at' => now()->subDays(5),
    ]);

    $debt2 = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->partner->id,
        'type' => 'receivable',
        'reference_type' => 'sales_order',
        'original_amount' => 320000,
        'paid_amount' => 0,
        'remaining_amount' => 320000,
        'status' => 'open',
        'created_at' => now()->subDays(4),
    ]);

    // Pay 100k via waterfall
    $response = $this->actingAs($this->owner)->postJson('/api/v1/debts/settle-party', [
        'contact_id' => $this->partner->id,
        'type' => 'receivable',
        'amount' => 100000,
        'financial_account_id' => $this->cbeAccount->id,
    ]);

    $response->assertOk();

    // Verify both debts were settled
    $debt1->refresh();
    $debt2->refresh();
    expect($debt1->remaining_amount)->toEqual('0.00');
    expect($debt2->remaining_amount)->toEqual('230000.00');

    // Verify both payments share the exact same split_group_id
    $p1 = $debt1->payments()->first();
    $p2 = $debt2->payments()->first();
    expect($p1->split_group_id)->not->toBeNull();
    expect($p1->split_group_id)->toEqual($p2->split_group_id);

    // Verify GeneratePartnerStatementAction consolidates into 1 row
    $action = app(GeneratePartnerStatementAction::class);
    $statement = $action->execute($this->partner);

    $paymentRows = collect($statement['ledger'])->filter(fn ($row) => $row['type'] === 'payment_received');
    // Instead of 2 rows (-10,000 and -90,000), there should be exactly 1 consolidated row
    expect($paymentRows->count())->toBe(1);
    $row = $paymentRows->first();
    expect((float) $row['receivable'])->toBe(-100000.0);
    expect($row['context'])->toContain('CBE34');
});

test('returning unit to vendor reverses mutual offset and restores receivable balance', function () {
    // 1. Existing receivable debt for partner (e.g. from a sale of 320,000 ETB)
    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-TEST1234',
        'customer_id' => $this->partner->id,
        'order_date' => now(),
        'total_amount' => 320000,
        'paid_amount' => 90000,
        'payment_status' => 'partially_paid',
        'credit_sale' => true,
    ]);

    $recDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->partner->id,
        'type' => 'receivable',
        'reference_type' => 'sales_order',
        'reference_id' => $order->id,
        'original_amount' => 320000,
        'paid_amount' => 90000,
        'remaining_amount' => 230000,
        'status' => 'partially_paid',
    ]);

    // Initial 90k cash payment
    DebtPayment::create([
        'tenant_id' => $this->tenant->id,
        'debt_id' => $recDebt->id,
        'financial_account_id' => $this->cbeAccount->id,
        'amount' => 90000,
        'payment_date' => now()->subHours(2),
        'created_by' => $this->owner->id,
    ]);

    // 2. Intake a consignment unit worth 145,000 ETB
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 16 Pro Max',
    ]);
    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'sku' => 'IPH16PM-256',
    ]);
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $variant->id,
        'imei_or_serial' => '353746136717403',
        'cost_basis' => 145000,
        'status' => 'in_stock',
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partner->id,
    ]);

    $payDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->partner->id,
        'type' => 'payable',
        'reference_type' => 'stock_intake',
        'reference_id' => $unit->id,
        'original_amount' => 145000,
        'paid_amount' => 0,
        'remaining_amount' => 145000,
        'status' => 'open',
    ]);

    // 3. Auto clear mutual debts runs
    Debt::reconcileContactMutualDebts($this->tenant->id, $this->partner->id);

    $payDebt->refresh();
    $recDebt->refresh();
    expect($payDebt->remaining_amount)->toEqual('0.00');
    expect($recDebt->remaining_amount)->toEqual('85000.00');

    // 4. Return unit to vendor
    $response = $this->actingAs($this->owner)->postJson("/api/v1/inventory/units/{$unit->id}/return-to-vendor", [
        'reason' => 'Unsold within agreed window',
    ]);
    $response->assertOk();

    // 5. Verify receivable is restored to 230,000 and linked order is synced!
    $recDebt->refresh();
    $payDebt->refresh();
    $order->refresh();

    expect((float) $recDebt->remaining_amount)->toBe(230000.0);
    expect((float) $recDebt->paid_amount)->toBe(90000.0);
    expect($recDebt->status)->toBe('partially_paid');

    expect((float) $order->paid_amount)->toBe(90000.0);
    expect($order->payment_status)->toBe('partially_paid');

    // Verify payable debt has RETURN-TO-VENDOR payment
    expect($payDebt->payments()->where('reference_number', 'RETURN-TO-VENDOR')->exists())->toBeTrue();
});
