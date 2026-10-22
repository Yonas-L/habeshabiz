<?php

use App\Actions\GeneratePartnerStatementAction;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Bole Tech Hub',
        'slug' => 'bole-tech-hub',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->user = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yoni Owner',
        'email' => 'yoni.lifecycle@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 16 Pro Max',
        'category' => 'smartphone',
        'has_serials' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Desert Titanium',
        'default_selling_price' => 185000.00,
    ]);

    $this->unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => '359871109988776',
        'battery_health' => 100,
        'cycle_count' => 0,
        'sim_type' => 'esim',
        'condition' => 'new',
        'cost_basis' => 160000.00,
        'status' => 'in_stock',
        'location' => 'Shop Counter',
    ]);
});

test('staff can mark in-stock unit as out for sale with handover recipient', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/handover", [
            'handover_to' => 'Husa (Lead Sales)',
            'notes' => 'Taken to customer at Bole Medhanialem mall demo',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'out')
        ->assertJsonPath('data.handover_to', 'Husa (Lead Sales)');

    expect($this->unit->fresh()->status)->toBe('out');
    expect($this->unit->fresh()->handover_to)->toBe('Husa (Lead Sales)');
    expect($this->unit->fresh()->handed_out_at)->not->toBeNull();
});

test('out for sale unit can be restocked back to shelf if unsold', function () {
    $this->unit->update([
        'status' => 'out',
        'handover_to' => 'Kalid',
        'handed_out_at' => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/restock");

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'in_stock');

    $fresh = $this->unit->fresh();
    expect($fresh->status)->toBe('in_stock');
    expect($fresh->handover_to)->toBeNull();
    expect($fresh->handed_out_at)->toBeNull();
});

test('sold units CANNOT be restocked directly', function () {
    $this->unit->update([
        'status' => 'sold',
        'sold_at' => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/restock");

    $response->assertStatus(422)
        ->assertJsonPath('success', false);

    expect($this->unit->fresh()->status)->toBe('sold');
});

test('sold units can be returned by customer with mandatory reason', function () {
    $this->unit->update([
        'status' => 'sold',
        'sold_at' => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/customer-return", [
            'return_reason' => 'Microphone crackle on voice notes',
            'condition' => 'inspection_needed',
            'notes' => 'Customer brought back receipt within 3 days',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'returned')
        ->assertJsonPath('data.return_reason', 'Microphone crackle on voice notes');

    $fresh = $this->unit->fresh();
    expect($fresh->status)->toBe('returned');
    expect($fresh->return_reason)->toBe('Microphone crackle on voice notes');
    expect($fresh->returned_at)->not->toBeNull();
});

test('returned unit can be repaired and restocked back to shelf', function () {
    $this->unit->update([
        'status' => 'returned',
        'return_reason' => 'Faulty earpiece',
        'returned_at' => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/repaired-restock", [
            'condition' => 'refurbished',
            'notes' => 'Audio IC replaced and tested 100%',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'in_stock');

    $fresh = $this->unit->fresh();
    expect($fresh->status)->toBe('in_stock');
    expect($fresh->condition)->toBe('refurbished');
});

test('seller CANNOT intake stock into inventory (403 forbidden)', function () {
    $seller = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husa Salesperson',
        'email' => 'husa.seller@example.com',
        'password' => Hash::make('password123'),
        'role' => 'salesperson',
    ]);

    $response = $this->actingAs($seller)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '359871109988999',
            'battery_health' => 98,
            'condition' => 'used',
            'cost_basis' => 140000.00,
        ]);

    $response->assertStatus(403)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Unauthorized. Stock intake is restricted to store owners/administrators.');
});

test('owner can intake stock and audit log is recorded', function () {
    $response = $this->actingAs($this->user)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '359871109988999',
            'battery_health' => 100,
            'condition' => 'new',
            'cost_basis' => 145000.00,
            'location' => 'Shop Counter',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'in_stock');

    expect(AuditLog::where('action', 'stock_intake')->exists())->toBeTrue();
});

test('salesperson is forbidden from handover and stock flow actions (403)', function () {
    $seller = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husa Salesperson',
        'email' => 'husa.flow@example.com',
        'password' => Hash::make('password123'),
        'role' => 'salesperson',
    ]);

    // Handover attempt
    $this->actingAs($seller)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/handover", [
            'handover_to' => 'Another Staff',
        ])
        ->assertStatus(403)
        ->assertJsonPath('success', false);

    // Restock attempt
    $this->actingAs($seller)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/restock")
        ->assertStatus(403)
        ->assertJsonPath('success', false);

    // Return to vendor attempt
    $this->actingAs($seller)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/return-to-vendor")
        ->assertStatus(403)
        ->assertJsonPath('success', false);
});

