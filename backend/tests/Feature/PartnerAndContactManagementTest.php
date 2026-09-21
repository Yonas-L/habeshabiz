<?php

use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
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
        'email' => 'yoni.partners@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->cbe = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'current_balance' => 500000.00,
    ]);
});

test('can list contacts with role filtering, search, and activity counts', function () {
    Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Mekdi Phone Shop',
        'phone' => '+251922110001',
        'roles' => ['peer_vendor', 'supplier'],
        'notes' => 'Bole Medhanialem Mall #204',
        'is_active' => true,
    ]);

    Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Smith Imports',
        'phone' => '+251922110002',
        'roles' => ['supplier', 'partner'],
        'is_active' => true,
    ]);

    Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Customer',
        'phone' => '+251933000001',
        'roles' => ['customer'],
        'is_active' => true,
    ]);

    // Filter by role: peer_vendor
    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/v1/contacts?role=peer_vendor');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('data.0.name'))->toBe('Mekdi Phone Shop');
    expect($response->json('data.0'))->toHaveKey('brokered_items_count');
    expect($response->json('data.0'))->toHaveKey('debts_count');

    // Search by note/phone
    $searchResponse = $this->actingAs($this->user, 'sanctum')
        ->getJson('/api/v1/contacts?search=Medhanialem');
    $searchResponse->assertOk();
    expect($searchResponse->json('data'))->toHaveCount(1);
    expect($searchResponse->json('data.0.name'))->toBe('Mekdi Phone Shop');
});

test('can create a new partner or broker with multiple roles', function () {
    $payload = [
        'name' => 'Yenus Telecom',
        'phone' => '+251911223344',
        'alt_phone' => '+251922334455',
        'email' => 'yenus@telecom.et',
        'roles' => ['peer_vendor', 'supplier', 'partner'],
        'notes' => 'Key partner for Samsung Galaxy Ultra sourcing',
    ];

    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/v1/contacts', $payload);

    $response->assertStatus(201);
    expect($response->json('data.name'))->toBe('Yenus Telecom');
    expect($response->json('data.roles'))->toContain('peer_vendor', 'supplier', 'partner');
    expect($response->json('data.is_active'))->toBeTrue();

    $this->assertDatabaseHas('contacts', [
        'tenant_id' => $this->tenant->id,
        'name' => 'Yenus Telecom',
    ]);
});

test('can update partner details and active status', function () {
    $partner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Original Name',
        'phone' => '+251900000000',
        'roles' => ['peer_vendor'],
        'is_active' => true,
    ]);

    $updateResponse = $this->actingAs($this->user, 'sanctum')
        ->putJson("/api/v1/contacts/{$partner->id}", [
            'name' => 'Updated Electronics',
            'phone' => '+251911999999',
            'notes' => 'Updated location',
            'is_active' => false,
        ]);

    $updateResponse->assertOk();
    expect($updateResponse->json('data.name'))->toBe('Updated Electronics');
    expect($updateResponse->json('data.is_active'))->toBeFalse();
});

test('can safely delete unlinked partner, but prevents deletion when transactions exist', function () {
    $cleanPartner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Unlinked Partner',
        'roles' => ['peer_vendor'],
        'is_active' => true,
    ]);

    // Delete unlinked partner succeeds
    $deleteRes = $this->actingAs($this->user, 'sanctum')
        ->deleteJson("/api/v1/contacts/{$cleanPartner->id}");
    $deleteRes->assertOk();
    expect(Contact::find($cleanPartner->id))->toBeNull();

    // Linked partner with a debt
    $linkedPartner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Partner With History',
        'roles' => ['peer_vendor', 'creditor'],
        'is_active' => true,
    ]);

    Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $linkedPartner->id,
        'type' => 'payable',
        'original_amount' => 50000.00,
        'remaining_amount' => 50000.00,
        'status' => 'open',
        'due_date' => now()->addDays(7),
    ]);

    $linkedDeleteRes = $this->actingAs($this->user, 'sanctum')
        ->deleteJson("/api/v1/contacts/{$linkedPartner->id}");

    $linkedDeleteRes->assertStatus(422);
    expect($linkedDeleteRes->json('can_deactivate'))->toBeTrue();
    expect(Contact::find($linkedPartner->id))->not->toBeNull();
});
