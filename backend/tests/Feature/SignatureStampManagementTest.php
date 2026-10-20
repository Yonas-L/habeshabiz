<?php

use App\Models\Contact;
use App\Models\FinancialAccount;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use App\Services\PdfGeneratorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\LaravelPdf\Facades\Pdf;

uses(RefreshDatabase::class);

beforeEach(function () {
    Pdf::fake();

    $this->tenant = Tenant::create([
        'name' => 'HabeshaBiz Electronics',
        'slug' => 'habeshabiz',
        'currency_code' => 'ETB',
        'settings' => [],
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Owner Person',
        'email' => 'owner@habeshabiz.et',
        'password' => Hash::make('password123'),
        'role' => 'owner',
    ]);

    $this->cashier = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Cashier Person',
        'email' => 'cashier@habeshabiz.et',
        'password' => Hash::make('password123'),
        'role' => 'cashier',
    ]);
});

test('owner can upload, update, and delete default signature and stamp', function () {
    // 1. Upload signature
    $sigDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    $res = $this->actingAs($this->owner)->postJson('/api/v1/settings/signature', [
        'signature_data' => $sigDataUri,
    ]);

    $res->assertStatus(200)
        ->assertJson(['success' => true]);

    $this->tenant->refresh();
    expect($this->tenant->settings['default_signature_url'])->toBe($sigDataUri);

    // 2. Upload company stamp
    $stampDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    $res = $this->actingAs($this->owner)->postJson('/api/v1/settings/stamp', [
        'stamp_data' => $stampDataUri,
    ]);

    $res->assertStatus(200)
        ->assertJson(['success' => true]);

    $this->tenant->refresh();
    expect($this->tenant->settings['default_stamp_url'])->toBe($stampDataUri);

    // 3. Update document automation preferences
    $res = $this->actingAs($this->owner)->putJson('/api/v1/settings/signature-stamp-preferences', [
        'preferences' => [
            'auto_embed_sales_invoice' => true,
            'auto_embed_proforma' => true,
            'auto_embed_vendor_statement' => false,
            'default_signature_size' => ['width' => 25, 'height' => 12],
            'default_stamp_size' => ['width' => 28, 'height' => 20],
        ],
    ]);

    $res->assertStatus(200)
        ->assertJson(['success' => true]);

    $this->tenant->refresh();
    expect($this->tenant->settings['signature_stamp_preferences']['auto_embed_vendor_statement'])->toBeFalse();
    expect($this->tenant->settings['signature_stamp_preferences']['default_stamp_size']['width'])->toBe(28);

    // 4. Delete signature and stamp
    $this->actingAs($this->owner)->deleteJson('/api/v1/settings/signature')->assertStatus(200);
    $this->actingAs($this->owner)->deleteJson('/api/v1/settings/stamp')->assertStatus(200);

    $this->tenant->refresh();
    expect($this->tenant->settings['default_signature_url'])->toBeNull();
    expect($this->tenant->settings['default_stamp_url'])->toBeNull();
});

test('non-owner cannot modify signature and stamp settings', function () {
    $this->actingAs($this->cashier)->postJson('/api/v1/settings/signature', [
        'signature_data' => 'data:image/png;base64,123',
    ])->assertStatus(403);

    $this->actingAs($this->cashier)->deleteJson('/api/v1/settings/signature')->assertStatus(403);
    $this->actingAs($this->cashier)->postJson('/api/v1/settings/stamp', [
        'stamp_data' => 'data:image/png;base64,123',
    ])->assertStatus(403);
    $this->actingAs($this->cashier)->deleteJson('/api/v1/settings/stamp')->assertStatus(403);
});

test('sales invoice can update custom signature stamp placement and generate pdf', function () {
    $this->tenant->update([
        'settings' => [
            'default_signature_url' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'default_stamp_url' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        ],
    ]);

    $account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Main Cash Safe',
        'type' => 'cash',
        'currency' => 'ETB',
        'current_balance' => 100000,
    ]);

    $customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Customer Corp',
        'phone' => '+251911002233',
        'roles' => ['customer'],
    ]);

    $order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-TEST-001',
        'customer_id' => $customer->id,
        'salesperson_id' => $this->owner->id,
        'financial_account_id' => $account->id,
        'total_amount' => 15000,
        'paid_amount' => 15000,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'order_date' => now(),
    ]);

    // Save custom signature and stamp config with resizable coordinates and rotation
    $customConfig = [
        'show_signature' => true,
        'show_stamp' => true,
        'has_custom_placement' => true,
        'signature_position' => ['x' => 30, 'y' => 85, 'width' => 26, 'height' => 12, 'rotation' => 5],
        'stamp_position' => ['x' => 55, 'y' => 60, 'width' => 30, 'height' => 22, 'rotation' => -10],
    ];

    $res = $this->actingAs($this->owner)->postJson("/api/v1/sales/{$order->id}/signature-stamp", [
        'signature_stamp_config' => $customConfig,
    ]);

    $res->assertStatus(200)
        ->assertJson(['success' => true]);

    $order->refresh();
    expect($order->signature_stamp_config['has_custom_placement'])->toBeTrue();
    expect($order->signature_stamp_config['stamp_position']['width'])->toBe(30);

    // Test PDF generation with Spatie Pdf service
    $pdfService = app(PdfGeneratorService::class);
    $builder = $pdfService->generateSalesInvoice($order, false);
    expect($builder)->not->toBeNull();
});

test('vendor statement pdf resolves default signature and stamp when auto embed enabled', function () {
    $this->tenant->update([
        'settings' => [
            'default_signature_url' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'default_stamp_url' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'signature_stamp_preferences' => [
                'auto_embed_vendor_statement' => true,
            ],
        ],
    ]);

    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Supplier Entity',
        'roles' => ['vendor'],
    ]);

    $pdfService = app(PdfGeneratorService::class);
    $builder = $pdfService->generateVendorStatement($vendor, null, null, [], false);
    expect($builder)->not->toBeNull();
});