test('owner can handover device with agreed return deadline and vendor payout, creating a receivable holding debt', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/handover", [
            'handover_to' => 'Yenus (Peer Shop)',
            'return_deadline' => now()->addDays(5)->toDateString(),
            'handover_payout' => 170000.00,
            'notes' => 'Vendor demo with customer',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'out')
        ->assertJsonPath('data.handover_to', 'Yenus (Peer Shop)');

    $freshUnit = $this->unit->fresh();
    expect($freshUnit->status)->toBe('out');
    expect((float) $freshUnit->handover_payout)->toBe(170000.00);
    expect($freshUnit->return_deadline)->not->toBeNull();

    // Check receivable debt holding
    $debt = Debt::where('reference_type', 'handover_holding')
        ->where('reference_id', $this->unit->id)
        ->first();

    expect($debt)->not->toBeNull();
    expect($debt->type)->toBe('receivable');
    expect((float) $debt->original_amount)->toBe(170000.00);
    expect((float) $debt->remaining_amount)->toBe(170000.00);
    expect($debt->status)->toBe('open');
    expect($debt->contact->name)->toBe('Yenus (Peer Shop)');
});

test('restocking an unsold handed-over unit cancels the open handover holding debt', function () {
    // Perform handover with payout
    $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/handover", [
            'handover_to' => 'Mekdi (Broker)',
            'return_deadline' => now()->addDays(3)->toDateString(),
            'handover_payout' => 165000.00,
        ]);

    $debt = Debt::where('reference_type', 'handover_holding')
        ->where('reference_id', $this->unit->id)
        ->first();
    expect($debt->status)->toBe('open');

    // Restock unsold back to shelf
    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/restock");

    $response->assertStatus(200);

    $freshUnit = $this->unit->fresh();
    expect($freshUnit->status)->toBe('in_stock');
    expect($freshUnit->handover_to)->toBeNull();
    expect($freshUnit->handover_payout)->toBeNull();
    expect($freshUnit->return_deadline)->toBeNull();

    // Debt should now be cancelled / settled
    $freshDebt = $debt->fresh();
    expect($freshDebt->status)->toBe('settled');
    expect((float) $freshDebt->remaining_amount)->toBe(0.0);
    expect($freshDebt->notes)->toContain('CANCELLED');
});

test('settling handover holding debt via Debt Collector marks unit as sold', function () {
    $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/handover", [
            'handover_to' => 'Yenus (Peer Shop)',
            'return_deadline' => now()->addDays(5)->toDateString(),
            'handover_payout' => 175000.00,
        ]);

    $debt = Debt::where('reference_type', 'handover_holding')
        ->where('reference_id', $this->unit->id)
        ->first();

    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Main Cash Drawer',
        'type' => 'cash',
        'current_balance' => 10000.00,
    ]);

    // Settle the debt payment through debt collector
    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/debts/{$debt->id}/payments", [
            'amount' => 175000.00,
            'financial_account_id' => $account->id,
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    // Verify account got credited
    expect((float) $account->fresh()->current_balance)->toBe(185000.00);

    // Verify unit automatically transitioned to sold!
    $freshUnit = $this->unit->fresh();
    expect($freshUnit->status)->toBe('sold');
    expect($freshUnit->sold_at)->not->toBeNull();
});

test('cannot intake duplicate active IMEI in inventory', function () {
    $response = $this->actingAs($this->user)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '359871109988776',
            'cost_basis' => 150000,
            'condition' => 'new',
        ]);

    $response->assertStatus(422)
        ->assertJsonPath('success', false);
    expect($response->json('message'))->toContain('already in active shop inventory');
});

test('cannot intake duplicate IMEIs within the same bulk batch', function () {
    $response = $this->actingAs($this->user)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $this->variant->id,
            'imeis' => ['359871109988991', '359871109988991'],
            'cost_basis' => 150000,
            'condition' => 'new',
        ]);

    $response->assertStatus(422)
        ->assertJsonPath('success', false);
    expect($response->json('message'))->toContain('Duplicate IMEI');
});

