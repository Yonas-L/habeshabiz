<?php

use App\Models\Contact;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\Hash;
use Spatie\LaravelPdf\Facades\Pdf;
use Spatie\LaravelPdf\PdfBuilder;

beforeEach(function () {
    Pdf::fake();

    $this->tenant = Tenant::create([
        'name' => 'Arada Electronics',
        'slug' => 'arada-electronics',
        'settings' => [
            'address' => 'Bole Medhanialem',
            'city' => 'Addis Ababa',
            'tin_number' => '0012345678',
            'footer_note' => '7-day testing warranty valid with receipt.',
        ],
    ]);

    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Store Owner',
        'email' => 'owner.pos@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'owner',
    ]);

    $this->salesperson = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Sales Attendant',
        'email' => 'attendant@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'staff',
        'permissions' => ['pos_terminal'],
    ]);

    $this->otherSalesperson = User::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Other Attendant',
        'email' => 'other.attendant@example.com',
        'password' => Hash::make('secret123'),
        'role' => 'staff',
        'permissions' => ['pos_terminal'],
    ]);

    $this->customer = Contact::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Abebe Kebede',
        'phone' => '+251911000000',
        'roles' => ['customer'],
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 15 Pro Max',
        'category' => 'phone',
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Natural Titanium',
        'selling_price' => 150000,
    ]);

    $this->order = SalesOrder::create([
        'tenant_id' => $this->tenant->id,
        'order_number' => 'ORD-TEST-001',
        'customer_id' => $this->customer->id,
        'salesperson_id' => $this->salesperson->id,
        'total_amount' => 150000,
        'discount_amount' => 5000,
        'paid_amount' => 145000,
        'payment_status' => 'paid',
        'payment_method' => 'telebirr',
        'order_date' => now(),
        'notes' => 'Customer test order | Verified IMEI handover',
    ]);

    SalesOrderItem::create([
        'sales_order_id' => $this->order->id,
        'variant_id' => $this->variant->id,
        'quantity' => 1,
        'unit_price' => 150000,
        'unit_cost' => 130000,
        'profit' => 20000,
        'sourcing_type' => 'in_stock',
    ]);
});

afterEach(function () {
    TenantScope::setForcedTenantId(null);
});

test('owner can download sales order invoice pdf', function () {
    $response = $this->actingAs($this->owner)
        ->get("/api/v1/sales/{$this->order->id}/invoice/pdf");

    $response->assertOk();

    Pdf::assertRespondedWithPdf(function (PdfBuilder $pdf) {
        return $pdf->viewName === 'pdf.sales-invoice'
            && $pdf->viewData['order']->order_number === 'ORD-TEST-001'
            && $pdf->viewData['netPayable'] == 145000
            && $pdf->downloadName === 'Invoice_ORD-TEST-001.pdf';
    });
});

test('assigned salesperson can download their sales order invoice pdf', function () {
    $response = $this->actingAs($this->salesperson)
        ->get("/api/v1/sales/{$this->order->id}/invoice/pdf");

    $response->assertOk();

    Pdf::assertRespondedWithPdf(function (PdfBuilder $pdf) {
        return $pdf->viewName === 'pdf.sales-invoice'
            && $pdf->viewData['order']->order_number === 'ORD-TEST-001';
    });
});

test('unauthorized salesperson cannot download another salesperson order invoice pdf', function () {
    $response = $this->actingAs($this->otherSalesperson)
        ->get("/api/v1/sales/{$this->order->id}/invoice/pdf");

    $response->assertStatus(403);
});

test('unauthenticated request is rejected with 401', function () {
    $response = $this->getJson("/api/v1/sales/{$this->order->id}/invoice/pdf");

    $response->assertStatus(401);
});
