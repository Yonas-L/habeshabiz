<?php

use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Existing Electronics Shop',
        'slug' => 'existing-electronics-shop',
        'phone' => '+251911998877',
        'currency_code' => 'ETB',
        'business_type' => 'electronics',
        'settings' => [
            'city' => 'Addis Ababa',
            'address' => 'Bole Road',
            'team_size' => '2-5',
            'tin_number' => '9876543210',
            'logo_url' => null,
            'footer_note' => 'Original shop note',
            'secondary_currencies' => ['USD'],
        ],
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Existing Owner',
        'email' => 'owner@existing.com',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->salesperson = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Existing Sales Staff',
        'email' => 'sales@existing.com',
        'password' => Hash::make('secret123'),
        'role' => 'salesperson',
    ]);

    TenantScope::setForcedTenantId(null);
});

test('public onboarding creates tenant, owner user, starter accounts, and seeds electronics catalog', function () {
    $payload = [
        'business_type' => 'electronics',
        'business_name' => 'Addis Mobile Zone',
        'owner_name' => 'Abebe Kebede',
        'owner_phone' => '+251912345678',
        'owner_email' => 'abebe@addismobile.et',
        'password' => 'securepass123',
        'city' => 'Addis Ababa',
        'team_size' => '2-5',
    ];

    $response = $this->postJson('/api/v1/onboard', $payload);

    $response->assertStatus(201)
        ->assertJsonStructure([
            'success',
            'message',
            'data' => [
                'token',
                'user' => ['id', 'name', 'email', 'phone', 'role'],
                'tenant' => ['id', 'name', 'slug', 'currency', 'business_type', 'settings'],
            ],
        ]);

    $data = $response->json('data');
    $token = $data['token'];
    $tenantId = $data['tenant']['id'];

    expect($token)->not->toBeEmpty();
    expect($data['tenant']['name'])->toBe('Addis Mobile Zone');
    expect($data['tenant']['business_type'])->toBe('electronics');
    expect($data['user']['email'])->toBe('abebe@addismobile.et');

    // Verify token can make authenticated requests
    $authCheck = $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/v1/auth/me');
    $authCheck->assertStatus(200);

    // Verify Starter Accounts were seeded
    $accountsCount = FinancialAccount::withoutGlobalScopes()
        ->where('tenant_id', $tenantId)
        ->count();
    expect($accountsCount)->toBeGreaterThanOrEqual(3);

    // Verify Electronics Categories were seeded
    $categoriesCount = Category::withoutGlobalScopes()
        ->where('tenant_id', $tenantId)
        ->count();
    expect($categoriesCount)->toBe(7);

    // Verify Products and Variants were seeded
    $productsCount = Product::withoutGlobalScopes()
        ->where('tenant_id', $tenantId)
        ->count();
    expect($productsCount)->toBeGreaterThan(20);

    // Verify serial-tracked flag
    $s25 = Product::withoutGlobalScopes()
        ->where('tenant_id', $tenantId)
        ->where('name', 'Samsung Galaxy S25')
        ->first();
    expect($s25)->not->toBeNull();
    expect($s25->has_serials)->toBeTrue();

    // Verify accessory is quantity-based (has_serials = false)
    $charger = Product::withoutGlobalScopes()
        ->where('tenant_id', $tenantId)
        ->where('name', 'Apple 20W USB-C Charger')
        ->first();
    expect($charger)->not->toBeNull();
    expect($charger->has_serials)->toBeFalse();
});

test('onboarding rejects invalid payload and duplicate emails', function () {
    // Missing required fields
    $this->postJson('/api/v1/onboard', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['business_type', 'business_name', 'owner_name', 'owner_email', 'password']);

    // Duplicate email
    $this->postJson('/api/v1/onboard', [
        'business_type' => 'electronics',
        'business_name' => 'Shop B',
        'owner_name' => 'Duplicate Owner',
        'owner_phone' => '+251911111111',
        'owner_email' => 'owner@existing.com',
        'password' => 'secret123',
        'city' => 'Addis Ababa',
        'team_size' => '1',
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['owner_email']);
});

test('onboarding supports other business types like clothing', function () {
    $response = $this->postJson('/api/v1/onboard', [
        'business_type' => 'clothing',
        'business_name' => 'Habesha Fashion Boutique',
        'owner_name' => 'Selamawit Desta',
        'owner_phone' => '+251911224466',
        'owner_email' => 'selam@habeshafashion.et',
        'password' => 'fashion2026',
        'city' => 'Hawassa',
        'team_size' => '2-5',
    ]);

    $response->assertStatus(201);
    $tenantId = $response->json('data.tenant.id');

    $categoriesCount = Category::withoutGlobalScopes()
        ->where('tenant_id', $tenantId)
        ->count();
    expect($categoriesCount)->toBe(4);
});

test('owner can retrieve tenant and user profile settings', function () {
    $response = $this->actingAs($this->owner)
        ->getJson('/api/v1/settings/profile');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'success',
            'data' => [
                'tenant' => [
                    'id',
                    'name',
                    'slug',
                    'phone',
                    'currency_code',
                    'business_type',
                    'city',
                    'address',
                    'team_size',
                    'tin_number',
                    'logo_url',
                    'footer_note',
                    'secondary_currencies',
                ],
                'user' => ['id', 'name', 'email', 'phone', 'role'],
            ],
        ]);

    expect($response->json('data.tenant.name'))->toBe('Existing Electronics Shop');
    expect($response->json('data.tenant.city'))->toBe('Addis Ababa');
});