test('a previously sold unit IMEI can be re-intaken if traded back in', function () {
    $this->unit->update([
        'status' => 'sold',
        'sold_at' => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '359871109988776',
            'cost_basis' => 120000,
            'condition' => 'used_clean',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true);

    $count = InventoryUnit::where('imei_or_serial', '359871109988776')->count();
    expect($count)->toBe(2);
});

test('recording maintenance expense marks returned unit as fixed and restock capitalizes cost and adjusts sale value', function () {
    // 1. Setup account with balance and mark unit as returned
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main Ops',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 200000.00,
    ]);

    $this->unit->update([
        'status' => 'returned',
        'cost_basis' => 50000.00,
        'return_reason' => 'Broken screen',
        'returned_at' => now(),
    ]);

    $this->variant->update([
        'default_selling_price' => 65000.00,
    ]);

    // Create another unit under the same variant to verify isolation
    $otherUnit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => '359871109988000',
        'condition' => 'new',
        'cost_basis' => 50000.00,
        'status' => 'in_stock',
        'location' => 'Shop Counter',
    ]);

    // 2. Record maintenance expense linked to this unit
    $expenseRes = $this->actingAs($this->user)
        ->postJson('/api/v1/expenses', [
            'financial_account_id' => $account->id,
            'inventory_unit_id' => $this->unit->id,
            'category' => 'maintenance',
            'amount' => 5000.00,
            'description' => 'Original OLED display replacement for unit',
            'date' => now()->toDateString(),
        ]);

    $expenseRes->assertStatus(201);

    // Verify unit status automatically changed to 'fixed' on repair listing
    $freshUnit = $this->unit->fresh();
    expect($freshUnit->status)->toBe('fixed');

    // Verify maintenance record created as uncapitalized
    $maintenanceRecord = MaintenanceRecord::where('inventory_unit_id', $this->unit->id)->first();
    expect($maintenanceRecord)->not->toBeNull();
    expect((float) $maintenanceRecord->cost)->toBe(5000.00);
    expect($maintenanceRecord->is_capitalized)->toBeFalse();

    // 3. Restock the fixed unit with capitalized cost basis and unit-specific updated retail price
    $restockRes = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/repaired-restock", [
            'condition' => 'refurbished',
            'notes' => 'OEM screen installed, tested fine',
            'new_selling_price' => 72000.00,
        ]);

    $restockRes->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'in_stock');

    $restockedUnit = $this->unit->fresh();
    expect($restockedUnit->status)->toBe('in_stock');
    // ONLY THIS UNIT: Original 50,000 + 5,000 repair expense = 55,000 new cost basis!
    expect((float) $restockedUnit->cost_basis)->toBe(55000.00);
    // ONLY THIS UNIT: selling_price set to 72,000
    expect((float) $restockedUnit->selling_price)->toBe(72000.00);

    // OTHER UNIT under this variant is COMPLETELY UNAFFECTED!
    $freshOtherUnit = $otherUnit->fresh();
    expect((float) $freshOtherUnit->cost_basis)->toBe(50000.00);
    expect($freshOtherUnit->selling_price)->toBeNull();

    // VARIANT DEFAULT SELLING PRICE REMAINS 65,000 UNCHANGED!
    expect((float) $this->variant->fresh()->default_selling_price)->toBe(65000.00);

    // Maintenance record marked as capitalized
    expect($maintenanceRecord->fresh()->is_capitalized)->toBeTrue();

    // Stock quantity on hand is 2 (restocked unit + other unit)
    $stock = InventoryStock::where('variant_id', $this->variant->id)->first();
    expect($stock->quantity_on_hand)->toBe(2);
    // Average cost is (55,000 + 50,000) / 2 = 52,500
    expect((float) $stock->average_cost)->toBe(52500.00);
});

test('sold unit records sold_at timestamp and loads salesOrderItem with customer details in units API', function () {
    // Record a sale for the unit
    $customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Dawit Sold Tester',
        'roles' => ['customer'],
    ]);

    $res = $this->actingAs($this->user)->postJson('/api/v1/sales', [
        'customer_id' => $customer->id,
        'payment_method' => 'cash',
        'paid_amount' => 65000,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 65000,
            ],
        ],
    ]);

    $res->assertStatus(201)->assertJsonPath('success', true);

    $freshUnit = $this->unit->fresh();
    expect($freshUnit->status)->toBe('sold');
    expect($freshUnit->sold_at)->not->toBeNull();

    // Query /api/v1/inventory/units?status=sold
    $unitsRes = $this->actingAs($this->user)->getJson('/api/v1/inventory/units?status=sold');
    $unitsRes->assertStatus(200)->assertJsonPath('success', true);

    $soldUnitData = collect($unitsRes->json('data'))->firstWhere('id', $this->unit->id);
    expect($soldUnitData)->not->toBeNull();
    expect($soldUnitData['status'])->toBe('sold');
    expect($soldUnitData['sold_at'])->not->toBeNull();
    expect($soldUnitData['created_at'])->not->toBeNull();
    expect($soldUnitData['sales_order_item'])->not->toBeNull();
    expect($soldUnitData['sales_order_item']['sales_order']['customer']['name'])->toBe('Dawit Sold Tester');
});

