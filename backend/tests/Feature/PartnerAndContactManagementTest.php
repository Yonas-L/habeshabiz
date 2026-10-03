<?php

use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
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

test('can safely delete unlinked partner, and soft-delete linked partner preserving data', function () {
    $cleanPartner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Unlinked Partner',
        'roles' => ['peer_vendor'],
        'is_active' => true,
    ]);

    // Delete unlinked partner succeeds (soft-delete)
    $deleteRes = $this->actingAs($this->user, 'sanctum')
        ->deleteJson("/api/v1/contacts/{$cleanPartner->id}");
    $deleteRes->assertOk();
    expect(Contact::find($cleanPartner->id))->toBeNull();
    expect(Contact::withTrashed()->find($cleanPartner->id))->not->toBeNull();

    // Linked partner with a debt — should also succeed via soft-delete
    $linkedPartner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Partner With History',
        'roles' => ['peer_vendor', 'creditor'],
        'is_active' => true,
    ]);

    $debt = Debt::create([
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

    // Now succeeds with HTTP 200 (soft-delete)
    $linkedDeleteRes->assertOk();
    expect($linkedDeleteRes->json('success'))->toBeTrue();

    // Partner no longer visible in normal queries
    expect(Contact::find($linkedPartner->id))->toBeNull();

    // But still exists via withTrashed for audit trail
    $archived = Contact::withTrashed()->find($linkedPartner->id);
    expect($archived)->not->toBeNull();
    expect($archived->deleted_at)->not->toBeNull();
    expect($archived->is_active)->toBeFalse();

    // Debt record preserved and still resolves partner name
    $freshDebt = $debt->fresh();
    expect($freshDebt)->not->toBeNull();
    expect($freshDebt->contact->name)->toBe('Partner With History');
});

test('enforces unique phone number per tenant for active contacts', function () {
    Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Existing Customer',
        'phone' => '+251911998877',
        'roles' => ['customer'],
        'is_active' => true,
    ]);

    // Attempting to create another contact with same phone should fail validation
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/v1/contacts', [
            'name' => 'Duplicate Customer',
            'phone' => '+251911998877',
            'roles' => ['customer'],
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['phone']);
});

test('allows re-using phone number if previous contact was soft deleted', function () {
    $contact = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Old Contact',
        'phone' => '+251911002233',
        'roles' => ['customer'],
        'is_active' => true,
    ]);

    $contact->delete(); // Soft delete

    // Now creating a new contact with same phone should succeed
    $response = $this->actingAs($this->user, 'sanctum')
        ->postJson('/api/v1/contacts', [
            'name' => 'New Contact Reusing Phone',
            'phone' => '+251911002233',
            'roles' => ['customer'],
        ]);

    $response->assertStatus(201);
});

test('can retrieve partner statement and running ledger', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husni Tech',
        'phone' => '+251911889900',
        'roles' => ['peer_vendor', 'supplier'],
    ]);

    // Create a payable debt (we owe vendor 100,000 for consignment)
    $payableDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'payable',
        'reference_type' => 'consignment_sale',
        'original_amount' => 100000,
        'remaining_amount' => 100000,
        'status' => 'open',
        'notes' => 'Consignment payout for laptop',
    ]);

    // Create a credit sale debt (vendor bought a phone from us on credit: 45,000)
    $receivableDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'receivable',
        'reference_type' => 'sales_order',
        'original_amount' => 45000,
        'remaining_amount' => 45000,
        'status' => 'open',
        'notes' => 'Credit sale for S7 FE',
    ]);

    // Make a 30,000 payment towards what we owe them
    \App\Models\DebtPayment::create([
        'tenant_id' => $this->tenant->id,
        'debt_id' => $payableDebt->id,
        'financial_account_id' => $this->cbe->id,
        'amount' => 30000,
        'payment_date' => now(),
    ]);

    $response = $this->actingAs($this->user, 'sanctum')
        ->getJson("/api/v1/contacts/{$vendor->id}/statement");

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.contact.name', 'Husni Tech')
        ->assertJsonPath('data.kpis.range_payable_total', 100000)
        ->assertJsonPath('data.kpis.range_receivable_total', 45000)
        ->assertJsonPath('data.kpis.range_paid_to_vendor', 30000);

    // Also verify public endpoint
    $token = $vendor->fresh()->statement_token;
    expect($token)->not->toBeNull();

    $publicRes = $this->getJson("/api/v1/public/statement/{$token}");
    $publicRes->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.contact.name', 'Husni Tech');
});

