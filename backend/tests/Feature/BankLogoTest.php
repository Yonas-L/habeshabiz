<?php

use App\Models\BankLogo;
use App\Models\PlatformAdmin;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Logo Test Shop',
        'slug' => 'logo-test-shop',
        'currency_code' => 'ETB',
    ]);

    $this->user = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Shop Owner',
        'email' => 'owner@logotest.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->admin = PlatformAdmin::create([
        'name' => 'Super Admin',
        'email' => 'superadmin@banklogos.com',
        'password' => Hash::make('Secret123!'),
    ]);
    $this->adminToken = $this->admin->createToken('admin_token')->plainTextToken;
});

test('superadmin can upload a single bank logo image without providing a name', function () {
    $file = UploadedFile::fake()->image('Commercial_Bank_of_Ethiopia.png', 100, 100);

    $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken)
        ->postJson('/api/v1/admin/bank-logos', [
            'file' => $file,
            'category' => 'bank',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true);

    $data = $response->json('data');
    expect($data)->toHaveCount(1);
    expect($data[0]['name'])->toBe('Commercial Bank Of Ethiopia');
    expect($data[0]['category'])->toBe('bank');
    expect($data[0]['logo_url'])->toStartWith('data:image/png;base64,');

    $this->assertDatabaseHas('bank_logos', [
        'id' => $data[0]['id'],
        'name' => 'Commercial Bank Of Ethiopia',
        'category' => 'bank',
    ]);
});

test('superadmin can batch upload multiple logos under mobile_money category', function () {
    $file1 = UploadedFile::fake()->image('telebirr.png', 80, 80);
    $file2 = UploadedFile::fake()->image('cbe_birr.png', 80, 80);

    $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken)
        ->postJson('/api/v1/admin/bank-logos', [
            'files' => [$file1, $file2],
            'category' => 'mobile_money',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true);

    $data = $response->json('data');
    expect($data)->toHaveCount(2);
    expect($data[0]['category'])->toBe('mobile_money');
    expect($data[1]['category'])->toBe('mobile_money');

    expect(BankLogo::where('category', 'mobile_money')->count())->toBe(2);
});

test('superadmin can list all bank logos and filter by category', function () {
    BankLogo::create([
        'category' => 'bank',
        'name' => 'Bank of Abyssinia',
        'logo_url' => 'data:image/png;base64,sample1',
        'sort_order' => 1,
    ]);
    BankLogo::create([
        'category' => 'mobile_money',
        'name' => 'Telebirr',
        'logo_url' => 'data:image/png;base64,sample2',
        'sort_order' => 2,
    ]);

    // All logos
    $responseAll = $this->withHeader('Authorization', 'Bearer '.$this->adminToken)
        ->getJson('/api/v1/admin/bank-logos');
    $responseAll->assertStatus(200);
    expect($responseAll->json('data'))->toHaveCount(2);

    // Filtered by mobile_money
    $responseFiltered = $this->withHeader('Authorization', 'Bearer '.$this->adminToken)
        ->getJson('/api/v1/admin/bank-logos?category=mobile_money');
    $responseFiltered->assertStatus(200);
    expect($responseFiltered->json('data'))->toHaveCount(1);
    expect($responseFiltered->json('data.0.name'))->toBe('Telebirr');
});

test('superadmin can update a logo category and name', function () {
    $logo = BankLogo::create([
        'category' => 'bank',
        'name' => 'Old Name',
        'logo_url' => 'data:image/png;base64,sample',
    ]);

    $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken)
        ->patchJson("/api/v1/admin/bank-logos/{$logo->id}", [
            'name' => 'Awash International Bank',
            'category' => 'custom',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $fresh = $logo->fresh();
    expect($fresh->name)->toBe('Awash International Bank');
    expect($fresh->category)->toBe('custom');
});

test('superadmin can delete a bank logo', function () {
    $logo = BankLogo::create([
        'category' => 'bank',
        'name' => 'Obsolete Bank',
        'logo_url' => 'data:image/png;base64,sample',
    ]);

    $response = $this->withHeader('Authorization', 'Bearer '.$this->adminToken)
        ->deleteJson("/api/v1/admin/bank-logos/{$logo->id}");

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    expect(BankLogo::find($logo->id))->toBeNull();
});

test('non-admin user cannot access admin bank logos endpoints', function () {
    $response = $this->actingAs($this->user)
        ->getJson('/api/v1/admin/bank-logos');

    $response->assertStatus(401);
});

test('authenticated tenant users can fetch public bank logos library filtered by category', function () {
    BankLogo::create([
        'category' => 'bank',
        'name' => 'Cooperative Bank of Oromia',
        'logo_url' => 'data:image/png;base64,coop',
    ]);
    BankLogo::create([
        'category' => 'asset_gold',
        'name' => 'Dubai Gold 24K',
        'logo_url' => 'data:image/png;base64,gold',
    ]);

    // Fetch all
    $response = $this->actingAs($this->user)
        ->getJson('/api/v1/bank-logos');

    $response->assertStatus(200)
        ->assertJsonPath('success', true);

    $data = $response->json('data');
    expect($data)->toHaveCount(2);

    // Fetch category=asset_gold
    $goldResponse = $this->actingAs($this->user)
        ->getJson('/api/v1/bank-logos?category=asset_gold');

    $goldResponse->assertStatus(200);
    $goldData = $goldResponse->json('data');
    expect($goldData)->toHaveCount(1);
    expect($goldData[0]['category'])->toBe('asset_gold');
    expect($goldData[0]['name'])->toBe('Dubai Gold 24K');
});
