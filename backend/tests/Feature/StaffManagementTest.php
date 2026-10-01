<?php

use App\Models\AuditLog;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\StaffTask;
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

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yoni Owner',
        'email' => 'yoni.owner@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->staff = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husa Lead Sales',
        'email' => 'husa.staff@example.com',
        'password' => Hash::make('password123'),
        'role' => 'salesperson',
        'permissions' => ['can_view_costs' => false],
    ]);

    $this->cbe = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Commercial Bank of Ethiopia',
        'type' => 'bank',
        'current_balance' => 1250000.00,
        'is_custom_asset' => false,
    ]);

    $this->gold = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Physical Gold Vault',
        'type' => 'asset_gold',
        'current_balance' => 78000.00,
        'is_custom_asset' => true,
    ]);
});

test('owner can view staff list with sales metrics', function () {
    $response = $this->actingAs($this->owner)
        ->getJson('/api/v1/staff');

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    expect(count($response->json('data')))->toBeGreaterThanOrEqual(1);
});

test('salesperson cannot access staff management list', function () {
    $response = $this->actingAs($this->staff)
        ->getJson('/api/v1/staff');

    $response->assertStatus(403);
});

test('owner can create a staff member with auto-generated temporary password and audit log', function () {
    $response = $this->actingAs($this->owner)
        ->postJson('/api/v1/staff', [
            'name' => 'Abel Tesfaye',
            'phone' => '+251911998877',
            'can_discount' => true,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true);

    $tempPassword = $response->json('data.temporary_password');
    expect($tempPassword)->not->toBeNull();
    expect($tempPassword)->toStartWith('Bole-');

    $createdUser = User::where('phone', '+251911998877')->first();
    expect($createdUser)->not->toBeNull();
    expect($createdUser->role)->toBe('salesperson');
    expect(Hash::check($tempPassword, $createdUser->password))->toBeTrue();

    // Verify audit log
    $log = AuditLog::where('action', 'staff_created')->first();
    expect($log)->not->toBeNull();
});

test('owner can reset staff password generating new temporary password', function () {
    $response = $this->actingAs($this->owner)
        ->postJson("/api/v1/staff/{$this->staff->id}/reset-password");

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $newPass = $response->json('data.temporary_password');
    expect($newPass)->toStartWith('Bole-');
    expect(Hash::check($newPass, $this->staff->fresh()->password))->toBeTrue();
});

test('staff member can change their password with current password confirmation', function () {
    $response = $this->actingAs($this->staff)
        ->postJson('/api/v1/auth/change-password', [
            'current_password' => 'password123',
            'new_password' => 'MyNewSecret#2026',
            'new_password_confirmation' => 'MyNewSecret#2026',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    expect(Hash::check('MyNewSecret#2026', $this->staff->fresh()->password))->toBeTrue();
});

test('staff member cannot change password with wrong current password', function () {
    $response = $this->actingAs($this->staff)
        ->postJson('/api/v1/auth/change-password', [
            'current_password' => 'wrongpassword',
            'new_password' => 'MyNewSecret#2026',
            'new_password_confirmation' => 'MyNewSecret#2026',
        ]);

    $response->assertStatus(422);
});

test('account balances and custom assets are strictly masked for salesperson', function () {
    $response = $this->actingAs($this->staff)
        ->getJson('/api/v1/accounts');

    $response->assertStatus(200);

    // Current balance must be null
    $accounts = $response->json('data.treasury_accounts');
    expect($accounts[0]['current_balance'])->toBeNull();
    expect($accounts[0]['name'])->toBe('Commercial Bank of Ethiopia');

    // Asset accounts and totals must be hidden
    expect($response->json('data.asset_accounts'))->toBeEmpty();
    expect($response->json('data.grand_total'))->toBeNull();
});

test('salesperson cannot transfer funds between financial accounts', function () {
    $response = $this->actingAs($this->staff)
        ->postJson('/api/v1/accounts/transfer', [
            'source_account_id' => $this->cbe->id,
            'destination_account_id' => $this->gold->id,
            'amount' => 1000,
        ]);

    $response->assertStatus(403);
});

test('salesperson only sees their own sales', function () {
    $otherStaff = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Kalid Sales',
        'email' => 'kalid.other@example.com',
        'password' => Hash::make('password123'),
        'role' => 'salesperson',
    ]);

    // Sale by Husa
    SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-HUSA-001',
        'salesperson_id' => $this->staff->id,
        'total_amount' => 150000,
        'paid_amount' => 150000,
        'payment_status' => 'paid',
        'payment_method' => 'cbe',
        'order_date' => now(),
    ]);

    // Sale by Kalid
    SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-KALID-001',
        'salesperson_id' => $otherStaff->id,
        'total_amount' => 170000,
        'paid_amount' => 170000,
        'payment_status' => 'paid',
        'payment_method' => 'telebirr',
        'order_date' => now(),
    ]);

    // When Husa fetches sales
    $response = $this->actingAs($this->staff)
        ->getJson('/api/v1/sales');

    $response->assertStatus(200);
    $orders = $response->json('data');
    expect(count($orders))->toBe(1);
    expect($orders[0]['order_number'])->toBe('ORD-HUSA-001');

    // When Owner fetches sales, owner sees both
    $ownerResponse = $this->actingAs($this->owner)
        ->getJson('/api/v1/sales');
    expect(count($ownerResponse->json('data')))->toBe(2);
});