test('owner can update inventory unit details', function () {
    $res = $this->actingAs($this->user)->putJson("/api/v1/inventory/units/{$this->unit->id}", [
        'imei_or_serial' => '359871109988999',
        'condition' => 'used_clean',
        'cost_basis' => 155000.00,
        'selling_price' => 180000.00,
        'battery_health' => 96,
        'cycle_count' => 120,
        'sim_type' => 'physical',
        'location' => 'Display Cabinet 2',
        'notes' => 'Updated after technician battery diagnostic test.',
    ]);

    $res->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.imei_or_serial', '359871109988999')
        ->assertJsonPath('data.condition', 'used_clean')
        ->assertJsonPath('data.battery_health', 96)
        ->assertJsonPath('data.cycle_count', 120)
        ->assertJsonPath('data.sim_type', 'physical')
        ->assertJsonPath('data.location', 'Display Cabinet 2')
        ->assertJsonPath('data.notes', 'Updated after technician battery diagnostic test.');

    $fresh = $this->unit->fresh();
    expect($fresh->imei_or_serial)->toBe('359871109988999');
    expect((float) $fresh->cost_basis)->toBe(155000.0);
    expect((float) $fresh->selling_price)->toBe(180000.0);
});

test('cannot update unit IMEI to duplicate of another active unit', function () {
    InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => '999888777666555',
        'status' => 'in_stock',
        'condition' => 'new',
        'cost_basis' => 150000,
    ]);

    $res = $this->actingAs($this->user)->putJson("/api/v1/inventory/units/{$this->unit->id}", [
        'imei_or_serial' => '999888777666555',
    ]);

    $res->assertStatus(422)
        ->assertJsonPath('success', false);
});

test('cannot restock unit if its IMEI is already assigned to another active unit in stock', function () {
    // Other unit currently in stock with serial 'COLLIDE-123'
    InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'COLLIDE-123',
        'status' => 'in_stock',
        'condition' => 'new',
        'cost_basis' => 50000,
    ]);

    // Our unit on repair shelf with the same serial
    $this->unit->update([
        'status' => 'fixed',
        'imei_or_serial' => 'COLLIDE-123',
    ]);

    $res = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/repaired-restock", [
            'action' => 'restock',
            'condition' => 'refurbished',
        ]);

    $res->assertStatus(422)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', fn ($msg) => str_contains($msg, 'already assigned to an active'));

    // But if we supply a new unique IMEI during restock, it succeeds!
    $res2 = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/repaired-restock", [
            'action' => 'restock',
            'condition' => 'refurbished',
            'imei_or_serial' => 'RESOLVED-123',
        ]);

    $res2->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'in_stock')
        ->assertJsonPath('data.imei_or_serial', 'RESOLVED-123');
});

test('owner can mark a handed-out device as sold with cash payment, crediting account and preventing restocking', function () {
    $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/handover", [
            'handover_to' => 'Bolta',
            'return_deadline' => now()->addDays(5)->toDateString(),
            'handover_payout' => 120000.00,
        ]);

    $debt = Debt::where('reference_type', 'handover_holding')
        ->where('reference_id', $this->unit->id)
        ->first();
    expect($debt)->not->toBeNull();
    expect($debt->status)->toBe('open');

    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abay Bank',
        'type' => 'bank',
        'current_balance' => 50000.00,
    ]);

    // Mark unit as sold with paid settlement
    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/mark-handover-sold", [
            'settlement_type' => 'paid',
            'financial_account_id' => $account->id,
            'selling_price' => 120000.00,
            'reference_number' => 'ABAY-WIRE-99',
            'notes' => 'Customer bought cash from Bolta',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'sold');

    $freshUnit = $this->unit->fresh();
    expect($freshUnit->status)->toBe('sold');
    expect($freshUnit->sold_at)->not->toBeNull();
    expect($freshUnit->location)->toContain('Sold by Bolta');
    expect((float) $account->fresh()->current_balance)->toBe(170000.00);

    // Holding debt is settled
    expect($debt->fresh()->status)->toBe('settled');
    expect((float) $debt->fresh()->remaining_amount)->toBe(0.0);

    // CRITICAL: Selling blocks restock! Cannot restock a sold device
    $restockRes = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/restock");

    $restockRes->assertStatus(422)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Sold products cannot be restocked. If returned by a customer, please process as a Customer Return.');
});

test('owner can mark a handed-out device as sold via bilateral offset against mutual debts', function () {
    $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/handover", [
            'handover_to' => 'Bolta',
            'return_deadline' => now()->addDays(5)->toDateString(),
            'handover_payout' => 100000.00,
        ]);

    $debt = Debt::where('reference_type', 'handover_holding')
        ->where('reference_id', $this->unit->id)
        ->first();

    // Mark as sold via bilateral offset
    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/mark-handover-sold", [
            'settlement_type' => 'offset',
            'selling_price' => 100000.00,
            'notes' => 'Covered by 100k payable we owe Bolta for another device',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $freshUnit = $this->unit->fresh();
    expect($freshUnit->status)->toBe('sold');
    expect($freshUnit->sold_at)->not->toBeNull();

    // Holding debt is settled via BILATERAL-OFFSET payment
    $freshDebt = $debt->fresh();
    expect($freshDebt->status)->toBe('settled');
    expect((float) $freshDebt->remaining_amount)->toBe(0.0);

    $payment = $freshDebt->payments->first();
    expect($payment)->not->toBeNull();
    expect($payment->reference_number)->toBe('BILATERAL-OFFSET');
});

