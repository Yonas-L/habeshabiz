<?php

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Audit Tech Hub',
        'slug' => 'audit-tech-hub',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Admin',
        'email' => 'owner.admin@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->salesperson = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Sales Counter Staff',
        'email' => 'sales.counter@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'salesperson',
    ]);

    // Seed some test audit logs
    AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'action' => 'stock_intake',
        'entity_type' => 'ProductVariant',
        'entity_id' => 'var-101',
        'old_values' => null,
        'new_values' => ['quantity' => 10, 'imei' => '359123456789012'],
        'ip_address' => '192.168.1.10',
    ]);

    AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->salesperson->id,
        'action' => 'sale_created',
        'entity_type' => 'SalesOrder',
        'entity_id' => 'ord-202',
        'old_values' => null,
        'new_values' => ['total' => 45000, 'items_count' => 1],
        'ip_address' => '192.168.1.20',
    ]);

    AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'action' => 'staff_password_reset',
        'entity_type' => 'User',
        'entity_id' => (string) $this->salesperson->id,
        'old_values' => null,
        'new_values' => ['notes' => 'Temporary password issued'],
        'ip_address' => '192.168.1.10',
    ]);
});

test('non-owner cannot access audit logs endpoint', function () {
    $response = $this->actingAs($this->salesperson)
        ->getJson('/api/v1/audit-logs');

    $response->assertStatus(403)
        ->assertJson([
            'success' => false,
        ]);
});

test('owner can access paginated audit logs with metadata', function () {
    $response = $this->actingAs($this->owner)
        ->getJson('/api/v1/audit-logs?per_page=2');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'success',
            'data' => [
                'items',
                'pagination' => [
                    'current_page',
                    'last_page',
                    'per_page',
                    'total',
                    'from',
                    'to',
                    'has_more',
                ],
                'summary' => [
                    'total_count',
                    'today_count',
                    'filtered_count',
                ],
                'filter_options' => [
                    'actions',
                    'entity_types',
                    'users',
                ],
            ],
        ]);

    $data = $response->json('data');
    expect(count($data['items']))->toBe(2);
    expect($data['pagination']['total'])->toBeGreaterThanOrEqual(3);
    expect($data['pagination']['per_page'])->toBe(2);
});

test('owner can filter audit logs by action and search', function () {
    // Filter by action
    $response = $this->actingAs($this->owner)
        ->getJson('/api/v1/audit-logs?action=sale_created');

    $response->assertStatus(200);
    $items = $response->json('data.items');
    expect(count($items))->toBe(1);
    expect($items[0]['action'])->toBe('sale_created');

    // Search by text in payload or actor
    $searchResponse = $this->actingAs($this->owner)
        ->getJson('/api/v1/audit-logs?search=359123456789012');

    $searchResponse->assertStatus(200);
    $searchItems = $searchResponse->json('data.items');
    expect(count($searchItems))->toBe(1);
    expect($searchItems[0]['action'])->toBe('stock_intake');
});
