<?php

use App\Models\Contact;
use App\Models\Debt;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryUnit;
use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Carbon\Carbon;

beforeEach(function (): void {
    $this->tenant = Tenant::create(['name' => 'Report Shop', 'slug' => 'report-shop']);
    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'owner',
        'name' => 'Owner One',
        'is_active' => true,
    ]);
    $this->salesperson = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'salesperson',
        'name' => 'Mimi Sales',
        'is_active' => true,
    ]);
    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Shop Cash',
        'type' => 'cash',
        'currency' => 'ETB',
        'current_balance' => 5000,
        'is_active' => true,
    ]);
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Report Phone',
        'brand' => 'Apple',
        'category' => 'phones',
        'has_serials' => true,
    ]);
    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'storage' => '256GB',
        'color' => 'Black',
        'default_selling_price' => 1000,
    ]);
    $this->vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Vendor One',
        'roles' => ['peer_vendor'],
        'is_active' => true,
    ]);
    $this->customAsset = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Gold Reserve',
        'type' => 'asset_gold',
        'currency' => 'ETB',
        'current_balance' => 1000,
        'is_custom_asset' => true,
        'is_active' => true,
    ]);
});

test('owner can generate a reconciled dated business report', function (): void {
    Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->vendor->id,
        'type' => 'payable',
        'reference_type' => 'direct_credit',
        'original_amount' => 250,
        'remaining_amount' => 250,
        'status' => 'open',
        'notes' => 'Unpaid vendor balance',
    ]);
    $firstOrder = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'RPT-001',
        'salesperson_id' => $this->salesperson->id,
        'total_amount' => 1000,
        'paid_amount' => 1000,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'order_date' => Carbon::parse('2026-10-03 09:00:00'),
    ]);
    $secondOrder = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'RPT-002',
        'salesperson_id' => $this->owner->id,
        'total_amount' => 2000,
        'discount_amount' => 100,
        'paid_amount' => 1900,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'order_date' => Carbon::parse('2026-10-05 10:00:00'),
    ]);

    SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $firstOrder->id,
        'variant_id' => $this->variant->id,
        'quantity' => 1,
        'unit_price' => 1000,
        'unit_cost' => 700,
        'profit' => 300,
        'sourcing_type' => 'internal_stock',
    ]);
    SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $secondOrder->id,
        'variant_id' => $this->variant->id,
        'quantity' => 1,
        'unit_price' => 2000,
        'unit_cost' => 1300,
        'profit' => 700,
        'sourcing_type' => 'brokered_neighbour',
        'vendor_contact_id' => $this->vendor->id,
        'vendor_cost' => 1300,
    ]);

    Expense::create([
        'tenant_id' => $this->tenant->id,
        'financial_account_id' => $this->account->id,
        'category' => 'utilities',
        'amount' => 100,
        'description' => 'Internet',
        'date' => Carbon::parse('2026-10-04'),
        'created_by' => $this->owner->id,
    ]);
    FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'RPT-FEE-001',
        'source_account_id' => $this->account->id,
        'type' => 'expense',
        'amount' => 10,
        'fee' => 10,
        'description' => 'Transfer fee',
        'date' => Carbon::parse('2026-10-04'),
        'created_by' => $this->owner->id,
    ]);

    $makeUnit = function (string $imei, string $sourceType, string $status, float $cost): InventoryUnit {
        return InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => $imei,
            'cost_basis' => $cost,
            'status' => $status,
            'source_type' => $sourceType,
        ]);
    };

    $ownedUnit = $makeUnit('RPT-OWNED', 'purchase', 'in_stock', 500);
    $consignmentUnit = $makeUnit('RPT-CONSIGNMENT', 'consignment', 'in_stock', 700);
    $consignmentUnit->update(['supplier_contact_id' => $this->vendor->id]);
    $returnedUnit = $makeUnit('RPT-RETURNED', 'consignment', 'returned_to_vendor', 600);
    $returnedUnit->update([
        'supplier_contact_id' => $this->vendor->id,
        'return_reason' => 'Screen fault',
        'returned_at' => Carbon::parse('2026-10-06'),
    ]);
    $returnedUnit->forceFill(['updated_at' => Carbon::parse('2026-10-06')])->saveQuietly();
    MaintenanceRecord::create([
        'tenant_id' => $this->tenant->id,
        'inventory_unit_id' => $returnedUnit->id,
        'cost' => 75,
        'is_capitalized' => false,
        'description' => 'Diagnostic repair',
        'date' => Carbon::parse('2026-10-07'),
    ]);
    $ownedUnit->forceFill(['created_at' => Carbon::parse('2026-10-02')])->saveQuietly();
    $consignmentUnit->forceFill(['created_at' => Carbon::parse('2026-10-02')])->saveQuietly();

    $response = $this->actingAs($this->owner)->getJson('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31');

    $response->assertOk()
        ->assertJsonPath('data.summary.revenue', 3000)
        ->assertJsonPath('data.summary.customer_receipts', 2900)
        ->assertJsonPath('data.summary.gross_profit', 900)
        ->assertJsonPath('data.summary.operating_expenses', 100)
        ->assertJsonPath('data.summary.transaction_fees', 10)
        ->assertJsonPath('data.summary.net_profit', 790)
        ->assertJsonPath('data.summary.result', 'profit')
        ->assertJsonPath('data.sales_extremes.peak_day.date', '2026-10-05')
        ->assertJsonPath('data.sales_extremes.low_day.date', '2026-10-03')
        ->assertJsonPath('data.repairs.reported_count', 1)
        ->assertJsonPath('data.repairs.repaired_count', 1)
        ->assertJsonPath('data.repairs.repair_expense', 75)
        ->assertJsonPath('data.stock_position.owned_value', 500)
        ->assertJsonPath('data.stock_position.vendor_value', 700)
        ->assertJsonPath('data.vendor_activity.most_active.name', 'Vendor One')
        ->assertJsonPath('data.staff_performance.0.name', 'Mimi Sales')
        ->assertJsonCount(1, 'data.staff_performance')
        ->assertJsonPath('data.cash_position.cash_and_bank', 5000)
        ->assertJsonPath('data.cash_position.custom_assets', 1000)
        ->assertJsonPath('data.financial_position.liabilities.open_payables', 250)
        ->assertJsonPath('data.financial_position.net_position', 6250)
        ->assertJsonPath('data.reconciliation.variance', 0)
        ->assertJsonPath('data.reconciliation.is_reconciled', true);
});