test('owner can mark a handed-out device as sold on credit keeping receivable open', function () {
    $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/handover", [
            'handover_to' => 'Bolta',
            'return_deadline' => now()->addDays(5)->toDateString(),
            'handover_payout' => 110000.00,
        ]);

    $debt = Debt::where('reference_type', 'handover_holding')
        ->where('reference_id', $this->unit->id)
        ->first();

    // Mark as sold on credit
    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/inventory/units/{$this->unit->id}/mark-handover-sold", [
            'settlement_type' => 'credit',
            'notes' => 'Delivered to VIP client, Bolta will settle next Monday',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $freshUnit = $this->unit->fresh();
    expect($freshUnit->status)->toBe('sold');
    expect($freshUnit->sold_at)->not->toBeNull();

    // Debt remains open with notes updated
    $freshDebt = $debt->fresh();
    expect($freshDebt->status)->toBe('open');
    expect((float) $freshDebt->remaining_amount)->toBe(110000.00);
    expect($freshDebt->notes)->toContain('Device confirmed SOLD');
});

test('staff can update full product details including name, variants, cost basis and selling price', function () {
    $response = $this->actingAs($this->user)
        ->putJson("/api/v1/inventory/units/{$this->unit->id}", [
            'product_name' => 'iPhone 16 Pro Max Edition',
            'storage' => '512GB',
            'color' => 'Black Titanium',
            'ram' => '8GB',
            'cost_basis' => 170000.00,
            'selling_price' => 195000.00,
            'condition' => 'new',
            'battery_health' => 99,
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $freshUnit = $this->unit->fresh()->load('variant.product');
    expect($freshUnit->variant->product->name)->toBe('iPhone 16 Pro Max Edition');
    expect($freshUnit->variant->storage)->toBe('512GB');
    expect($freshUnit->variant->color)->toBe('Black Titanium');
    expect($freshUnit->variant->ram)->toBe('8GB');
    expect((float) $freshUnit->cost_basis)->toBe(170000.00);
    expect((float) $freshUnit->selling_price)->toBe(195000.00);
    expect($freshUnit->battery_health)->toBe(99);
});

test('can safely delete an in-stock unit and cancel its unpaid intake debt', function () {
    $contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Supplier',
        'type' => 'supplier',
        'roles' => ['supplier'],
    ]);

    $unpaidDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $contact->id,
        'type' => 'payable',
        'reference_type' => 'stock_intake',
        'reference_id' => $this->unit->id,
        'original_amount' => 160000.00,
        'paid_amount' => 0.0,
        'remaining_amount' => 160000.00,
        'status' => 'open',
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/v1/inventory/units/{$this->unit->id}");

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    // Unit is soft-deleted
    expect(InventoryUnit::find($this->unit->id))->toBeNull();
    expect(InventoryUnit::withTrashed()->find($this->unit->id))->not->toBeNull();

    // Debt is cancelled and zeroed
    $freshDebt = $unpaidDebt->fresh();
    expect($freshDebt->status)->toBe('cancelled');
    expect((float) $freshDebt->remaining_amount)->toBe(0.0);
    expect($freshDebt->notes)->toContain('Voided upon deletion of unit');
});

