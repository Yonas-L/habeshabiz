<?php

namespace Tests\Feature;

use App\Actions\GeneratePartnerStatementAction;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Statement Test Shop',
        'slug' => 'stmt-shop-'.uniqid(),
        'currency' => 'ETB',
    ]);
    TenantScope::setForcedTenantId($this->tenant->id);

    $this->user = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'owner',
    ]);

    $this->bankAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'current_balance' => 500000.00,
        'is_active' => true,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 16 Pro Max',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Black Titanium',
        'default_selling_price' => 120000.00,
    ]);
});

test('partner statement excludes cancelled debts from ledger and range closing balance', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Test Vendor',
        'roles' => ['vendor'],
    ]);

    // Active payable debt: 50,000 ETB
    Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'payable',
        'reference_type' => 'stock_intake',
        'original_amount' => 50000.00,
        'remaining_amount' => 50000.00,
        'paid_amount' => 0.0,
        'status' => 'open',
        'notes' => 'Active intake debt',
    ]);

    // Cancelled debt (e.g. from deleted unit): 3,000 ETB
    Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'payable',
        'reference_type' => 'stock_intake',
        'original_amount' => 3000.00,
        'remaining_amount' => 0.0,
        'paid_amount' => 0.0,
        'status' => 'cancelled',
        'notes' => 'Stock intake: iPhone [Voided upon deletion of unit]',
    ]);

    $action = app(GeneratePartnerStatementAction::class);
    $statement = $action->execute($vendor->fresh());

    // Outside net balance: -50,000 ETB (payable)
    expect((float) $vendor->net_balance)->toBe(-50000.00);

    // Statement KPIs: current net balance and range closing balance must both be -50,000 ETB
    expect((float) $statement['kpis']['current_net_balance'])->toBe(-50000.00)
        ->and((float) $statement['kpis']['range_closing_balance'])->toBe(-50000.00);

    // Cancelled debt must not appear in statement ledger entries
    $hasCancelledEntry = collect($statement['ledger'])->contains(function ($entry) {
        return str_contains($entry['context'] ?? '', 'Voided upon deletion');
    });
    expect($hasCancelledEntry)->toBeFalse();
});

test('debtor offset intake does not treat non-supplier debtor as device supplier and records paid by device payment', function () {
    $debtor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Sami Customer Test',
        'roles' => ['customer'],
    ]);

    // Debtor owes 20,000 ETB initially
    $debt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $debtor->id,
        'type' => 'receivable',
        'reference_type' => 'direct_credit',
        'original_amount' => 20000.00,
        'remaining_amount' => 0.0,
        'paid_amount' => 20000.00,
        'status' => 'settled',
        'notes' => 'Credit advance',
    ]);

    // An intake of a 280,000 ETB device is offset by 20,000 ETB from debtor
    // Note: debtor is NOT the supplier (supplier is null or third party)
    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-SAMI-TEST-001',
        'condition' => 'brand_new',
        'cost_basis' => 280000.00,
        'status' => 'in_stock',
        'funding_source' => 'split',
        'receivable_contact_id' => $debtor->id,
        'receivable_offset_amount' => 20000.00,
        'supplier_contact_id' => null,
    ]);

    // DebtPayment created during intake
    DebtPayment::create([
        'tenant_id' => $this->tenant->id,
        'debt_id' => $debt->id,
        'financial_account_id' => null,
        'amount' => 20000.00,
        'payment_date' => now(),
        'reference_number' => 'OFFSET-INTAKE',
        'notes' => 'Paid by device: iPhone 16 Pro Max (IMEI: IMEI-SAMI-TEST-001)',
        'created_by' => $this->user->id,
    ]);

    // Outside net balance: 0.00 ETB (debt was fully settled)
    expect((float) $debtor->net_balance)->toBe(0.00);

    $action = app(GeneratePartnerStatementAction::class);
    $statement = $action->execute($debtor->fresh());

    // Statement KPIs: current net balance and range closing balance must both be 0.00 ETB
    expect((float) $statement['kpis']['current_net_balance'])->toBe(0.00)
        ->and((float) $statement['kpis']['range_closing_balance'])->toBe(0.00);

    // Ledger must have exactly 2 entries: the debt (+20,000) and the paid_by_device payment (-20,000)
    // It must NOT have a stock_intake row of 280,000 ETB!
    expect($statement['ledger'])->toHaveCount(2);

    $types = collect($statement['ledger'])->pluck('type')->all();
    expect($types)->not->toContain('stock_intake')
        ->and($types)->toContain('paid_by_device');

    $paidByDeviceEntry = collect($statement['ledger'])->firstWhere('type', 'paid_by_device');
    expect((float) $paidByDeviceEntry['receivable'])->toBe(-20000.00)
        ->and((float) $paidByDeviceEntry['balance_effect'])->toBe(-20000.00)
        ->and((float) $paidByDeviceEntry['running_balance'])->toBe(0.00);
});