test('staff can create, toggle, and delete personal tasks', function () {
    // Create
    $res = $this->actingAs($this->staff)
        ->postJson('/api/v1/tasks', [
            'title' => 'Call Ebro for iPhone pickup',
            'priority' => 'high',
        ]);

    $res->assertStatus(201);
    $taskId = $res->json('data.id');

    // Toggle complete
    $toggleRes = $this->actingAs($this->staff)
        ->patchJson("/api/v1/tasks/{$taskId}/toggle");

    $toggleRes->assertStatus(200)
        ->assertJsonPath('data.is_completed', true);

    // Delete
    $delRes = $this->actingAs($this->staff)
        ->deleteJson("/api/v1/tasks/{$taskId}");

    $delRes->assertStatus(200);
    expect(StaffTask::find($taskId))->toBeNull();
});

test('leaderboard returns ranked sellers with volume and bonuses', function () {
    $res = $this->actingAs($this->staff)
        ->getJson('/api/v1/staff/leaderboard');

    $res->assertStatus(200)
        ->assertJsonPath('success', true);

    expect($res->json('data.leaderboard'))->toBeArray();
});

test('owner can update staff privileges and details', function () {
    $res = $this->actingAs($this->owner)
        ->putJson("/api/v1/staff/{$this->staff->id}", [
            'name' => 'Husa Senior Sales',
            'phone' => '+251911223344',
            'can_discount' => true,
            'can_handover' => true,
            'can_intake_stock' => true,
            'can_view_costs' => true,
            'can_manage_inventory' => true,
        ]);

    $res->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.name', 'Husa Senior Sales');

    $freshStaff = $this->staff->fresh();
    expect($freshStaff->name)->toBe('Husa Senior Sales');
    expect($freshStaff->canDiscount())->toBeTrue();
    expect($freshStaff->canHandover())->toBeTrue();
    expect($freshStaff->canIntakeStock())->toBeTrue();
    expect($freshStaff->canViewCosts())->toBeTrue();
    expect($freshStaff->canManageInventory())->toBeTrue();

    // Verify audit log
    $log = AuditLog::where('action', 'staff_updated')->where('entity_id', (string) $this->staff->id)->first();
    expect($log)->not->toBeNull();
});

test('staff permission enforcement for stock intake and handover', function () {
    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro Max',
        'brand' => 'Apple',
        'category' => 'smartphones',
    ]);

    $variant = ProductVariant::create([
        'product_id' => $product->id,
        'storage' => '256GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 175000,
    ]);

    // 1. Without can_intake_stock, staff gets 403
    $this->staff->update([
        'permissions' => ['can_intake_stock' => false],
    ]);

    $intakeFail = $this->actingAs($this->staff)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $variant->id,
            'imei_or_serial' => 'IMEI-TEST-999',
            'cost_basis' => 120000,
            'condition' => 'brand_new',
        ]);
    $intakeFail->assertStatus(403);

    // 2. With can_intake_stock granted, staff succeeds
    $this->staff->update([
        'permissions' => ['can_intake_stock' => true],
    ]);

    $intakeSuccess = $this->actingAs($this->staff)
        ->postJson('/api/v1/inventory/units', [
            'variant_id' => $variant->id,
            'imei_or_serial' => 'IMEI-TEST-999',
            'cost_basis' => 120000,
            'condition' => 'brand_new',
        ]);
    $intakeSuccess->assertStatus(201);
    $unitId = $intakeSuccess->json('data.id');

    // 3. Without can_handover, staff cannot handover unit
    $this->staff->update([
        'permissions' => [
            'can_intake_stock' => true,
            'can_handover' => false,
        ],
    ]);

    $handoverFail = $this->actingAs($this->staff)
        ->postJson("/api/v1/inventory/units/{$unitId}/handover", [
            'handover_to' => 'Brokers Hub',
        ]);
    $handoverFail->assertStatus(403);

    // 4. With can_handover granted, staff can handover unit
    $this->staff->update([
        'permissions' => [
            'can_intake_stock' => true,
            'can_handover' => true,
        ],
    ]);

    $handoverSuccess = $this->actingAs($this->staff)
        ->postJson("/api/v1/inventory/units/{$unitId}/handover", [
            'handover_to' => 'Brokers Hub',
        ]);
    $handoverSuccess->assertStatus(200);
});