test('cannot delete a sold unit', function () {
    $this->unit->update([
        'status' => 'sold',
        'sold_at' => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/v1/inventory/units/{$this->unit->id}");

    $response->assertStatus(422)
        ->assertJsonPath('success', false);

    expect(InventoryUnit::find($this->unit->id))->not->toBeNull();
});

test('cannot delete a unit currently out for handover', function () {
    $this->unit->update([
        'status' => 'out',
        'handover_to' => 'Kebede',
        'handed_out_at' => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/v1/inventory/units/{$this->unit->id}");

    $response->assertStatus(422)
        ->assertJsonPath('success', false);

    expect(InventoryUnit::find($this->unit->id))->not->toBeNull();
});

test('cannot delete a unit with partially or fully paid intake debt', function () {
    $contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Paid Supplier',
        'type' => 'supplier',
        'roles' => ['supplier'],
    ]);

    Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $contact->id,
        'type' => 'payable',
        'reference_type' => 'stock_intake',
        'reference_id' => $this->unit->id,
        'original_amount' => 160000.00,
        'paid_amount' => 50000.00,
        'remaining_amount' => 110000.00,
        'status' => 'partially_paid',
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/v1/inventory/units/{$this->unit->id}");

    $response->assertStatus(422)
        ->assertJsonPath('success', false);

    expect(InventoryUnit::find($this->unit->id))->not->toBeNull();
});

test('deleting a unit funded via shop bank account automatically refunds the bank balance and logs audit trail with deleted_by info', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Commercial Bank of Ethiopia (CBE)',
        'type' => 'bank',
        'current_balance' => 500000.00,
    ]);

    $this->unit->update([
        'cost_basis' => 160000.00,
        'payment_account_id' => $account->id,
        'funding_source' => 'shop_account',
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/v1/inventory/units/{$this->unit->id}", [
            'refund_account' => true,
            'reason' => 'Duplicate intake mistake',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    // 1. Account balance is refunded
    expect((float) $account->fresh()->current_balance)->toBe(660000.00);

    // 2. FinancialTransaction is created
    $txn = FinancialTransaction::where('destination_account_id', $account->id)
        ->where('type', 'supplier_refund')
        ->first();
    expect($txn)->not->toBeNull();
    expect((float) $txn->amount)->toBe(160000.00);
    expect($txn->description)->toContain('Unit deleted / intake reversed');

    // 3. AuditLog is recorded with who deleted it and what was deleted
    $log = AuditLog::where('action', 'deleted_unit')
        ->where('entity_id', $this->unit->id)
        ->first();
    expect($log)->not->toBeNull();
    expect($log->user_id)->toBe($this->user->id);
    expect($log->new_values['deleted_by']['name'])->toBe('Yoni Owner');
    expect($log->new_values['deleted_by']['role'])->toBe('owner');
    expect($log->new_values['bank_refund_issued'])->toBeTrue();
    expect($log->new_values['refund_summary'])->toContain('Commercial Bank of Ethiopia');
    expect($log->new_values['reason'])->toBe('Duplicate intake mistake');
});

test('editing a sold unit cascades product name and imei across sales order items, debts, debt payments, and logs human-readable audit trail', function () {
    $contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Halle Vendor',
        'roles' => ['vendor', 'customer'],
        'is_active' => true,
    ]);

    // Create sales order and item for this unit
    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'SO-TEST1234',
        'customer_id' => $contact->id,
        'salesperson_id' => $this->user->id,
        'total_amount' => 185000.00,
        'paid_amount' => 185000.00,
        'payment_status' => 'paid',
        'order_date' => now(),
        'notes' => "Handover sale to halle [unit_id:{$this->unit->id}] for 359871109988776",
    ]);

    $soItem = SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $order->id,
        'variant_id' => $this->variant->id,
        'inventory_unit_id' => $this->unit->id,
        'quantity' => 1,
        'unit_price' => 185000.00,
        'unit_cost' => 160000.00,
        'profit' => 25000.00,
    ]);

    $this->unit->update([
        'status' => 'sold',
        'sold_at' => now(),
        'selling_price' => 185000.00,
    ]);

    // Create handover debt and debt payment referencing this unit
    $debt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $contact->id,
        'type' => 'receivable',
        'reference_type' => 'handover_holding',
        'reference_id' => $this->unit->id,
        'original_amount' => 185000.00,
        'paid_amount' => 185000.00,
        'remaining_amount' => 0.0,
        'status' => 'settled',
        'notes' => 'Handover payout for 359871109988776 to Halle Vendor. Vendor must pay this amount on sale or return the device.',
    ]);

    $debtPayment = DebtPayment::create([
        'tenant_id' => $this->tenant->id,
        'debt_id' => $debt->id,
        'amount' => 185000.00,
        'payment_date' => now(),
        'reference_number' => 'BILATERAL-OFFSET',
        'notes' => "Handover device: iPhone 16 Pro Max (SN: 359871109988776) [unit_id:{$this->unit->id}]",
        'created_by' => $this->user->id,
    ]);

    $ft = FinancialTransaction::create([
        'tenant_id' => $this->tenant->id,
        'transaction_number' => 'TXN-OFFSET-1',
        'type' => 'customer_payment',
        'amount' => 185000.00,
        'date' => now(),
        'description' => "Handover payout from Halle Vendor for SN 359871109988776 [unit_id:{$this->unit->id}]",
        'created_by' => $this->user->id,
    ]);

    $consignmentDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $contact->id,
        'type' => 'payable',
        'reference_type' => 'consignment_sale',
        'reference_id' => $order->id,
        'original_amount' => 185000.00,
        'paid_amount' => 0.0,
        'remaining_amount' => 185000.00,
        'status' => 'open',
        'notes' => 'Consignment sale payout for 359871109988776',
    ]);

    // Now edit unit: rename product and change IMEI
    $response = $this->actingAs($this->user)
        ->putJson("/api/v1/inventory/units/{$this->unit->id}", [
            'product_name' => 'iPhone yonas',
            'imei_or_serial' => '111111111',
            'storage' => '512GB',
            'color' => 'Black Titanium',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    // 1. Inventory unit is updated
    $freshUnit = $this->unit->fresh()->load('variant.product');
    expect($freshUnit->imei_or_serial)->toBe('111111111');
    expect($freshUnit->variant->product->name)->toBe('iPhone yonas');
    expect($freshUnit->variant->storage)->toBe('512GB');

    // 2. Sales order item variant is synchronized
    $freshSoItem = $soItem->fresh()->load('variant.product');
    expect($freshSoItem->variant_id)->toBe($freshUnit->variant_id);
    expect($freshSoItem->variant->product->name)->toBe('iPhone yonas');

    // 3. Debt notes are synchronized
    $freshDebt = $debt->fresh();
    expect($freshDebt->notes)->toContain('111111111');
    expect($freshDebt->notes)->not->toContain('359871109988776');

    $freshConsignmentDebt = $consignmentDebt->fresh();
    expect($freshConsignmentDebt->notes)->toContain('111111111');
    expect($freshConsignmentDebt->notes)->not->toContain('359871109988776');

    // 4. Debt payment notes are synchronized
    $freshPayment = $debtPayment->fresh();
    expect($freshPayment->notes)->toContain('iPhone yonas');
    expect($freshPayment->notes)->toContain('111111111');
    expect($freshPayment->notes)->not->toContain('359871109988776');

    // 5. Sales order notes are synchronized
    $freshOrder = $order->fresh();
    expect($freshOrder->notes)->toContain('111111111');
    expect($freshOrder->notes)->not->toContain('359871109988776');

    // 6. Financial transaction description is synchronized
    $freshFt = $ft->fresh();
    expect($freshFt->description)->toContain('111111111');
    expect($freshFt->description)->not->toContain('359871109988776');

    // 7. Audit log contains human-readable diff and summary
    $log = AuditLog::where('action', 'updated_unit')
        ->where('entity_id', $this->unit->id)
        ->latest('created_at')
        ->first();

    expect($log)->not->toBeNull();
    expect($log->user_id)->toBe($this->user->id);
    expect($log->old_values['product_name'])->toBe('iPhone 16 Pro Max');
    expect($log->old_values['imei_or_serial'])->toBe('359871109988776');
    expect($log->new_values['product_name'])->toBe('iPhone yonas');
    expect($log->new_values['imei_or_serial'])->toBe('111111111');
    expect($log->new_values['summary'])->toContain('iPhone yonas');
    expect($log->new_values['summary'])->toContain('111111111');
    expect($log->new_values['changes'])->toBeArray();
    expect($log->new_values['changes'])->toContain("Product name: 'iPhone 16 Pro Max' → 'iPhone yonas'");
    expect($log->new_values['changes'])->toContain("IMEI/Serial: '359871109988776' → '111111111'");
    expect($log->new_values['updated_by']['name'])->toBe('Yoni Owner');

    // 8. Partner Statement immediately reflects the renamed device and IMEI
    $statementAction = new GeneratePartnerStatementAction;
    $statement = $statementAction->execute($contact);
    $entries = collect($statement['ledger']);
    $consignmentEntry = $entries->firstWhere('type', 'consignment_sale');
    expect($consignmentEntry)->not->toBeNull();
    expect($consignmentEntry['context'])->toContain('iPhone yonas');
    expect($consignmentEntry['context'])->toContain('111111111');
});