test('dashboard preserves below-cost sales as negative gross and net profit', function (): void {
    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'DASH-LOSS',
        'salesperson_id' => $this->owner->id,
        'total_amount' => 900,
        'paid_amount' => 900,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'order_date' => Carbon::parse('2026-10-14'),
    ]);

    SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $order->id,
        'variant_id' => $this->variant->id,
        'quantity' => 1,
        'unit_price' => 900,
        'unit_cost' => 1000,
        'profit' => 0,
        'bonus_amount' => 0,
        'sourcing_type' => 'internal_stock',
    ]);

    $this->actingAs($this->owner)
        ->getJson('/api/v1/dashboard/summary?month=2026-10')
        ->assertOk()
        ->assertJsonPath('data.monthly_performance.gross_profit', -100)
        ->assertJsonPath('data.monthly_performance.net_profit', -100);
});

test('dashboard reports owner draws from the financial transaction ledger', function (): void {
    FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'DASH-OWNER-DRAW',
        'source_account_id' => $this->account->id,
        'type' => 'owner_draw',
        'amount' => 100,
        'date' => Carbon::parse('2026-10-14'),
        'created_by' => $this->owner->id,
    ]);

    $this->actingAs($this->owner)
        ->getJson('/api/v1/dashboard/summary?month=2026-10')
        ->assertOk()
        ->assertJsonPath('data.monthly_performance.owner_draws', 100);
});

test('report correctly filters out accounts created after selected period', function (): void {
    $pastReport = $this->actingAs($this->owner)->getJson('/api/v1/reports/summary?from=2026-08-01&to=2026-08-31');

    $pastReport->assertOk()
        ->assertJsonPath('data.cash_position.cash_and_bank', 0)
        ->assertJsonPath('data.cash_position.accounts', [])
        ->assertJsonPath('data.stock_position.owned_value', 0)
        ->assertJsonPath('data.reconciliation.variance', 0)
        ->assertJsonPath('data.reconciliation.is_reconciled', true);
});

test('staff cannot access owner financial reports', function (): void {
    $this->actingAs($this->salesperson)
        ->getJson('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31')
        ->assertForbidden();
});

