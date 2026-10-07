<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Bilateral Offset Test Shop',
        'slug' => 'offset-shop-'.uniqid(),
        'currency' => 'ETB',
    ]);
    TenantScope::setForcedTenantId($this->tenant->id);

    $this->user = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'owner',
    ]);

    $this->cbe = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'current_balance' => 500000.00,
        'is_active' => true,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro Max',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->variantA = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 110000.00,
    ]);

    $this->productB = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 13',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->variantB = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->productB->id,
        'storage' => '128GB',
        'color' => 'Midnight',
        'default_selling_price' => 50000.00,
    ]);

    $this->partnerA = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Partner A (Dawit)',
        'phone' => '0911000001',
        'roles' => ['vendor', 'partner', 'customer'],
        'is_active' => true,
    ]);

    $this->partnerB = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Partner B (Kidus)',
        'phone' => '0911000002',
        'roles' => ['vendor', 'partner', 'customer'],
        'is_active' => true,
    ]);
});

afterEach(function () {
    TenantScope::setForcedTenantId(null);
});

test('vendor stock intake immediately registers open payable debts before any sale occurs', function () {
    // 1. Intake Product 1 from Partner A worth 100,000 ETB as vendor stock
    $resA = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantA->id,
        'imei_or_serial' => '111222333444555',
        'condition' => 'new',
        'cost_basis' => 100000.00,
        'selling_price' => 110000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partnerA->id,
    ]);
    $resA->assertStatus(201);
    $unitAId = $resA->json('data.id');

    // 2. Intake Product 2 from Partner B worth 45,000 ETB as vendor stock
    $resB = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantB->id,
        'imei_or_serial' => '666777888999000',
        'condition' => 'new',
        'cost_basis' => 45000.00,
        'selling_price' => 50000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partnerB->id,
    ]);
    $resB->assertStatus(201);
    $unitBId = $resB->json('data.id');

    // Both open debts must exist immediately upon intake
    $debtA = Debt::where('contact_id', $this->partnerA->id)
        ->where('reference_type', 'stock_intake')
        ->where('reference_id', $unitAId)
        ->first();
    expect($debtA)->not->toBeNull();
    expect((float) $debtA->original_amount)->toBe(100000.00);
    expect((float) $debtA->remaining_amount)->toBe(100000.00);
    expect($debtA->type)->toBe('payable');

    $debtB = Debt::where('contact_id', $this->partnerB->id)
        ->where('reference_type', 'stock_intake')
        ->where('reference_id', $unitBId)
        ->first();
    expect($debtB)->not->toBeNull();
    expect((float) $debtB->original_amount)->toBe(45000.00);
    expect((float) $debtB->remaining_amount)->toBe(45000.00);

    // Both partner statements reflect the debts immediately
    $statementA = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$this->partnerA->id}/statement");
    $statementA->assertOk();
    expect((float) $statementA->json('data.kpis.range_closing_balance'))->toBe(-100000.00);

    $statementB = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$this->partnerB->id}/statement");
    $statementB->assertOk();
    expect((float) $statementB->json('data.kpis.range_closing_balance'))->toBe(-45000.00);

    // Dashboard payables total is 145,000 ETB
    $dashboard = $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/dashboard/summary');
    $dashboard->assertOk();
    expect((float) $dashboard->json('data.partner_settlements.total_we_owe_net'))->toBe(145000.00);
    expect((float) $dashboard->json('data.capital_overview.payables'))->toBe(145000.00);
});