test('expense wire payout auto-settles vendor debt and updates statement with clean context', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Dagi Broker',
        'phone' => '+251911223344',
        'roles' => ['peer_vendor'],
        'is_active' => true,
    ]);

    // 1) Sourced an iPhone worth 100k -> Payable debt created
    $payableDebt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'payable',
        'reference_type' => 'consignment_sale',
        'original_amount' => 100000,
        'remaining_amount' => 100000,
        'status' => 'open',
        'notes' => 'iPhone 13 Pro (SN: 237485960782423)',
    ]);

    // 2) Recorded a wire transfer expense to Dagi for 80,000 ETB via Expense modal
    $expenseRes = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->cbe->id,
        'category' => 'vendor_payout',
        'vendor_contact_id' => $vendor->id,
        'amount' => 80000,
        'description' => 'Wire payout to Dagi Broker via Awash Bank',
    ]);
    $expenseRes->assertStatus(201);

    // Verify open payable is reduced to 20,000 ETB
    $payableDebt->refresh();
    expect((float) $payableDebt->remaining_amount)->toBe(20000.0);
    expect($payableDebt->status)->toBe('partially_paid');

    // 3) Handed over a device worth 60,000 ETB to Dagi
    Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'receivable',
        'reference_type' => 'handover_holding',
        'original_amount' => 60000,
        'remaining_amount' => 60000,
        'status' => 'open',
        'notes' => 'Handover payout for 99887766 to Dagi Broker',
    ]);

    // 4) Check statement
    $statementRes = $this->actingAs($this->user, 'sanctum')
        ->getJson("/api/v1/contacts/{$vendor->id}/statement");

    $statementRes->assertStatus(200);
    $data = $statementRes->json('data');

    // Net balance: -100k (consignment) + 80k (wire payout) + 60k (handover) = +40k (Dagi owes us 40k!)
    expect((float) $data['kpis']['range_closing_balance'])->toBe(40000.0);

    // Verify context strings do not contain Order #
    foreach ($data['ledger'] as $row) {
        expect($row['context'])->not->toContain('Order #');
        expect($row['type_label'])->toBeIn([
            'Balance Forward',
            'Consignment Sale',
            'Item Received',
            'Sales Credit',
            'Device Handover',
            'Payment Sent',
            'Payment Received',
            'Repair Payment',
            'Repair Deduction',
            'Repair Claim',
            'Payout Advance',
            'Payable',
            'Receivable',
        ]);
    }
});

