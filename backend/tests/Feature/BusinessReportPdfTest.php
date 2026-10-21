<?php

use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;
use Spatie\LaravelPdf\Facades\Pdf;

beforeEach(function () {
    Pdf::fake();

    $this->tenant = Tenant::create([
        'name' => 'Apex Electronics',
        'slug' => 'apex-electronics',
        'settings' => [
            'address' => 'Bole Road',
            'city' => 'Addis Ababa',
            'tin_number' => '1122334455',
            'footer_note' => 'Certified accounting and performance audit.',
        ],
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Store Owner',
        'email' => 'owner.report@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->staff = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Floor Staff',
        'email' => 'staff.report@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'staff',
    ]);
});

afterEach(function () {
    TenantScope::setForcedTenantId(null);
});

test('only business owners can download the business report pdf', function () {
    $this->actingAs($this->staff)
        ->getJson('/api/v1/reports/pdf')
        ->assertStatus(403);
});

test('owners can download the business report pdf', function () {
    $response = $this->actingAs($this->owner)
        ->get('/api/v1/reports/pdf?from=2026-10-01&to=2026-10-20');

    $response->assertStatus(200);

    Pdf::assertRespondedWithPdf(function ($pdf) {
        return $pdf->viewName === 'pdf.financial-report';
    });
});

test('owners can download individual section report pdfs', function () {
    $sections = [
        'Sales_and_Revenue',
        'Accessory_Bundle_Comparison',
        'Inventory_and_Stock_Valuation',
        'Staff_Sales',
        'Vendor_Consignment',
        'Repair_and_Maintenance',
        'Accounts_and_Liquidity',
        'Financial_Position',
        'Balance_Reconciliation',
    ];

    foreach ($sections as $section) {
        $response = $this->actingAs($this->owner)
            ->get("/api/v1/reports/pdf?from=2026-10-01&to=2026-10-20&section={$section}");

        $response->assertStatus(200);

        Pdf::assertRespondedWithPdf(function ($pdf) {
            return $pdf->viewName === 'pdf.financial-report';
        });
    }
});