test('bilateral handover offset deducts partner payable debt, recognizes 5k profit margin, and leaves other vendor intact', function () {
    // 1. Intake Device 1 from Partner A (100k)
    $resA = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantA->id,
        'imei_or_serial' => '111222333444555',
        'condition' => 'new',
        'cost_basis' => 100000.00,
        'selling_price' => 110000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partnerA->id,
    ]);
    $unitAId = $resA->json('data.id');

    // 2. Intake Device 2 from Partner B (45k)
    $resB = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantB->id,
        'imei_or_serial' => '666777888999000',
        'condition' => 'new',
        'cost_basis' => 45000.00,
        'selling_price' => 50000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partnerB->id,
    ]);
    $unitBId = $resB->json('data.id');

    $bankBefore = (float) $this->cbe->fresh()->current_balance;

    // 3. Hand over Device 2 (Partner B's item) to Partner A with agreed payout 50,000 ETB
    $handoverRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitBId}/handover", [
        'handover_to' => $this->partnerA->name,
        'handover_payout' => 50000.00,
        'notes' => 'Handed to Partner A to cover part of 100k debt',
    ]);
    $handoverRes->assertOk();

    $unitB = InventoryUnit::find($unitBId);
    expect($unitB->status)->toBe('out');
    expect($unitB->handover_to)->toBe($this->partnerA->name);

    // 4. Mark handover as sold via Bilateral Offset
    $markSoldRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitBId}/mark-sold", [
        'settlement_type' => 'offset',
        'selling_price' => 50000.00,
        'notes' => 'Offset against 100k debt owed to Dawit',
    ]);
    $markSoldRes->assertOk();

    // Verify Partner A's 100k payable debt was reduced to 50k
    $debtA = Debt::where('contact_id', $this->partnerA->id)
        ->where('reference_type', 'stock_intake')
        ->where('reference_id', $unitAId)
        ->first();
    expect((float) $debtA->paid_amount)->toBe(50000.00);
    expect((float) $debtA->remaining_amount)->toBe(50000.00);
    expect($debtA->status)->toBe('partially_paid');

    // Partner A's statement now shows closing balance of -50,000 ETB
    $statementA = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$this->partnerA->id}/statement");
    $statementA->assertOk();
    expect((float) $statementA->json('data.kpis.range_closing_balance'))->toBe(-50000.00);

    // Verify Partner B's 45,000 ETB payable debt remains 100% intact!
    $debtB = Debt::where('contact_id', $this->partnerB->id)
        ->where('reference_type', 'stock_intake')
        ->where('reference_id', $unitBId)
        ->first();
    expect((float) $debtB->remaining_amount)->toBe(45000.00);
    expect($debtB->status)->toBe('open');

    // Statement for Partner B still reflects -45,000 ETB
    $statementB = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$this->partnerB->id}/statement");
    $statementB->assertOk();
    expect((float) $statementB->json('data.kpis.range_closing_balance'))->toBe(-45000.00);

    // Zero physical bank cash moved
    $bankAfter = (float) $this->cbe->fresh()->current_balance;
    expect($bankAfter)->toBe($bankBefore);

    // Verify SalesOrder was created with recognized +5,000 ETB gross profit!
    $order = SalesOrder::where('payment_method', 'debt_offset')->latest()->first();
    expect($order)->not->toBeNull();
    expect((float) $order->total_amount)->toBe(50000.00);
    expect((float) $order->paid_amount)->toBe(50000.00);
    expect($order->payment_status)->toBe('paid');

    $orderItem = $order->items()->first();
    expect($orderItem)->not->toBeNull();
    expect((float) $orderItem->unit_price)->toBe(50000.00);
    expect((float) $orderItem->unit_cost)->toBe(45000.00);
    expect((float) $orderItem->profit)->toBe(5000.00);

    // Dashboard gross profit reflects +5,000 ETB
    $dashboard = $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/dashboard/summary');
    $dashboard->assertOk();
    expect((float) $dashboard->json('data.monthly_performance.gross_profit'))->toBe(5000.00);
    expect((float) $dashboard->json('data.partner_settlements.total_we_owe_net'))->toBe(95000.00); // 50k (Dawit) + 45k (Kidus)
});

test('returning an offset-sold handover device reverses the debt deduction, profit, and restocks the phone', function () {
    // 1. Intake Device 1 from Partner A (100k)
    $resA = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantA->id,
        'imei_or_serial' => '111222333444555',
        'condition' => 'new',
        'cost_basis' => 100000.00,
        'selling_price' => 110000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partnerA->id,
    ]);
    $unitAId = $resA->json('data.id');

    // 2. Intake Device 2 from Partner B (45k)
    $resB = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantB->id,
        'imei_or_serial' => '666777888999000',
        'condition' => 'new',
        'cost_basis' => 45000.00,
        'selling_price' => 50000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partnerB->id,
    ]);
    $unitBId = $resB->json('data.id');

    // 3. Handover and mark sold via offset
    $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitBId}/handover", [
        'handover_to' => $this->partnerA->name,
        'handover_payout' => 50000.00,
    ]);
    $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitBId}/mark-sold", [
        'settlement_type' => 'offset',
        'selling_price' => 50000.00,
    ]);

    // Partner A debt is 50,000 remaining
    $debtA = Debt::where('contact_id', $this->partnerA->id)->where('reference_type', 'stock_intake')->first();
    expect((float) $debtA->remaining_amount)->toBe(50000.00);

    // 4. Partner A returns the device, restocked to shelf
    $returnRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitBId}/customer-return", [
        'return_reason' => 'Dawit returned the device',
        'destination' => 'restock',
    ]);
    $returnRes->assertOk();

    // Partner A debt is restored to 100,000 ETB!
    $debtA->refresh();
    expect((float) $debtA->paid_amount)->toBe(0.00);
    expect((float) $debtA->remaining_amount)->toBe(100000.00);
    expect($debtA->status)->toBe('open');

    // Device 2 is back in stock
    $unitB = InventoryUnit::find($unitBId);
    expect($unitB->status)->toBe('in_stock');

    // Sales profit reversed
    $dashboard = $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/dashboard/summary');
    $dashboard->assertOk();
    expect((float) $dashboard->json('data.monthly_performance.gross_profit'))->toBe(0.00);
    expect((float) $dashboard->json('data.partner_settlements.total_we_owe_net'))->toBe(145000.00);
});

