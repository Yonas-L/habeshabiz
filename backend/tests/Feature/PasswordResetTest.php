<?php

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

test('it sends password reset notification for valid user and returns generic message', function () {
    Notification::fake();

    $tenant = Tenant::create([
        'name' => 'Tech Corp',
        'slug' => 'tech-corp',
        'currency_code' => 'ETB',
    ]);

    $user = User::create([
        'name' => 'Alice Admin',
        'email' => 'alice@techcorp.com',
        'password' => Hash::make('OldPassword123!'),
        'tenant_id' => $tenant->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $response = $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'alice@techcorp.com',
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('message', 'If your email is registered, you will receive a password reset link shortly.');

    Notification::assertSentTo($user, ResetPassword::class);
});

test('it returns generic success message when email is not registered to prevent enumeration', function () {
    Notification::fake();

    $response = $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'nonexistent@example.com',
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('message', 'If your email is registered, you will receive a password reset link shortly.');

    Notification::assertNothingSent();
});

test('it validates email format on forgot password request', function () {
    $response = $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'not-an-email',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('success', false)
        ->assertJsonValidationErrors(['email']);
});

test('it resets password successfully with valid token and revokes existing tokens', function () {
    $tenant = Tenant::create([
        'name' => 'Hardware Pro',
        'slug' => 'hardware-pro',
        'currency_code' => 'USD',
    ]);

    $user = User::create([
        'name' => 'Bob Owner',
        'email' => 'bob@hardware.com',
        'password' => Hash::make('InitialPassword123!'),
        'tenant_id' => $tenant->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    // Create an existing Sanctum token
    $oldToken = $user->createToken('test_token')->plainTextToken;
    expect($user->tokens()->count())->toBe(1);

    // Generate reset token
    $token = Password::broker()->createToken($user);

    $response = $this->postJson('/api/v1/auth/reset-password', [
        'token' => $token,
        'email' => 'bob@hardware.com',
        'password' => 'NewSecurePassword456!',
        'password_confirmation' => 'NewSecurePassword456!',
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('message', 'Your password has been reset successfully. You may now log in.');

    // Password must be updated
    $user->refresh();
    expect(Hash::check('NewSecurePassword456!', $user->password))->toBeTrue();

    // Old tokens must be revoked
    expect($user->tokens()->count())->toBe(0);

    // Audit log must be recorded
    $log = AuditLog::withoutGlobalScope(TenantScope::class)
        ->where('entity_type', 'User')
        ->where('entity_id', (string) $user->id)
        ->where('action', 'password_reset_completed')
        ->first();

    expect($log)->not->toBeNull();
});

test('it rejects reset attempt with invalid token', function () {
    $tenant = Tenant::create([
        'name' => 'Secure Shop',
        'slug' => 'secure-shop',
        'currency_code' => 'USD',
    ]);

    User::create([
        'name' => 'Charlie Staff',
        'email' => 'charlie@shop.com',
        'password' => Hash::make('CurrentPassword123!'),
        'tenant_id' => $tenant->id,
        'role' => 'manager',
        'is_active' => true,
    ]);

    $response = $this->postJson('/api/v1/auth/reset-password', [
        'token' => 'invalid-or-fake-token-12345',
        'email' => 'charlie@shop.com',
        'password' => 'BrandNewPassword123!',
        'password_confirmation' => 'BrandNewPassword123!',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('success', false);
});

test('it validates password length and confirmation on reset', function () {
    $response = $this->postJson('/api/v1/auth/reset-password', [
        'token' => 'some-token',
        'email' => 'test@example.com',
        'password' => 'short',
        'password_confirmation' => 'mismatch',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('success', false)
        ->assertJsonValidationErrors(['password']);
});

test('it rate limits repeated forgot-password requests and returns structured 429 response', function () {
    Notification::fake();

    for ($i = 0; $i < 5; $i++) {
        $res = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'rate-limit-test@example.com',
        ]);
        $res->assertStatus(200);
    }

    $blocked = $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'rate-limit-test@example.com',
    ]);

    $blocked->assertStatus(429)
        ->assertJsonPath('success', false)
        ->assertJsonStructure(['success', 'message', 'retry_after']);
});