test('salesperson cannot access settings profile', function () {
    $this->actingAs($this->salesperson)
        ->getJson('/api/v1/settings/profile')
        ->assertStatus(403);
});

test('owner can update business profile details', function () {
    $updateData = [
        'name' => 'Updated Electronics Hub',
        'phone' => '+251900112233',
        'currency_code' => 'ETB',
        'city' => 'Bishoftu',
        'address' => 'Main Street, Building 4',
        'tin_number' => '1122334455',
        'footer_note' => 'All sales are final after 14 days warranty.',
        'secondary_currencies' => ['USD', 'EUR'],
        'owner_name' => 'Updated Owner Name',
        'owner_phone' => '+251900112244',
    ];

    $response = $this->actingAs($this->owner)
        ->putJson('/api/v1/settings/profile', $updateData);

    $response->assertStatus(200)
        ->assertJson([
            'success' => true,
            'message' => 'Business profile updated successfully.',
        ]);

    $this->tenant->refresh();
    expect($this->tenant->name)->toBe('Updated Electronics Hub');
    expect($this->tenant->settings['city'])->toBe('Bishoftu');
    expect($this->tenant->settings['tin_number'])->toBe('1122334455');
    expect($this->tenant->settings['footer_note'])->toBe('All sales are final after 14 days warranty.');

    $this->owner->refresh();
    expect($this->owner->name)->toBe('Updated Owner Name');
    expect($this->owner->phone)->toBe('+251900112244');
});

test('salesperson cannot update business profile details', function () {
    $this->actingAs($this->salesperson)
        ->putJson('/api/v1/settings/profile', ['name' => 'Hack Attempt'])
        ->assertStatus(403);
});

test('owner can upload business logo', function () {
    Storage::fake('public');

    $file = UploadedFile::fake()->image('business_logo.png', 400, 400);

    $response = $this->actingAs($this->owner)
        ->postJson('/api/v1/settings/profile/logo', [
            'logo' => $file,
        ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'success',
            'message',
            'data' => ['logo_url'],
        ]);

    $logoUrl = $response->json('data.logo_url');
    expect($logoUrl)->not->toBeEmpty();

    $this->tenant->refresh();
    expect($this->tenant->settings['logo_url'])->toBe($logoUrl);
});

test('newly onboarded tenant has 0 staff members and does not see other tenants staff', function () {
    // We already have $this->salesperson created under $this->tenant in beforeEach
    $onboardResponse = $this->postJson('/api/v1/onboard', [
        'business_type' => 'electronics',
        'business_name' => 'Brand New Shop',
        'owner_name' => 'Fresh Owner',
        'owner_phone' => '+251977000000',
        'owner_email' => 'fresh@brandnew.et',
        'password' => 'secret123',
        'city' => 'Addis Ababa',
        'team_size' => '2-5',
    ]);

    $onboardResponse->assertStatus(201);
    $token = $onboardResponse->json('data.token');

    // Fresh owner queries staff
    $staffResponse = $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/v1/staff');

    $staffResponse->assertStatus(200);
    // Must be strictly 0, not seeing $this->salesperson or any other tenant's staff
    expect($staffResponse->json('data'))->toBeArray()->toBeEmpty();

    // Fresh owner queries staff leaderboard
    $leaderboardResponse = $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/v1/staff/leaderboard');

    $leaderboardResponse->assertStatus(200);
    expect($leaderboardResponse->json('data.leaderboard'))->toBeArray()->toBeEmpty();
});
