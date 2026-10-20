<?php

use App\Models\Contact;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProformaInvoice;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Spatie\LaravelPdf\Facades\Pdf;

beforeEach(function () {
    Pdf::fake();

    $this->tenant = Tenant::create([
        'name' => 'Apex Technologies PLC',
        'slug' => 'apex-tech',
        'currency_code' => 'ETB',
        'settings' => [
            'address' => 'Bole Road, Mega Building 4th Floor',
            'city' => 'Addis Ababa',
            'tin_number' => '0098765432',
            'vat_number' => '0098765432-VAT',
            'footer_note' => 'Standard commercial quotation valid for 14 calendar days.',
        ],
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Dawit Owner',
        'email' => 'dawit@apextech.et',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->staff = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Sara Sales',
        'email' => 'sara@apextech.et',
        'password' => Hash::make('secret123'),
        'role' => 'staff',
        'permissions' => ['pos_terminal'],
    ]);

    $this->customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Ethio Telecom Enterprise',
        'phone' => '+251911223344',
        'email' => 'procurement@ethiotelecom.et',
        'address' => 'Churchill Avenue, Addis Ababa',
        'tax_number' => '0001122334',
        'roles' => ['customer'],
    ]);

    $this->bankAccount = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Commercial Bank of Ethiopia',
        'type' => 'bank',
        'account_number' => '1000123456789',
        'currency' => 'ETB',
        'current_balance' => 500000.00,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Dell Latitude 5540',
        'brand' => 'Dell',
        'category' => 'Laptops',
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '512GB SSD',
        'ram' => '16GB',
        'color' => 'Silver',
        'sku' => 'DELL-LAT-5540',
        'default_selling_price' => 75000.00,
    ]);
});

test('can create a proforma invoice with accurate line item and 1.5% withholding tax calculations', function () {
    // Example: 2 units at 10,000 ETB, 0% discount, 15% VAT, 1.5% WHT
    // Subtotal: 20,000 ETB
    // Taxable: 20,000 ETB
    // VAT (15%): 3,000 ETB
    // Gross Total: 23,000 ETB
    // Withholding Tax (1.5% of 20,000): 300 ETB
    // Net Payable: 22,700 ETB
    $payload = [
        'customer_name' => $this->customer->name,
        'customer_id' => $this->customer->id,
        'customer_phone' => $this->customer->phone,
        'customer_email' => $this->customer->email,
        'customer_address' => $this->customer->address,
        'customer_tin' => $this->customer->tax_number,
        'issue_date' => now()->format('Y-m-d'),
        'valid_until' => now()->addDays(14)->format('Y-m-d'),
        'vat_rate' => 15.00,
        'withholding_rate' => 1.50,
        'shipping_fee' => 0,
        'bank_account_id' => $this->bankAccount->id,
        'items' => [
            [
                'product_id' => $this->product->id,
                'variant_id' => $this->variant->id,
                'description' => 'Dell Latitude 5540 (Core i7, 16GB, 512GB SSD)',
                'sku' => 'DELL-LAT-5540',
                'unit_of_measure' => 'Unit',
                'quantity' => 2,
                'unit_price' => 10000.00,
                'discount_type' => 'percentage',
                'discount_rate' => 0,
                'tax_rate' => 15.00,
            ],
        ],
    ];

    $response = $this->actingAs($this->owner)
        ->postJson('/api/v1/proforma-invoices', $payload);

    $response->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.customer_name', 'Ethio Telecom Enterprise')
        ->assertJsonPath('data.subtotal', '20000.00')
        ->assertJsonPath('data.taxable_amount', '20000.00')
        ->assertJsonPath('data.vat_total', '3000.00')
        ->assertJsonPath('data.withholding_rate', '1.50')
        ->assertJsonPath('data.withholding_total', '300.00')
        ->assertJsonPath('data.total_amount', '23000.00')
        ->assertJsonPath('data.net_payable', '22700.00');

    $this->assertDatabaseHas('proforma_invoices', [
        'tenant_id' => $this->tenant->id,
        'customer_name' => 'Ethio Telecom Enterprise',
        'subtotal' => 20000.00,
        'vat_total' => 3000.00,
        'withholding_total' => 300.00,
        'total_amount' => 23000.00,
        'net_payable' => 22700.00,
    ]);

    $this->assertDatabaseHas('proforma_invoice_items', [
        'description' => 'Dell Latitude 5540 (Core i7, 16GB, 512GB SSD)',
        'quantity' => 2,
        'unit_price' => 10000.00,
        'line_total' => 23000.00,
    ]);
});

test('staff member can create and list proforma invoices', function () {
    $payload = [
        'customer_name' => 'Ministry of Innovation & Technology',
        'issue_date' => now()->format('Y-m-d'),
        'items' => [
            [
                'description' => 'Networking Switch 24-Port Gigabit',
                'quantity' => 1,
                'unit_price' => 25000.00,
                'tax_rate' => 15.00,
            ],
        ],
    ];

    $res = $this->actingAs($this->staff)
        ->postJson('/api/v1/proforma-invoices', $payload);

    $res->assertStatus(201);

    $listRes = $this->actingAs($this->staff)
        ->getJson('/api/v1/proforma-invoices');

    $listRes->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonCount(1, 'data');
});