test('counter sale with payment_method debt_offset deducts from customer open payable debt', function () {
    // 1. Intake Device 1 from Partner A (100k)
    $resA = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantA->id,
        'imei_or_serial' => '111222333444555',
        'condition' => 'new',
        'cost_basis' => 100000.00,
        'source_type' => 'purchase',
        'funding_source' => 'none',
        'supplier_contact_id' => $this->partnerA->id,
    ]);
    $unitAId = $resA->json('data.id');

    // 2. Intake Device 2 from Partner B (45k)
    $resB = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantB->id,
        'imei_or_serial' => '666777888999000',
        'condition' => 'new',
        'cost_basis' => 45000.00,
        'source_type' => 'purchase',
        'funding_source' => 'none',
        'supplier_contact_id' => $this->partnerB->id,
    ]);
    $unitBId = $resB->json('data.id');

    $bankBefore = (float) $this->cbe->fresh()->current_balance;

    // 3. Partner A buys Device 2 at counter for 50,000 ETB paying via debt_offset
    $saleRes = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/sales', [
        'customer_id' => $this->partnerA->id,
        'payment_method' => 'debt_offset',
        'paid_amount' => 50000.00,
        'items' => [
            [
                'variant_id' => $this->variantB->id,
                'inventory_unit_id' => $unitBId,
                'quantity' => 1,
                'unit_price' => 50000.00,
                'sourcing_type' => 'internal_stock',
            ],
        ],
    ]);
    $saleRes->assertStatus(201);

    // Partner A's 100k payable debt is reduced to 50k
    $debtA = Debt::where('contact_id', $this->partnerA->id)->where('reference_type', 'stock_intake')->first();
    expect((float) $debtA->remaining_amount)->toBe(50000.00);

    // Partner B's 45k debt is unchanged
    $debtB = Debt::where('contact_id', $this->partnerB->id)->where('reference_type', 'stock_intake')->first();
    expect((float) $debtB->remaining_amount)->toBe(45000.00);

    // Zero bank account movement
    $bankAfter = (float) $this->cbe->fresh()->current_balance;
    expect($bankAfter)->toBe($bankBefore);
});

test('instant 1-click handover debt offset marks sold, settles debt, generates clean 2-row ledger, and recognizes 5k profit', function () {
    // 1. Intake Device 1 from Partner A (100k)
    $resA = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantA->id,
        'imei_or_serial' => 'INTAKE100K001',
        'condition' => 'new',
        'cost_basis' => 100000.00,
        'selling_price' => 110000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partnerA->id,
    ]);
    $resA->assertStatus(201);

    // 2. Intake Device 2 from Partner B (45k)
    $resB = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $this->variantB->id,
        'imei_or_serial' => 'INTAKE45K002',
        'condition' => 'new',
        'cost_basis' => 45000.00,
        'selling_price' => 50000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->partnerB->id,
    ]);
    $resB->assertStatus(201);
    $unitBId = $resB->json('data.id');

    $bankBefore = (float) $this->cbe->fresh()->current_balance;

    // 3. Instant 1-click Handover to Partner A with instant_offset: true at 50,000 ETB
    $handoverRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitBId}/handover", [
        'handover_to' => $this->partnerA->name,
        'handover_payout' => 50000.00,
        'instant_offset' => true,
        'notes' => 'Direct debt settlement',
    ]);
    $handoverRes->assertOk();

    // Unit B must immediately transition to 'sold'
    $unitB = InventoryUnit::find($unitBId);
    expect($unitB->status)->toBe('sold');

    // Partner A's 100k debt must immediately be reduced to 50k
    $debtA = Debt::where('contact_id', $this->partnerA->id)->where('reference_type', 'stock_intake')->first();
    expect((float) $debtA->remaining_amount)->toBe(50000.00);

    // Partner B's 45k debt is unchanged
    $debtB = Debt::where('contact_id', $this->partnerB->id)->where('reference_type', 'stock_intake')->first();
    expect((float) $debtB->remaining_amount)->toBe(45000.00);

    // Zero bank account movement
    $bankAfter = (float) $this->cbe->fresh()->current_balance;
    expect($bankAfter)->toBe($bankBefore);

    // Partner A statement ledger must have EXACTLY 2 clean chronological rows:
    // Row 1: Item Received 100k (+100k payable, balance -100,000 ETB)
    // Row 2: Bilateral Offset -50k (-50k payable, balance -50,000 ETB)
    $statementA = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$this->partnerA->id}/statement");
    $statementA->assertOk();
    $rows = $statementA->json('data.ledger');
    expect(count($rows))->toBe(2);
    expect($rows[0]['type_label'])->toBe('Item Received');
    expect($rows[1]['type_label'])->toBe('Item Sent');
    expect($rows[1]['context'])->toBe('Handover device: iPhone 13 (SN: INTAKE45K002)');
    expect((float) $rows[1]['running_balance'])->toBe(-50000.00);
    expect((float) $statementA->json('data.kpis.range_closing_balance'))->toBe(-50000.00);

    // Monthly gross profit recognizes exactly +5,000 ETB
    $profitRes = $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/reports/summary');
    $profitRes->assertOk();
    expect((float) $profitRes->json('data.summary.gross_profit'))->toBe(5000.00);

    $dashboardRes = $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/dashboard/summary');
    $dashboardRes->assertOk();
    expect((float) $dashboardRes->json('data.monthly_performance.gross_profit'))->toBe(5000.00);
});

