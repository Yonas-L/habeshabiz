<?php

use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
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

    expect(\App\Models\AuditLog::where('action', 'stock_intake')->exists())->toBeTrue();
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
    $debt = \App\Models\Debt::where('reference_type', 'handover_holding')
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

    $debt = \App\Models\Debt::where('reference_type', 'handover_holding')
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

    $debt = \App\Models\Debt::where('reference_type', 'handover_holding')
        ->where('reference_id', $this->unit->id)
        ->first();

    $account = \App\Models\FinancialAccount::create([
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