test('vendor product intake starts payable at -100k while in stock, selling does not duplicate debt, and wire/handover/returns adjust dynamically', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Dagi TikTok',
        'phone' => '+251911223399',
        'roles' => ['peer_vendor', 'supplier'],
        'is_active' => true,
    ]);

    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 13 Pro',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'storage' => '128GB',
        'color' => 'Sierra Blue',
        'default_selling_price' => 120000.00,
    ]);

    // 1. Intake vendor consignment device (100,000 ETB agreed cost)
    $intakeRes = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $variant->id,
        'imei_or_serial' => '237485960782423',
        'condition' => 'inspection needed',
        'cost_basis' => 100000.00,
        'selling_price' => 120000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $vendor->id,
    ]);
    $intakeRes->assertStatus(201);
    $unitId = $intakeRes->json('data.id');

    // Verify payable debt was immediately created upon stock intake
    $intakeDebt = Debt::where('contact_id', $vendor->id)
        ->where('reference_type', 'stock_intake')
        ->where('reference_id', $unitId)
        ->first();
    expect($intakeDebt)->not->toBeNull();
    expect((float) $intakeDebt->original_amount)->toBe(100000.0);
    expect((float) $intakeDebt->remaining_amount)->toBe(100000.0);
    expect($intakeDebt->status)->toBe('open');

    // 2. Check vendor statement while unit is still in stock
    $statementRes1 = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$vendor->id}/statement");
    $statementRes1->assertOk();
    // Closing balance must immediately start at -100,000 ETB (we owe vendor 100k)
    expect((float) $statementRes1->json('data.kpis.range_closing_balance'))->toBe(-100000.0);
    expect($statementRes1->json('data.ledger.0.type_label'))->toBe('Item Received');
    expect((float) $statementRes1->json('data.ledger.0.payable'))->toBe(100000.0);

    // 3. Sell the device to an end customer for 120,000 ETB
    $saleRes = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/sales', [
        'payment_method' => 'bank_transfer',
        'financial_account_id' => $this->cbe->id,
        'paid_amount' => 120000.00,
        'items' => [
            [
                'variant_id' => $variant->id,
                'inventory_unit_id' => $unitId,
                'quantity' => 1,
                'unit_price' => 120000.00,
                'sourcing_type' => 'internal_stock',
            ],
        ],
    ]);
    $saleRes->assertStatus(201);

    // Verify NO duplicate debt was created on sale
    expect(Debt::where('contact_id', $vendor->id)->count())->toBe(1);

    // Statement balance should remain -100,000 ETB (not doubled to -200k!)
    $statementRes2 = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$vendor->id}/statement");
    $statementRes2->assertOk();
    expect((float) $statementRes2->json('data.kpis.range_closing_balance'))->toBe(-100000.0);

    // 4. Send wire payout of 80,000 ETB to Dagi via Expense modal
    $wireRes = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->cbe->id,
        'category' => 'vendor_payout',
        'vendor_contact_id' => $vendor->id,
        'amount' => 80000.00,
        'description' => 'Wire payout to Dagi for 13 Pro',
    ]);
    $wireRes->assertStatus(201);

    // Intake debt is partially paid (20,000 remaining)
    $intakeDebt->refresh();
    expect((float) $intakeDebt->remaining_amount)->toBe(20000.0);

    // Statement balance is now -20,000 ETB
    $statementRes3 = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$vendor->id}/statement");
    $statementRes3->assertOk();
    expect((float) $statementRes3->json('data.kpis.range_closing_balance'))->toBe(-20000.0);

    // 5. Hand over a shelf unit worth 60,000 ETB to Dagi to sell
    Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $vendor->id,
        'type' => 'receivable',
        'reference_type' => 'handover_holding',
        'original_amount' => 60000.00,
        'remaining_amount' => 60000.00,
        'status' => 'open',
        'notes' => 'Handover payout for 11 Pro Max to Dagi TikTok',
    ]);

    // Statement balance flips to +40,000 ETB (Dagi owes us 40,000 ETB)
    $statementRes4 = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$vendor->id}/statement");
    $statementRes4->assertOk();
    expect((float) $statementRes4->json('data.kpis.range_closing_balance'))->toBe(40000.0);

    // 6. Intake a 2nd unit worth 50,000 ETB from Dagi
    $intakeRes2 = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $variant->id,
        'imei_or_serial' => '888777666555444',
        'condition' => 'new',
        'cost_basis' => 50000.00,
        'selling_price' => 65000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $vendor->id,
    ]);
    $intakeRes2->assertStatus(201);
    $unit2Id = $intakeRes2->json('data.id');

    // Balance drops: +40k - 50k = -10,000 ETB
    $statementRes5 = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$vendor->id}/statement");
    $statementRes5->assertOk();
    expect((float) $statementRes5->json('data.kpis.range_closing_balance'))->toBe(-10000.0);

    // 7. Return the 2nd unsold unit back to Dagi
    $returnRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unit2Id}/return-to-vendor", [
        'return_reason' => 'Unsold, returned to Dagi',
    ]);
    $returnRes->assertOk();

    // Intake debt for 2nd unit is settled with RETURN-TO-VENDOR
    $unit2Debt = Debt::where('reference_type', 'stock_intake')->where('reference_id', $unit2Id)->first();
    expect($unit2Debt->status)->toBe('settled');
    expect((float) $unit2Debt->remaining_amount)->toBe(0.0);

    // Statement balance is restored back to +40,000 ETB!
    $statementRes6 = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$vendor->id}/statement");
    $statementRes6->assertOk();
    expect((float) $statementRes6->json('data.kpis.range_closing_balance'))->toBe(40000.0);
});

