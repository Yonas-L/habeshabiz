<?php

use App\Models\PlatformAdmin;
use App\Models\PlatformSetting;
use App\Models\PlatformSignupAttempt;
use App\Models\PlatformWaitlist;
use App\Models\PlatformWhitelist;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::fake();
    Cache::flush();
});

test('whitelisted email can complete onboarding successfully', function () {
    PlatformSetting::set('registration_open', 'false');

    $whitelist = PlatformWhitelist::create([
        'email' => 'vip@testshop.com',
        'notes' => 'VIP shop tester',
        'status' => 'pending',
    ]);

    $payload = [
        'business_type' => 'electronics',
        'business_name' => 'VIP Electronics',
        'owner_name' => 'VIP Owner',
        'owner_phone' => '+251911000111',
        'owner_email' => 'vip@testshop.com',
        'password' => 'secret123',
        'city' => 'Addis Ababa',
        'team_size' => '2-5',
    ];

    $response = $this->postJson('/api/v1/onboard', $payload);

    $response->assertStatus(201)
        ->assertJsonPath('success', true);

    expect($whitelist->fresh()->status)->toBe('used')
        ->and($whitelist->fresh()->used_at)->not->toBeNull();

    $attempt = PlatformSignupAttempt::where('email', 'vip@testshop.com')->first();
    expect($attempt)->not->toBeNull()
        ->and($attempt->outcome)->toBe('success');
});

test('non-whitelisted email gets 403 with not_whitelisted error and attempt is logged', function () {
    PlatformSetting::set('registration_open', 'false');

    $payload = [
        'business_type' => 'electronics',
        'business_name' => 'Stranger Shop',
        'owner_name' => 'Stranger',
        'owner_phone' => '+251911999888',
        'owner_email' => 'stranger@nowhere.com',
        'password' => 'secret123',
        'city' => 'Hawassa',
        'team_size' => '1',
    ];

    $response = $this->postJson('/api/v1/onboard', $payload);

    $response->assertStatus(403)
        ->assertJson([
            'error' => 'not_whitelisted',
            'message' => 'This email is not on the access list.',
        ])
        ->assertJsonStructure(['error', 'message', 'attempt_id']);

    $attempt = PlatformSignupAttempt::where('email', 'stranger@nowhere.com')->first();
    expect($attempt)->not->toBeNull()
        ->and($attempt->outcome)->toBe('waitlisted');

    expect(User::where('email', 'stranger@nowhere.com')->exists())->toBeFalse();
});

test('waitlist submission with consent=true creates a waitlist record and logs the attempt', function () {
    $payload = [
        'name' => 'Abebe Kebede',
        'email' => 'abebe@waitlist.com',
        'phone' => '+251911223344',
        'business_name' => 'Abebe Mobile',
        'message' => 'Interested in POS for my 2 stores',
        'consented' => true,
    ];

    $response = $this->postJson('/api/v1/waitlist', $payload);

    $response->assertStatus(201)
        ->assertJson(['message' => 'You have been added to the waitlist.']);

    $waitlist = PlatformWaitlist::where('email', 'abebe@waitlist.com')->first();
    expect($waitlist)->not->toBeNull()
        ->and($waitlist->consented)->toBeTrue()
        ->and($waitlist->status)->toBe('pending');

    $attempt = PlatformSignupAttempt::where('email', 'abebe@waitlist.com')->first();
    expect($attempt)->not->toBeNull()
        ->and($attempt->outcome)->toBe('waitlisted');
});

test('waitlist submission with consent=false does not create a waitlist record, updates attempt to opted_out', function () {
    $attempt = PlatformSignupAttempt::create([
        'email' => 'optout@test.com',
        'business_name' => 'Declined Shop',
        'outcome' => 'waitlisted',
        'created_at' => now(),
    ]);

    $payload = [
        'name' => 'Chala Gemechu',
        'email' => 'optout@test.com',
        'consented' => false,
        'attempt_id' => $attempt->id,
    ];

    $response = $this->postJson('/api/v1/waitlist', $payload);

    $response->assertStatus(200)
        ->assertJson(['message' => 'Understood. Your information has not been saved.']);

    expect(PlatformWaitlist::where('email', 'optout@test.com')->exists())->toBeFalse();
    expect($attempt->fresh()->outcome)->toBe('opted_out');
});

test('superadmin can login and receives a token', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Master Superadmin',
        'email' => 'superadmin@platform.com',
        'password' => Hash::make('SuperPass123!'),
    ]);

    $response = $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'superadmin@platform.com',
        'password' => 'SuperPass123!',
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'token',
            'admin' => ['id', 'name', 'email'],
        ]);

    expect($admin->fresh()->last_login_at)->not->toBeNull();
});

