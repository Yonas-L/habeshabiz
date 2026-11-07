<?php

use App\Models\Contact;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;
use Spatie\LaravelPdf\Facades\Pdf;
use Spatie\LaravelPdf\PdfBuilder;

beforeEach(function () {
    Pdf::fake();

    $this->tenant = Tenant::create([
        'name' => 'Test Electronics',
        'slug' => 'test-electronics',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->user = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Store Owner',
        'email' => 'owner.test@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yenus Telecom',
        'roles' => ['vendor', 'supplier'],
        'statement_token' => 'test-statement-token-12345',
    ]);
});

afterEach(function () {
    TenantScope::setForcedTenantId(null);
});

test('authenticated user can generate and download vendor statement pdf', function () {
    $response = $this->actingAs($this->user)
        ->get("/api/v1/contacts/{$this->contact->id}/statement/pdf");

    $response->assertOk();

    Pdf::assertRespondedWithPdf(function (PdfBuilder $pdf) {
        return $pdf->viewName === 'pdf.vendor-statement'
            && $pdf->viewData['contact']['name'] === 'Yenus Telecom'
            && stripos($pdf->downloadName, 'yenus_telecom') !== false;
    });
});

test('public link allows anonymous vendors to download their statement pdf', function () {
    $response = $this->get("/api/v1/public/statement/{$this->contact->statement_token}/pdf");

    $response->assertOk();

    Pdf::assertRespondedWithPdf(function (PdfBuilder $pdf) {
        return $pdf->viewName === 'pdf.vendor-statement'
            && $pdf->viewData['contact']['name'] === 'Yenus Telecom';
    });
});

test('store owner can update statement overrides and public endpoint reflects them', function () {
    $patchResponse = $this->actingAs($this->user)
        ->patchJson("/api/v1/contacts/{$this->contact->id}/statement-overrides", [
            'row_id' => 'row-test-123',
            'description' => 'Brand New Custom Description',
        ]);

    $patchResponse->assertOk()
        ->assertJson([
            'success' => true,
            'statement_overrides' => [
                'row-test-123' => 'Brand New Custom Description',
            ],
        ]);

    $this->contact->refresh();
    expect($this->contact->statement_overrides)->toBe(['row-test-123' => 'Brand New Custom Description']);

    // Public statement JSON should include custom overrides
    $publicResponse = $this->getJson("/api/v1/public/statement/{$this->contact->statement_token}");
    $publicResponse->assertOk();
    $data = $publicResponse->json('data');
    expect($data['contact']['statement_overrides'])->toBe(['row-test-123' => 'Brand New Custom Description']);
});