test('dashboard summary returns partner_settlements with bilateral netting and contact net_balance attributes', function () {
    $partnerA = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Partner A (Owes Us)',
        'roles' => ['peer_vendor'],
        'is_active' => true,
    ]);

    // Handover to Partner A (Receivable of 50,000 ETB)
    Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $partnerA->id,
        'type' => 'receivable',
        'reference_type' => 'handover_holding',
        'original_amount' => 50000.0,
        'remaining_amount' => 50000.0,
        'status' => 'open',
    ]);

    // Check contact model accessors
    $freshA = $partnerA->fresh();
    expect((float) $freshA->net_balance)->toBe(50000.0);
    expect((float) $freshA->open_receivable)->toBe(50000.0);
    expect((float) $freshA->open_payable)->toBe(0.0);

    // Check Dashboard summary API
    $response = $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/dashboard/summary');
    $response->assertOk();

    $settlements = $response->json('data.partner_settlements');
    expect($settlements)->not->toBeNull();
    expect($settlements['partners_owing_us_count'])->toBeGreaterThanOrEqual(1);
    expect((float) $settlements['total_owed_to_us_net'])->toBeGreaterThanOrEqual(50000.0);

    $matchedPartner = collect($settlements['partners'])->firstWhere('id', $partnerA->id);
    expect($matchedPartner)->not->toBeNull();
    expect((float) $matchedPartner['net_balance'])->toBe(50000.0);
    expect($matchedPartner['verdict'])->toBe('owes_us');
});

test('returning an already-paid vendor unit creates vendor_return_refund receivable and marks partner as owing us', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Refundable Vendor',
        'roles' => ['peer_vendor'],
        'is_active' => true,
    ]);

    $product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'storage' => '128GB',
        'color' => 'Natural Titanium',
        'default_selling_price' => 140000.0,
    ]);

    // 1. Intake unit (120,000 ETB payable created)
    $intakeRes = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/inventory/units', [
        'variant_id' => $variant->id,
        'imei_or_serial' => '998877665544332',
        'condition' => 'new',
        'cost_basis' => 120000.00,
        'source_type' => 'consignment',
        'supplier_contact_id' => $vendor->id,
    ]);
    $intakeRes->assertStatus(201);
    $unitId = $intakeRes->json('data.id');

    $intakeDebt = Debt::where('reference_type', 'stock_intake')->where('reference_id', $unitId)->first();
    expect($intakeDebt)->not->toBeNull();

    // 2. Wire payout sent to vendor for this unit (120,000 ETB paid)
    $payRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/debts/{$intakeDebt->id}/payments", [
        'amount' => 120000.00,
        'financial_account_id' => $this->cbe->id,
        'notes' => 'Wire payout for iPhone 15 Pro',
    ]);
    $payRes->assertOk();

    $intakeDebt->refresh();
    expect($intakeDebt->status)->toBe('settled');
    expect((float) $intakeDebt->remaining_amount)->toBe(0.0);

    // 3. Return the unit to vendor
    $returnRes = $this->actingAs($this->user, 'sanctum')->postJson("/api/v1/inventory/units/{$unitId}/return-to-vendor", [
        'return_reason' => 'Defective screen, returned for cash refund',
    ]);
    $returnRes->assertOk();

    // 4. Verify vendor_return_refund receivable was created
    $refundDebt = Debt::where('reference_type', 'vendor_return_refund')->where('reference_id', $unitId)->first();
    expect($refundDebt)->not->toBeNull();
    expect((float) $refundDebt->remaining_amount)->toBe(120000.0);
    expect($refundDebt->status)->toBe('open');

    // 5. Vendor statement shows Net Balance = +120,000 ETB (Receivable / Partner owes us)
    $statementRes = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$vendor->id}/statement");
    $statementRes->assertOk();
    expect((float) $statementRes->json('data.kpis.current_net_balance'))->toBe(120000.0);
    expect($statementRes->json('data.kpis.balance_verdict'))->toContain('Receivable');
});