test('non-admin cannot access /api/v1/admin/* routes (401)', function () {
    // 1. Unauthenticated request
    $response = $this->getJson('/api/v1/admin/tenants');
    $response->assertStatus(401);

    // 2. Regular tenant user token
    $tenant = Tenant::create([
        'name' => 'Regular Tenant',
        'slug' => 'regular-tenant',
        'phone' => '+251911000000',
        'currency_code' => 'ETB',
        'business_type' => 'electronics',
    ]);

    $user = User::create([
        'tenant_id' => $tenant->id,
        'name' => 'Tenant Owner',
        'email' => 'regular@tenant.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);

    $userToken = $user->createToken('tenant_token')->plainTextToken;

    $responseWithUserToken = $this->withHeader('Authorization', 'Bearer '.$userToken)
        ->getJson('/api/v1/admin/tenants');

    $responseWithUserToken->assertStatus(401);
});

test('locked tenant gets 403 tenant_suspended on any authenticated request', function () {
    $tenant = Tenant::create([
        'name' => 'Suspended Shop',
        'slug' => 'suspended-shop',
        'phone' => '+251911444555',
        'currency_code' => 'ETB',
        'business_type' => 'electronics',
        'is_locked' => true,
        'lock_reason' => 'Payment overdue by 30 days',
        'locked_at' => now(),
    ]);

    $user = User::create([
        'tenant_id' => $tenant->id,
        'name' => 'Suspended Owner',
        'email' => 'suspended@shop.com',
        'password' => Hash::make('secret'),
        'role' => 'owner',
    ]);

    $token = $user->createToken('tenant_token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/v1/auth/me');

    $response->assertStatus(403)
        ->assertJson([
            'error' => 'tenant_suspended',
            'message' => 'Your account has been suspended. Please contact support.',
            'lock_reason' => 'Payment overdue by 30 days',
        ]);
});

test('unlocked tenant can access routes normally', function () {
    $tenant = Tenant::create([
        'name' => 'Active Shop',
        'slug' => 'active-shop',
        'phone' => '+251911666777',
        'currency_code' => 'ETB',
        'business_type' => 'electronics',
        'is_locked' => false,
    ]);

    $user = User::create([
        'tenant_id' => $tenant->id,
        'name' => 'Active Owner',
        'email' => 'active@shop.com',
        'password' => Hash::make('secret'),
        'role' => 'owner',
    ]);

    $token = $user->createToken('tenant_token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/v1/auth/me');

    $response->assertStatus(200);
});

test('admin can lock a tenant with a reason', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin User',
        'email' => 'admin_lock@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    $tenant = Tenant::create([
        'name' => 'Tenant to Lock',
        'slug' => 'tenant-to-lock',
        'phone' => '+251911888999',
        'currency_code' => 'ETB',
        'business_type' => 'electronics',
        'is_locked' => false,
    ]);

    $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->postJson("/api/v1/admin/tenants/{$tenant->id}/lock", [
            'reason' => 'Fraud investigation',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('tenant.is_locked', true)
        ->assertJsonPath('tenant.lock_reason', 'Fraud investigation');

    expect($tenant->fresh()->is_locked)->toBeTrue()
        ->and($tenant->fresh()->lock_reason)->toBe('Fraud investigation')
        ->and($tenant->fresh()->locked_at)->not->toBeNull();
});

test('admin can unlock a tenant', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin User',
        'email' => 'admin_unlock@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    $tenant = Tenant::create([
        'name' => 'Tenant to Unlock',
        'slug' => 'tenant-to-unlock',
        'phone' => '+251911888999',
        'currency_code' => 'ETB',
        'business_type' => 'electronics',
        'is_locked' => true,
        'lock_reason' => 'Previous issue',
        'locked_at' => now(),
    ]);

    $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->postJson("/api/v1/admin/tenants/{$tenant->id}/unlock");

    $response->assertStatus(200)
        ->assertJsonPath('tenant.is_locked', false)
        ->assertJsonPath('tenant.lock_reason', null);

    expect($tenant->fresh()->is_locked)->toBeFalse()
        ->and($tenant->fresh()->lock_reason)->toBeNull()
        ->and($tenant->fresh()->locked_at)->toBeNull();
});

test('admin can add an email to whitelist', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin Whitelist',
        'email' => 'admin_wl@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->postJson('/api/v1/admin/whitelist', [
            'email' => 'newpartner@shop.com',
            'notes' => 'Invited merchant',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('entry.email', 'newpartner@shop.com')
        ->assertJsonPath('entry.status', 'pending');

    expect(PlatformWhitelist::where('email', 'newpartner@shop.com')->exists())->toBeTrue();
});