test('can duplicate an existing proforma invoice with new number and draft status', function () {
    $proforma = ProformaInvoice::create([
        'tenant_id' => $this->tenant->id,
        'proforma_number' => 'PI-2026-0001',
        'created_by_user_id' => $this->owner->id,
        'customer_name' => 'Original Customer Corp',
        'issue_date' => '2026-10-01',
        'valid_until' => '2026-10-15',
        'subtotal' => 10000.00,
        'taxable_amount' => 10000.00,
        'vat_rate' => 15.00,
        'vat_total' => 1500.00,
        'total_amount' => 11500.00,
        'net_payable' => 11500.00,
        'status' => 'sent',
    ]);

    $proforma->items()->create([
        'tenant_id' => $this->tenant->id,
        'item_number' => 1,
        'description' => 'Monitors 27-inch 4K',
        'quantity' => 1,
        'unit_price' => 10000.00,
        'tax_rate' => 15.00,
        'taxable_amount' => 10000.00,
        'tax_amount' => 1500.00,
        'line_total' => 11500.00,
    ]);

    $res = $this->actingAs($this->owner)
        ->postJson("/api/v1/proforma-invoices/{$proforma->id}/duplicate");

    $res->assertStatus(201)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.customer_name', 'Original Customer Corp');

    $newNumber = $res->json('data.proforma_number');
    expect($newNumber)->not->toBe('PI-2026-0001');
});

test('can update signature and stamp configuration coordinates', function () {
    $proforma = ProformaInvoice::create([
        'tenant_id' => $this->tenant->id,
        'proforma_number' => 'PI-2026-0002',
        'customer_name' => 'Commercial Bank of Ethiopia',
        'issue_date' => now()->format('Y-m-d'),
        'subtotal' => 5000.00,
        'taxable_amount' => 5000.00,
        'vat_rate' => 15.00,
        'vat_total' => 750.00,
        'total_amount' => 5750.00,
        'net_payable' => 5750.00,
    ]);

    $config = [
        'show_signature' => true,
        'show_stamp' => true,
        'signature_position' => ['x' => 50, 'y' => 600, 'width' => 120, 'height' => 50],
        'stamp_position' => ['x' => 400, 'y' => 600, 'width' => 100, 'height' => 100],
    ];

    $res = $this->actingAs($this->owner)
        ->postJson("/api/v1/proforma-invoices/{$proforma->id}/signature-stamp", [
            'signature_stamp_config' => $config,
        ]);

    $res->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.signature_stamp_config.show_signature', true)
        ->assertJsonPath('data.signature_stamp_config.signature_position.x', 50);
});

test('generates proforma invoice PDF successfully', function () {
    $proforma = ProformaInvoice::create([
        'tenant_id' => $this->tenant->id,
        'proforma_number' => 'PI-2026-0003',
        'customer_name' => 'Ministry of Finance',
        'issue_date' => now()->format('Y-m-d'),
        'subtotal' => 80000.00,
        'taxable_amount' => 80000.00,
        'vat_rate' => 15.00,
        'vat_total' => 12000.00,
        'withholding_rate' => 1.50,
        'withholding_total' => 1200.00,
        'total_amount' => 92000.00,
        'net_payable' => 90800.00,
        'bank_account_id' => $this->bankAccount->id,
    ]);

    $proforma->items()->create([
        'tenant_id' => $this->tenant->id,
        'item_number' => 1,
        'description' => 'Server Rack 42U & UPS',
        'quantity' => 1,
        'unit_price' => 80000.00,
        'tax_rate' => 15.00,
        'taxable_amount' => 80000.00,
        'tax_amount' => 12000.00,
        'line_total' => 92000.00,
    ]);

    $res = $this->actingAs($this->owner)
        ->get("/api/v1/proforma-invoices/{$proforma->id}/pdf");

    $res->assertSuccessful();
    Pdf::assertRespondedWithPdf(function (\Spatie\LaravelPdf\PdfBuilder $pdf) {
        return $pdf->viewName === 'pdf.proforma-invoice'
            && $pdf->viewData['proforma']->proforma_number === 'PI-2026-0003';
    });
});

test('multi-tenant isolation prevents accessing another tenants proforma invoice', function () {
    $otherTenant = Tenant::create([
        'name' => 'Other Competitor Corp',
        'slug' => 'other-competitor',
    ]);

    $otherUser = User::create([
        'tenant_id' => $otherTenant->id,
        'name' => 'Other Owner',
        'email' => 'other@competitor.et',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $myProforma = ProformaInvoice::create([
        'tenant_id' => $this->tenant->id,
        'proforma_number' => 'PI-2026-0004',
        'customer_name' => 'Private Client',
        'issue_date' => now()->format('Y-m-d'),
        'subtotal' => 1000.00,
        'taxable_amount' => 1000.00,
        'vat_total' => 150.00,
        'total_amount' => 1150.00,
        'net_payable' => 1150.00,
    ]);

    TenantScope::setForcedTenantId($otherTenant->id);

    $res = $this->actingAs($otherUser)
        ->getJson("/api/v1/proforma-invoices/{$myProforma->id}");

    $res->assertStatus(404);
});