test('vendor advance payout via expense is synced across contact, dashboard, and debts', function () {
    $vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Advance Test Vendor',
        'roles' => ['peer_vendor'],
        'is_active' => true,
    ]);

    // Send a 300,000 ETB advance payout via Expense
    $expenseRes = $this->actingAs($this->user, 'sanctum')->postJson('/api/v1/expenses', [
        'category' => 'other',
        'amount' => 300000.00,
        'description' => 'Wire payout to Advance Test Vendor',
        'financial_account_id' => $this->cbe->id,
        'vendor_contact_id' => $vendor->id,
        'is_owner_draw' => false,
        'date' => now()->toDateString(),
    ]);
    $expenseRes->assertStatus(201);

    // Verify contact accessors
    $freshVendor = $vendor->fresh();
    expect((float) $freshVendor->open_receivable)->toBe(300000.0);
    expect((float) $freshVendor->open_payable)->toBe(0.0);
    expect((float) $freshVendor->net_balance)->toBe(300000.0);

    // Verify dashboard summary capital_overview and partner_settlements
    $dashRes = $this->actingAs($this->user, 'sanctum')->getJson('/api/v1/dashboard/summary');
    $dashRes->assertOk();
    expect((float) $dashRes->json('data.capital_overview.receivables'))->toBe(300000.0);

    $settlements = $dashRes->json('data.partner_settlements.partners');
    $matched = collect($settlements)->firstWhere('id', $vendor->id);
    expect($matched)->not->toBeNull();
    expect((float) $matched['open_receivable'])->toBe(300000.0);
    expect((float) $matched['net_balance'])->toBe(300000.0);
    expect($matched['verdict'])->toBe('owes_us');

    // Verify statement KPIs and closing balance
    $statementRes = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$vendor->id}/statement");
    $statementRes->assertOk();
    expect((float) $statementRes->json('data.kpis.current_open_receivable'))->toBe(300000.0);
    expect((float) $statementRes->json('data.kpis.current_net_balance'))->toBe(300000.0);
    expect((float) $statementRes->json('data.kpis.range_closing_balance'))->toBe(300000.0);
});