test('cash reconciliation reports a variance when a cash movement is not classified', function (): void {
    $this->account->increment('current_balance', 100);
    FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'RPT-UNCLASSIFIED-001',
        'destination_account_id' => $this->account->id,
        'type' => 'valuation_adjustment',
        'amount' => 100,
        'description' => 'Unclassified cash adjustment',
        'date' => Carbon::parse('2026-10-10'),
        'created_by' => $this->owner->id,
    ]);

    $this->actingAs($this->owner)
        ->getJson('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31')
        ->assertOk()
        ->assertJsonPath('data.reconciliation.variance', -100)
        ->assertJsonPath('data.reconciliation.is_reconciled', false);
});

test('business report preserves a negative gross profit from a below-cost sale', function (): void {
    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'RPT-LOSS-001',
        'salesperson_id' => $this->owner->id,
        'total_amount' => 900,
        'paid_amount' => 900,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'order_date' => Carbon::parse('2026-10-12'),
    ]);
    SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $order->id,
        'variant_id' => $this->variant->id,
        'quantity' => 1,
        'unit_price' => 900,
        'unit_cost' => 1000,
        'profit' => -100,
        'sourcing_type' => 'internal_stock',
    ]);

    $this->actingAs($this->owner)
        ->getJson('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31')
        ->assertOk()
        ->assertJsonPath('data.summary.gross_profit', -100)
        ->assertJsonPath('data.summary.loss_making_items', 1)
        ->assertJsonPath('data.summary.loss_amount', 100)
        ->assertJsonPath('data.summary.loss_items.0.product', 'Report Phone 256GB Black')
        ->assertJsonPath('data.summary.loss_items.0.loss', 100)
        ->assertJsonPath('data.summary.net_profit', -100)
        ->assertJsonPath('data.summary.result', 'loss');
});

test('report recalculates a historical clamped below-cost row from sale facts', function (): void {
    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'RPT-HISTORICAL-LOSS',
        'salesperson_id' => $this->owner->id,
        'total_amount' => 900,
        'paid_amount' => 900,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'order_date' => Carbon::parse('2026-10-13'),
    ]);
    SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $order->id,
        'variant_id' => $this->variant->id,
        'quantity' => 1,
        'unit_price' => 900,
        'unit_cost' => 1000,
        'profit' => 0,
        'bonus_amount' => 0,
        'sourcing_type' => 'internal_stock',
    ]);

    $this->actingAs($this->owner)
        ->getJson('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31')
        ->assertOk()
        ->assertJsonPath('data.summary.gross_profit', -100)
        ->assertJsonPath('data.summary.loss_amount', 100);
});

test('report dates are validated', function (): void {
    $this->actingAs($this->owner)
        ->getJson('/api/v1/reports/summary?from=2026-10-31&to=2026-10-01')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('to');
});

test('dashboard and business report exclude vendor_payout from operating expenses and preserve net profit', function (): void {
    // Record real operating expense (food)
    Expense::create([
        'tenant_id' => $this->tenant->id,
        'financial_account_id' => $this->account->id,
        'category' => 'food',
        'amount' => 500,
        'description' => 'Staff lunch',
        'date' => Carbon::parse('2026-10-05'),
        'created_by' => $this->owner->id,
        'is_owner_draw' => false,
    ]);

    // Record vendor debt settlement via vendor_payout
    Expense::create([
        'tenant_id' => $this->tenant->id,
        'financial_account_id' => $this->account->id,
        'vendor_contact_id' => $this->vendor->id,
        'category' => 'vendor_payout',
        'amount' => 15000,
        'description' => 'Transfer to supplier',
        'date' => Carbon::parse('2026-10-06'),
        'created_by' => $this->owner->id,
        'is_owner_draw' => false,
    ]);

    // 1. Check Dashboard API
    $dashRes = $this->actingAs($this->owner)
        ->getJson('/api/v1/dashboard/summary?month=2026-10')
        ->assertOk();

    // Operating expenses must only be 500 ETB, NOT 15,500 ETB
    $dashRes->assertJsonPath('data.monthly_performance.operating_expenses', 500)
        ->assertJsonPath('data.monthly_performance.manual_expenses', 500)
        ->assertJsonPath('data.monthly_performance.net_profit', -500);

    // 2. Check Business Report API
    $reportRes = $this->actingAs($this->owner)
        ->getJson('/api/v1/reports/summary?from=2026-10-01&to=2026-10-31')
        ->assertOk();

    // Business report summary operating expenses must only be 500 ETB
    $reportRes->assertJsonPath('data.summary.operating_expenses', 500)
        ->assertJsonPath('data.summary.net_profit', -500);
});
