<?php

use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->tenant = Tenant::create([
        'name' => 'Bole Defect Billing Test Shop',
        'slug' => 'bole-defect-billing-test',
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Husni Owner',
        'email' => 'husni_billing_test@example.com',
        'password' => Hash::make('password'),
        'role' => 'owner',
    ]);

    $this->actingAs($this->owner);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Telebirr Main',
        'type' => 'mobile_money',
        'currency' => 'ETB',
        'current_balance' => 100000.00,
    ]);

    $this->vendor = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Yenus (Supplier Partner)',
        'phone' => '+251911998877',
        'roles' => ['supplier', 'vendor'],
        'is_active' => true,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 14 Pro',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '128GB',
        'color' => 'Deep Purple',
        'default_selling_price' => 100000.00,
    ]);

    $this->unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-DEFECT-12345',
        'cost_basis' => 70000.00,
        'status' => 'returned',
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->vendor->id,
        'condition' => 'used',
        'return_reason' => 'Battery health drops too fast',
    ]);
});

test('recording vendor-deductible repair expense reduces vendor open payable debt', function () {
    // Open payable: shop owes Yenus 50,000 ETB for phones
    $payable = Debt::create([
        'tenant_id' => $this->tenant->id,
        'contact_id' => $this->vendor->id,
        'type' => 'payable',
        'reference_type' => 'consignment_stock',
        'original_amount' => 50000.00,
        'paid_amount' => 0.00,
        'remaining_amount' => 50000.00,
        'status' => 'open',
        'notes' => 'Consignment stock payable',
    ]);

    // Record 2,000 ETB repair expense paid from Telebirr, billed to Vendor
    $response = $this->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->account->id,
        'inventory_unit_id' => $this->unit->id,
        'category' => 'maintenance',
        'amount' => 2000.00,
        'vendor_billing' => 'vendor_deduct',
        'description' => 'Battery replacement by technician for defective unit',
    ]);

    $response->assertStatus(201);

    // 1. Account balance decremented: 100,000 - 2,000 = 98,000 ETB
    expect((float) $this->account->fresh()->current_balance)->toBe(98000.00);

    // 2. Vendor payable debt reduced: 50,000 - 2,000 = 48,000 ETB
    $freshPayable = $payable->fresh();
    expect((float) $freshPayable->paid_amount)->toBe(2000.00);
    expect((float) $freshPayable->remaining_amount)->toBe(48000.00);
    expect($freshPayable->notes)->toContain('Deducted 2000 ETB repair cost');

    // 2b. Now shop pays the remaining 48,000 ETB to the vendor -> debt must be 100% settled!
    $settleRes = $this->postJson("/api/v1/debts/{$payable->id}/payments", [
        'amount' => 48000.00,
        'financial_account_id' => $this->account->id,
    ]);
    $settleRes->assertOk();
    expect($payable->fresh()->status)->toBe('settled');
    expect((float) $payable->fresh()->remaining_amount)->toBe(0.00);
    expect((float) $payable->fresh()->paid_amount)->toBe(50000.00);

    // 3. Maintenance record is marked is_capitalized = true so restock keeps original cost
    $record = $this->unit->maintenanceRecords()->first();
    expect($record)->not->toBeNull();
    expect($record->billing_type)->toBe('vendor_deduct');
    expect($record->is_capitalized)->toBeTrue();

    // 4. Unit restock keeps 70,000 ETB cost basis (vendor covered the 2,000 fix)
    $restockRes = $this->postJson("/api/v1/inventory/units/{$this->unit->id}/repaired-restock", [
        'condition' => 'refurbished',
    ]);
    $restockRes->assertOk();
    expect((float) $this->unit->fresh()->cost_basis)->toBe(70000.00);
});

test('recording vendor_reimburse creates a receivable claim from the vendor', function () {
    $response = $this->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->account->id,
        'inventory_unit_id' => $this->unit->id,
        'category' => 'maintenance',
        'amount' => 5000.00,
        'vendor_billing' => 'vendor_reimburse',
        'description' => 'Camera repair vendor will wire back',
    ]);
    $response->assertStatus(201);

    $receivable = Debt::where('contact_id', $this->vendor->id)
        ->where('type', 'receivable')
        ->where('reference_type', 'vendor_repair_reimbursement')
        ->first();

    expect($receivable)->not->toBeNull();
    expect((float) $receivable->original_amount)->toBe(5000.00);
    expect((float) $receivable->remaining_amount)->toBe(5000.00);
});

test('recording vendor-deductible repair creates vendor receivable claim when no open payable exists', function () {
    // No open payable exists. Record 3,000 ETB repair expense billed to Vendor
    $response = $this->postJson('/api/v1/expenses', [
        'financial_account_id' => $this->account->id,
        'inventory_unit_id' => $this->unit->id,
        'category' => 'maintenance',
        'amount' => 3000.00,
        'vendor_billing' => 'vendor_deduct',
        'description' => 'Screen replacement for vendor defective unit',
    ]);

    $response->assertStatus(201);

    // 1. A new receivable from Yenus is created for 3,000 ETB
    $receivable = Debt::where('contact_id', $this->vendor->id)
        ->where('type', 'receivable')
        ->first();

    expect($receivable)->not->toBeNull();
    expect((float) $receivable->remaining_amount)->toBe(3000.00);
    expect($receivable->reference_type)->toBe('vendor_repair_reimbursement');
});

test('customer return supports direct return to vendor destination', function () {
    $soldUnit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => 'IMEI-SOLD-999',
        'cost_basis' => 70000.00,
        'status' => 'sold',
        'source_type' => 'consignment',
        'supplier_contact_id' => $this->vendor->id,
    ]);

    $response = $this->postJson("/api/v1/inventory/units/{$soldUnit->id}/customer-return", [
        'return_reason' => 'Defective motherboard, returning to supplier',
        'destination' => 'vendor',
    ]);

    $response->assertOk();
    expect($soldUnit->fresh()->status)->toBe('returned_to_vendor');
});