test('traded in exchange unit does not inflate partner statement or dashboard with phantom payable', function () {
    $partner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Exchange Partner',
        'roles' => ['peer_vendor', 'customer'],
        'is_active' => true,
    ]);

    $product = \App\Models\Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Trade In Phone',
        'category' => 'smartphones',
        'has_serials' => true,
        'is_active' => true,
    ]);
    $variant = \App\Models\ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'storage' => '256GB',
        'color' => 'Black',
        'default_selling_price' => 100000,
    ]);

    $salesOrder = \App\Models\SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-EXCHANGE-TEST',
        'salesperson_id' => $this->user->id,
        'customer_id' => $partner->id,
        'total_amount' => 500000.00,
        'paid_amount' => 100000.00,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'exchange_allowance' => 400000.00,
        'order_date' => now(),
    ]);

    $unit = \App\Models\InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $variant->id,
        'imei_or_serial' => 'EXCHANGE-SN-999',
        'status' => 'sold',
        'cost_basis' => 400000.00,
        'source_type' => 'exchange',
        'supplier_contact_id' => $partner->id,
        'exchange_sales_order_id' => $salesOrder->id,
    ]);

    $statementRes = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$partner->id}/statement");
    $statementRes->assertOk();

    expect((float) $statementRes->json('data.kpis.range_closing_balance'))->toBe(0.0);
    expect((float) $statementRes->json('data.kpis.current_net_balance'))->toBe(0.0);
    expect((float) $statementRes->json('data.kpis.current_open_payable'))->toBe(0.0);
    expect(collect($statementRes->json('data.ledger'))->sum('payable'))->toEqual(0);
});

test('partner statement preserves confidentiality by omitting order ids, presenting clean sold product context, and using Transferred for payouts', function () {
    $partner = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Partner',
        'roles' => ['staff', 'salesperson', 'supplier'],
        'is_active' => true,
    ]);

    $category = \App\Models\Category::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Phones',
        'slug' => 'phones-' . uniqid(),
    ]);

    $product = \App\Models\Product::create([
        'tenant_id' => $this->tenant->id,
        'category_id' => $category->id,
        'name' => 'Samsung S24 Ultra',
        'brand' => 'Samsung',
    ]);

    $variant = \App\Models\ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $product->id,
        'storage' => '256GB',
        'color' => 'Titanium Gray',
        'default_selling_price' => 150000.00,
    ]);

    $order = \App\Models\SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-CONFIDENTIAL-999',
        'total_amount' => 150000.00,
        'paid_amount' => 150000.00,
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'order_date' => now(),
    ]);

    \App\Models\SalesOrderItem::create([
        'tenant_id' => $this->tenant->id,
        'sales_order_id' => $order->id,
        'variant_id' => $variant->id,
        'quantity' => 1,
        'unit_price' => 150000.00,
        'unit_cost' => 130000.00,
        'profit' => 20000.00,
    ]);

    // Create a bonus payable debt with internal order notes
    $debt = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $partner->id,
        'type' => 'payable',
        'reference_type' => 'salesperson_bonus',
        'reference_id' => $order->id,
        'original_amount' => 15000.00,
        'paid_amount' => 15000.00,
        'remaining_amount' => 0.00,
        'due_date' => now()->addDays(7),
        'status' => 'settled',
        'notes' => "Sales bonus for Order #{$order->order_number} by {$partner->name}",
    ]);

    // Settle with a payment sent
    \App\Models\DebtPayment::create([
        'tenant_id' => $this->tenant->id,
        'debt_id' => $debt->id,
        'financial_account_id' => $this->cbe->id,
        'amount' => 15000.00,
        'payment_date' => now(),
        'reference_number' => 'TXN-CONFIDENTIAL-001',
    ]);

    $res = $this->actingAs($this->user, 'sanctum')->getJson("/api/v1/contacts/{$partner->id}/statement");
    $res->assertOk();

    $ledger = $res->json('data.ledger');
    expect(count($ledger))->toBe(2);

    // 1st entry: Bonus / Sale payout
    expect($ledger[0]['context'])->toContain('Sold: Samsung S24 Ultra');
    expect($ledger[0]['context'])->not->toContain('ORD-');
    expect($ledger[0]['context'])->not->toContain('Order #');
    expect($ledger[0]['context'])->not->toContain('by Abebe Partner');
    expect($ledger[0]['reference_number'])->toBeNull();

    // 2nd entry: Payment sent
    expect($ledger[1]['context'])->toContain('Transferred');
    expect($ledger[1]['context'])->not->toContain('Wire payout');
    expect($ledger[1]['context'])->toContain($this->cbe->name);
});






