<?php

use App\Models\AuditLog;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Bank Movement Test Shop',
        'slug' => 'bank-movement-test-shop',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Husni',
        'email' => 'owner.husni@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main Account',
        'type' => 'bank',
        'currency' => 'ETB',
        'current_balance' => 5400.0,
        'is_active' => true,
    ]);
});

test('updating account balance creates a financial transaction and undoable bank balance adjustment log without logging FinancialAccount attributes or logo', function () {
    $response = $this->actingAs($this->owner)
        ->putJson("/api/v1/accounts/{$this->account->id}", [
            'name' => 'CBE Main Account',
            'current_balance' => 15400.0,
            'logo' => 'data:image/jpeg;base64,samplebase64data',
        ]);

    $response->assertStatus(200);

    // Account updated
    expect((float) $this->account->fresh()->current_balance)->toBe(15400.0);

    // Verify FinancialAccount entity_type was NOT logged
    $faLog = AuditLog::where('tenant_id', $this->tenant->id)
        ->where('entity_type', 'FinancialAccount')
        ->first();
    expect($faLog)->toBeNull();

    // Verify a FinancialTransaction was created for the +10,000 ETB deposit
    $txn = FinancialTransaction::where('tenant_id', $this->tenant->id)
        ->where('destination_account_id', $this->account->id)
        ->where('type', 'balance_adjustment')
        ->first();
    expect($txn)->not->toBeNull();
    expect((float) $txn->amount)->toBe(10000.0);

    // Verify an AuditLog was recorded for FinancialTransaction
    $log = AuditLog::where('tenant_id', $this->tenant->id)
        ->where('entity_type', 'FinancialTransaction')
        ->where('entity_id', (string) $txn->id)
        ->first();
    expect($log)->not->toBeNull();
    expect($log->action)->toBe('bank_balance_adjustment');
    expect((float) $log->new_values['amount'])->toBe(10000.0);
    expect($log->new_values['direction'])->toBe('inflow');
    // Ensure raw base64 logo is not in log
    expect(isset($log->new_values['logo']))->toBeFalse();
    expect($log->can_undo)->toBeTrue();
});

test('audit logs index endpoint excludes FinancialAccount records', function () {
    // Manually create a dummy FinancialAccount log just in case
    AuditLog::create([
        'tenant_id' => $this->tenant->id,
        'user_id' => $this->owner->id,
        'action' => 'account_updated',
        'entity_type' => 'FinancialAccount',
        'entity_id' => $this->account->id,
        'created_at' => now(),
    ]);

    $res = $this->actingAs($this->owner)
        ->getJson('/api/v1/audit-logs');

    $res->assertStatus(200);
    $items = $res->json('data.items');
    $hasFA = collect($items)->contains('entity_type', 'FinancialAccount');
    expect($hasFA)->toBeFalse();
});

test('bank balance deposit can be previewed and undone to restore original balance', function () {
    // Update balance: 5400 -> 15400 (+10,000)
    $this->actingAs($this->owner)
        ->putJson("/api/v1/accounts/{$this->account->id}", [
            'current_balance' => 15400.0,
        ])->assertStatus(200);

    $log = AuditLog::where('tenant_id', $this->tenant->id)
        ->where('action', 'bank_balance_adjustment')
        ->first();

    expect($log)->not->toBeNull();
    expect($log->can_undo)->toBeTrue();

    // 1. Preview undo
    $previewRes = $this->actingAs($this->owner)
        ->getJson("/api/v1/audit-logs/{$log->id}/undo-preview")
        ->assertStatus(200);

    expect($previewRes->json('data.can_undo'))->toBeTrue();
    expect($previewRes->json('data.impact_summary.0'))->toContain('deducted by -10000 ETB');

    // 2. Execute undo
    $executeRes = $this->actingAs($this->owner)
        ->postJson("/api/v1/audit-logs/{$log->id}/undo")
        ->assertStatus(200);

    expect($executeRes->json('success'))->toBeTrue();

    // Balance restored back to 5400
    expect((float) $this->account->fresh()->current_balance)->toBe(5400.0);

    // Transaction removed
    expect(FinancialTransaction::find($log->entity_id))->toBeNull();

    // Log marked reverted
    expect($log->fresh()->isReverted())->toBeTrue();
});

test('account activities endpoint returns can_undo and audit_log_id for bank movements', function () {
    // Add balance to account
    $this->actingAs($this->owner)
        ->putJson("/api/v1/accounts/{$this->account->id}", [
            'current_balance' => 15400.0,
        ])->assertStatus(200);

    $activitiesRes = $this->actingAs($this->owner)
        ->getJson("/api/v1/accounts/{$this->account->id}/activities")
        ->assertStatus(200);

    $activities = $activitiesRes->json('data.activities');
    expect(count($activities))->toBeGreaterThan(0);

    $firstAct = $activities[0];
    expect($firstAct['type'])->toBe('balance_adjustment');
    expect($firstAct['can_undo'])->toBeTrue();
    expect($firstAct['audit_log_id'])->not->toBeNull();
});
