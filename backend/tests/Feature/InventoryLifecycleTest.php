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