test('admin can approve a waitlist entry which also creates a whitelist entry', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin Approver',
        'email' => 'admin_approver@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    $waitlist = PlatformWaitlist::create([
        'name' => 'Tigist Alemu',
        'email' => 'tigist@electronics.com',
        'phone' => '+251911556677',
        'business_name' => 'Tigist Phone Center',
        'consented' => true,
        'status' => 'pending',
    ]);

    $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->patchJson("/api/v1/admin/waitlist/{$waitlist->id}", [
            'status' => 'approved',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('entry.status', 'approved');

    expect($waitlist->fresh()->status)->toBe('approved')
        ->and($waitlist->fresh()->contacted_at)->not->toBeNull();

    $whitelistEntry = PlatformWhitelist::where('email', 'tigist@electronics.com')->first();
    expect($whitelistEntry)->not->toBeNull()
        ->and($whitelistEntry->status)->toBe('pending');
});

test('platform_signup_attempts older than 90 days are deleted by the scheduler command', function () {
    $oldAttempt = PlatformSignupAttempt::create([
        'email' => 'old_attempt@test.com',
        'outcome' => 'opted_out',
        'created_at' => now()->subDays(95),
    ]);

    $recentAttempt = PlatformSignupAttempt::create([
        'email' => 'recent_attempt@test.com',
        'outcome' => 'waitlisted',
        'created_at' => now()->subDays(10),
    ]);

    Artisan::call('platform:cleanup-signup-attempts');

    expect(PlatformSignupAttempt::where('id', $oldAttempt->id)->exists())->toBeFalse();
    expect(PlatformSignupAttempt::where('id', $recentAttempt->id)->exists())->toBeTrue();
});

test('admin can retrieve tenants with rich stock metrics and summary aggregates', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin Metrics Tester',
        'email' => 'admin_metrics@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    $tenant = Tenant::create([
        'name' => 'Metrics Shop',
        'slug' => 'metrics-shop',
        'phone' => '+251911999111',
        'currency_code' => 'ETB',
        'business_type' => 'electronics',
        'is_locked' => false,
    ]);

    User::create([
        'tenant_id' => $tenant->id,
        'name' => 'Metrics Owner',
        'email' => 'owner@metricsshop.com',
        'password' => Hash::make('secret'),
        'role' => 'owner',
    ]);

    $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->getJson('/api/v1/admin/tenants');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => [
                    'id',
                    'name',
                    'slug',
                    'owner_email',
                    'stock_count',
                    'sales_count',
                    'sales_volume',
                    'last_activity_at',
                    'is_locked',
                ],
            ],
            'summary' => [
                'total_tenants',
                'active_tenants',
                'total_stock_count',
                'total_sales_volume',
                'total_users',
            ],
            'pagination',
        ]);
});

test('admin can inspect a single tenant health and activity logs', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin Inspector',
        'email' => 'admin_inspector@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    $tenant = Tenant::create([
        'name' => 'Inspect Shop',
        'slug' => 'inspect-shop',
        'phone' => '+251911333444',
        'currency_code' => 'ETB',
        'business_type' => 'electronics',
        'is_locked' => false,
    ]);

    $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->getJson("/api/v1/admin/tenants/{$tenant->id}");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'tenant' => ['id', 'name', 'slug', 'business_type', 'is_locked'],
            'users',
            'financial_accounts',
            'inventory' => ['total_products', 'in_stock_units', 'total_stock_count', 'inventory_valuation_etb'],
            'sales' => ['total_sales_count', 'total_sales_volume', 'recent_orders'],
            'recent_activity',
        ]);
});