test('editing an in-stock unit updates stock intake debt and debt notes across vendor statements', function () {
    $supplier = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Addis Supplier',
        'roles' => ['supplier', 'vendor'],
        'is_active' => true,
    ]);

    $this->unit->update([
        'supplier_contact_id' => $supplier->id,
    ]);

    $intakeDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $supplier->id,
        'type' => 'payable',
        'reference_type' => 'stock_intake',
        'reference_id' => $this->unit->id,
        'original_amount' => 160000.00,
        'paid_amount' => 0.0,
        'remaining_amount' => 160000.00,
        'status' => 'open',
        'notes' => 'Stock intake: iPhone 16 Pro Max (SN: 359871109988776)',
    ]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/v1/inventory/units/{$this->unit->id}", [
            'product_name' => 'iPhone 16 Pro Max Ultra',
            'imei_or_serial' => '999888777',
            'cost_basis' => 165000.00,
        ]);

    $response->assertStatus(200);

    $freshDebt = $intakeDebt->fresh();
    expect($freshDebt->notes)->toBe('Stock intake: iPhone 16 Pro Max Ultra (SN: 999888777)');
    expect((float) $freshDebt->original_amount)->toBe(165000.00);
    expect((float) $freshDebt->remaining_amount)->toBe(165000.00);

    $statementAction = new GeneratePartnerStatementAction;
    $statement = $statementAction->execute($supplier);
    $entry = collect($statement['ledger'])->firstWhere('id', "debt-{$freshDebt->id}");
    expect($entry)->not->toBeNull();
    expect($entry['context'])->toContain('iPhone 16 Pro Max Ultra');
    expect($entry['context'])->toContain('999888777');
});