test('bilateral multi-cycle device handover and vendor returns maintain mathematical ledger integrity with zero phantom refund claims', function () {
    // 1. Stock Intake Unit A (iPhone 15) from Partner A on credit (100,000 ETB)
    $resA = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'product_id' => $this->product->id,
        'variant_id' => $this->variantA->id,
        'imei_or_serial' => 'SN-IP15-MULTI',
        'cost_basis' => 100000.00,
        'selling_price' => 120000.00,
        'supplier_contact_id' => $this->partnerA->id,
        'funding_source' => 'none',
        'condition' => 'brand_new',
    ]);
    $resA->assertCreated();
    $unitAId = $resA->json('data.id');

    // 2. Stock Intake Unit B (iPhone 13 / Samsung) from Partner B on credit (45,000 ETB)
    $resB = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'product_id' => $this->productB->id,
        'variant_id' => $this->variantB->id,
        'imei_or_serial' => 'SN-IP13-MULTI',
        'cost_basis' => 45000.00,
        'selling_price' => 50000.00,
        'supplier_contact_id' => $this->partnerB->id,
        'funding_source' => 'none',
        'condition' => 'brand_new',
    ]);
    $resB->assertCreated();
    $unitBId = $resB->json('data.id');

    // 3. Handover Unit B to Partner A with instant_offset: true at 50,000 ETB
    $handoverRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitBId}/handover", [
        'handover_to' => $this->partnerA->name,
        'handover_payout' => 50000.00,
        'instant_offset' => true,
    ]);
    $handoverRes->assertOk();

    // 4. Partner A returns Unit B (defective)
    $custRetRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitBId}/customer-return", [
        'destination' => 'vendor',
        'return_reason' => 'Screen defective, returning to Yenus',
    ]);
    $custRetRes->assertOk();

    // 5. Return Unit A to Partner A (return to vendor)
    $retARes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitAId}/return-to-vendor", [
        'return_reason' => 'Returning to Nati',
    ]);
    $retARes->assertOk();

    // Assert NO phantom vendor_return_refund was created
    $refunds = Debt::where('contact_id', $this->partnerA->id)->where('reference_type', 'vendor_return_refund')->get();
    expect($refunds)->toBeEmpty();

    // 6. Receive Unit A back fixed from Partner A (restock)
    $recARes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitAId}/receive-from-vendor", [
        'action' => 'restock',
    ]);
    $recARes->assertOk();

    // 7. Return Unit A to Partner A again
    $retA2Res = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitAId}/return-to-vendor", [
        'return_reason' => 'Returning to Nati second time',
    ]);
    $retA2Res->assertOk();

    // Check Partner A's intake debt: paid_amount must strictly equal sum of payments
    $debtA = Debt::where('contact_id', $this->partnerA->id)->where('reference_type', 'stock_intake')->first();
    expect((float) $debtA->paid_amount)->toBe((float) $debtA->payments()->sum('amount'))
        ->and((float) $debtA->remaining_amount)->toBe(0.00)
        ->and($debtA->status)->toBe('settled');

    // Check statement: net balance must be settled (0.00 ETB)
    $statementA = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$this->partnerA->id}/statement");
    $statementA->assertOk();
    expect((float) $statementA->json('data.kpis.current_net_balance'))->toBe(0.00)
        ->and($statementA->json('data.kpis.balance_verdict'))->toBe('Settled (0.00 ETB)');
});