test('admin can reset a tenant data completely while preserving login users and profile', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin Reset Test',
        'email' => 'admin_reset@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    $onboardingService = app(\App\Services\TenantOnboardingService::class);
    $res = $onboardingService->onboard([
        'business_type' => 'electronics',
        'business_name' => 'Test Reset Store',
        'owner_name' => 'Store Owner',
        'owner_phone' => '+251911999888',
        'owner_email' => 'owner_reset@test.com',
        'password' => 'secret123',
        'city' => 'Addis Ababa',
        'team_size' => '2-5',
    ]);

    $tenant = $res['tenant'];
    $user = $res['user'];

    // Create some sales or inventory for this tenant
    $category = \App\Models\Category::where('tenant_id', $tenant->id)->first();
    $product = \App\Models\Product::create([
        'tenant_id' => $tenant->id,
        'category_id' => $category?->id,
        'name' => 'Dummy Phone',
        'brand' => 'Apple',
        'model' => 'iPhone 15',
        'has_serials' => true,
        'is_active' => true,
    ]);
    $variant = \App\Models\ProductVariant::create([
        'tenant_id' => $tenant->id,
        'product_id' => $product->id,
    ]);
    \App\Models\InventoryUnit::create([
        'tenant_id' => $tenant->id,
        'variant_id' => $variant->id,
        'imei' => '354892019283741',
        'cost_basis' => 50000,
        'status' => 'in_stock',
    ]);

    expect(\App\Models\InventoryUnit::where('tenant_id', $tenant->id)->count())->toBe(1);

    // Call reset endpoint
    $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->postJson("/api/v1/admin/tenants/{$tenant->id}/reset-data");

    $response->assertStatus(200)
        ->assertJson([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
            ],
        ]);

    // Transactional records cleared
    expect(\App\Models\InventoryUnit::where('tenant_id', $tenant->id)->count())->toBe(0);
    expect(\App\Models\SalesOrder::where('tenant_id', $tenant->id)->count())->toBe(0);

    // User and tenant preserved
    expect(\App\Models\User::where('tenant_id', $tenant->id)->count())->toBe(1);
    expect(\App\Models\Tenant::where('id', $tenant->id)->exists())->toBeTrue();
    expect(\App\Models\FinancialAccount::where('tenant_id', $tenant->id)->count())->toBeGreaterThan(0);
});

test('admin can permanently delete a tenant and all its data', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin Delete Test',
        'email' => 'admin_delete@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    $onboardingService = app(\App\Services\TenantOnboardingService::class);
    $res = $onboardingService->onboard([
        'business_type' => 'electronics',
        'business_name' => 'Delete Me Store',
        'owner_name' => 'Owner Delete',
        'owner_phone' => '+251911777666',
        'owner_email' => 'owner_delete@test.com',
        'password' => 'secret123',
        'city' => 'Addis Ababa',
        'team_size' => '1',
    ]);

    $tenant = $res['tenant'];

    // Call delete endpoint
    $response = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->deleteJson("/api/v1/admin/tenants/{$tenant->id}");

    $response->assertStatus(200);

    expect(\App\Models\Tenant::where('id', $tenant->id)->exists())->toBeFalse();
    expect(\App\Models\User::where('tenant_id', $tenant->id)->exists())->toBeFalse();
    expect(\App\Models\FinancialAccount::where('tenant_id', $tenant->id)->exists())->toBeFalse();
});

test('admin can toggle business type active status and disabled business type is rejected on registration', function () {
    $admin = PlatformAdmin::create([
        'name' => 'Admin Vertical Test',
        'email' => 'admin_vert@platform.com',
        'password' => Hash::make('secret'),
    ]);
    $adminToken = $admin->createToken('admin_token')->plainTextToken;

    // 1. Admin disables electronics
    $resToggle = $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->patchJson('/api/v1/admin/settings', [
            'key' => 'business_type_electronics_enabled',
            'value' => 'false',
        ]);
    $resToggle->assertStatus(200);

    // 2. Public config shows electronics as unavailable
    $resConfig = $this->getJson('/api/v1/onboard/business-types');
    $resConfig->assertStatus(200);
    $types = collect($resConfig->json('business_types'));
    $electronicsType = $types->firstWhere('id', 'electronics');
    expect($electronicsType['available'])->toBeFalse();

    // 3. Trying to register with electronics fails with 422
    PlatformSetting::set('registration_open', 'true');
    $resOnboard = $this->postJson('/api/v1/onboard', [
        'business_type' => 'electronics',
        'business_name' => 'Disabled Electronics',
        'owner_name' => 'John Doe',
        'owner_phone' => '+251911999888',
        'owner_email' => 'john_disabled@test.com',
        'password' => 'secret123',
        'city' => 'Addis Ababa',
        'team_size' => '1',
    ]);
    $resOnboard->assertStatus(422)
        ->assertJsonPath('error', 'business_type_disabled');

    // 4. Admin re-enables electronics
    $this->withHeader('Authorization', 'Bearer '.$adminToken)
        ->patchJson('/api/v1/admin/settings', [
            'key' => 'business_type_electronics_enabled',
            'value' => 'true',
        ])
        ->assertStatus(200);

    // 5. Registration now succeeds
    $resOnboardSuccess = $this->postJson('/api/v1/onboard', [
        'business_type' => 'electronics',
        'business_name' => 'Enabled Electronics',
        'owner_name' => 'John Doe',
        'owner_phone' => '+251911999888',
        'owner_email' => 'john_enabled@test.com',
        'password' => 'secret123',
        'city' => 'Addis Ababa',
        'team_size' => '1',
    ]);
    $resOnboardSuccess->assertStatus(201);
});