test('sync sales order items unit variants migration heals mismatched historical order items', function () {
    $category = Category::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Laptops',
        'slug' => 'laptops-'.uniqid(),
    ]);

    $prod1 = Product::create([
        'tenant_id' => $this->tenant->id,
        'category_id' => $category->id,
        'name' => 'MacBook Air M1',
        'brand' => 'Apple',
    ]);
    $var1 = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $prod1->id,
        'storage' => '256GB',
        'default_selling_price' => 50000.00,
    ]);

    $prod2 = Product::create([
        'tenant_id' => $this->tenant->id,
        'category_id' => $category->id,
        'name' => 'MacBook Pro M3',
        'brand' => 'Apple',
    ]);
    $var2 = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $prod2->id,
        'storage' => '512GB',
        'default_selling_price' => 95000.00,
    ]);

    $unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $var2->id,
        'imei_or_serial' => 'MBP-998877',
        'status' => 'sold',
        'cost_basis' => 80000.00,
        'selling_price' => 95000.00,
    ]);

    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-SYNC-TEST-001',
        'salesperson_id' => $this->user->id,
        'total_amount' => 95000.00,
        'paid_amount' => 95000.00,
        'payment_status' => 'paid',
        'order_date' => now(),
    ]);

    $soItem = SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $order->id,
        'variant_id' => $var1->id,
        'inventory_unit_id' => $unit->id,
        'quantity' => 1,
        'unit_price' => 95000.00,
        'unit_cost' => 80000.00,
        'profit' => 15000.00,
    ]);

    expect($soItem->variant_id)->toBe($var1->id);

    // Run the migration up
    $migration = require database_path('migrations/2026_10_12_000001_sync_sales_order_items_unit_variants.php');
    $migration->up();

    $soItem->refresh();
    expect($soItem->variant_id)->toBe($var2->id);
});

test('can intake tablet or device with both serial number and imei', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 1000000.00,
        'is_active' => true,
    ]);

    $response = $this->actingAs($this->user)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $this->variant->id,
            'source_type' => 'purchase',
            'funding_source' => 'account',
            'payment_account_id' => $account->id,
            'cost_basis' => 50000.00,
            'selling_price' => 65000.00,
            'condition' => 'new',
            'serial_number' => 'DMPTAB123456',
            'imei_or_serial' => '861234567890123',
            'sim_type' => 'esim',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.serial_number', 'DMPTAB123456')
        ->assertJsonPath('data.imei_or_serial', '861234567890123');

    $this->assertDatabaseHas('inventory_units', [
        'tenant_id' => $this->tenant->id,
        'serial_number' => 'DMPTAB123456',
        'imei_or_serial' => '861234567890123',
    ]);
});

test('prevents intake with duplicate serial number or duplicate imei', function () {
    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Cash Drawer',
        'type' => 'cash',
        'currency' => 'ETB',
        'current_balance' => 500000.00,
        'is_active' => true,
    ]);

    // Create an existing unit with a serial
    InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'serial_number' => 'SERIAL-DUPE-TEST',
        'imei_or_serial' => 'IMEI-DUPE-TEST',
        'condition' => 'new',
        'cost_basis' => 40000.00,
        'status' => 'in_stock',
    ]);

    // Attempt intake with identical serial_number
    $res = $this->actingAs($this->user)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $this->variant->id,
            'source_type' => 'purchase',
            'funding_source' => 'account',
            'payment_account_id' => $account->id,
            'cost_basis' => 40000.00,
            'condition' => 'new',
            'serial_number' => 'SERIAL-DUPE-TEST',
            'imei_or_serial' => 'DIFFERENT-IMEI-999',
        ]);

    $res->assertStatus(422)
        ->assertJsonPath('success', false)
        ->assertSee('already in active shop inventory');
});

test('can update unit with brand, model name, and specs via drawer update endpoint', function () {
    $res = $this->actingAs($this->user)
        ->putJson("/api/v1/inventory/units/{$this->unit->id}", [
            'product_name' => 'iPhone 16 Pro Max Edition',
            'brand' => 'Apple Inc',
            'storage' => '512GB',
            'color' => 'Black Titanium',
            'specs' => ['connectivity' => '5G Ultra'],
            'condition' => 'used_clean',
            'cost_basis' => 155000.00,
            'selling_price' => 180000.00,
            'location' => 'Safe Backroom',
        ]);

    $res->assertStatus(200)
        ->assertJsonPath('success', true);

    $this->assertDatabaseHas('products', [
        'id' => $this->product->id,
        'brand' => 'Apple Inc',
    ]);

    expect($this->unit->fresh()->condition)->toBe('used_clean');
    expect($this->unit->fresh()->location)->toBe('Safe Backroom');
});
