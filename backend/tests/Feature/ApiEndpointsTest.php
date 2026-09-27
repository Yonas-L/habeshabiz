<?php

use App\Models\Contact;
use App\Models\FinancialAccount;
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
        'email' => 'yoni.api@example.com',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->mekdi = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Mekdi Peer',
        'roles' => ['peer_vendor', 'supplier'],
    ]);

    $this->cbe = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'CBE Main',
        'type' => 'bank',
        'current_balance' => 500000.00,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Anker Power Bank',
        'category' => 'accessories',
        'has_serials' => false,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'color' => 'Black',
        'default_selling_price' => 20000.00,
    ]);
});

test('api login authenticates and returns sanctum token with user role', function () {
    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'yoni.api@example.com',
        'password' => 'password123',
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonStructure([
            'data' => [
                'token',
                'user' => ['id', 'name', 'email', 'role', 'can_view_costs'],
                'tenant' => ['id', 'name', 'currency'],
            ],
        ]);
});

test('api dashboard returns capital breakdown and monthly metrics', function () {
    $token = $this->user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/dashboard/summary');

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonStructure([
            'data' => [
                'capital_overview' => ['net_capital', 'stock_value', 'receivables', 'cash_and_banks', 'payables'],
                'monthly_performance' => ['revenue', 'gross_profit', 'net_profit'],
                'sales_chart',
            ],
        ]);
});

test('api sales endpoint records brokered sale and generates debt', function () {
    $token = $this->user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/v1/sales', [
            'paid_amount' => 20000.00,
            'payment_method' => 'cbe',
            'financial_account_id' => $this->cbe->id,
            'items' => [
                [
                    'variant_id' => $this->variant->id,
                    'quantity' => 1,
                    'unit_price' => 20000.00,
                    'sourcing_type' => 'brokered_neighbour',
                    'vendor_contact_id' => $this->mekdi->id,
                    'vendor_cost' => 15000.00,
                ],
            ],
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.total_amount', '20000.00');

    // Verify debt created via API
    $debtsResponse = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/debts?type=payable');

    $debtsResponse->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonCount(1, 'data');
});
