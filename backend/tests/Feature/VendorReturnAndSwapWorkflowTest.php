<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\Category;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorReturnAndSwapWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $owner;
    private ProductVariant $variant;
    private Contact $supplier;
    private Contact $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create(['name' => 'HabeshaBiz Electronics', 'slug' => 'habeshabiz']);
        \App\Scopes\TenantScope::setForcedTenantId($this->tenant->id);
        $this->owner = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'role' => 'owner',
        ]);

        $category = Category::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Smartphones',
            'slug' => 'smartphones',
        ]);

        $product = Product::create([
            'tenant_id' => $this->tenant->id,
            'category_id' => $category->id,
            'name' => 'iPhone 13 Pro',
            'has_serials' => true,
        ]);

        $this->variant = ProductVariant::create([
            'tenant_id' => $this->tenant->id,
            'product_id' => $product->id,
            'storage' => '128GB',
            'color' => 'Graphite',
            'sku' => 'IP13P-128-GRP',
            'default_selling_price' => 70000,
        ]);

        $this->supplier = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Abdi Phone Supplier',
            'phone' => '+251911002233',
            'roles' => ['supplier'],
        ]);

        $this->customer = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Solomon Customer',
            'phone' => '+251911998877',
            'roles' => ['customer'],
        ]);
    }

    public function test_customer_return_with_vendor_destination_and_customer_waiting(): void
    {
        $unit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '351111222333444',
            'cost_basis' => 50000,
            'status' => 'sold',
            'location' => 'With Customer',
            'source_type' => 'consignment',
            'supplier_contact_id' => $this->supplier->id,
            'condition' => 'new',
            'sim_type' => 'physical',
        ]);

        $order = SalesOrder::create([
            'tenant_id' => $this->tenant->id,
            'order_number' => 'ORD-TEST101',
            'customer_id' => $this->customer->id,
            'salesperson_id' => $this->owner->id,
            'total_amount' => 70000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'order_date' => now(),
        ]);

        SalesOrderItem::create([
            'tenant_id' => $this->tenant->id,
            'sales_order_id' => $order->id,
            'variant_id' => $this->variant->id,
            'inventory_unit_id' => $unit->id,
            'quantity' => 1,
            'unit_price' => 70000,
            'unit_cost' => 50000,
            'profit' => 20000,
            'sourcing_type' => 'internal_stock',
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/customer-return", [
                'return_reason' => 'Battery draining very fast',
                'destination' => 'vendor',
                'customer_waiting' => true,
                'condition' => 'defective',
            ]);

        $response->assertOk();
        $unit->refresh();
        $this->assertEquals('returned_to_vendor', $unit->status);
        $this->assertTrue($unit->customer_waiting);
        $this->assertNotNull($unit->customer_waiting_at);
        $this->assertEquals('Returned to Vendor/Supplier', $unit->location);
    }

    public function test_receive_fixed_from_vendor_delivers_to_waiting_customer(): void
    {
        $unit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '352222333444555',
            'cost_basis' => 50000,
            'status' => 'returned_to_vendor',
            'customer_waiting' => true,
            'customer_waiting_at' => now()->subDays(2),
            'location' => 'Returned to Vendor/Supplier',
            'source_type' => 'consignment',
            'supplier_contact_id' => $this->supplier->id,
            'condition' => 'defective',
            'sim_type' => 'physical',
        ]);

        $order = SalesOrder::create([
            'tenant_id' => $this->tenant->id,
            'order_number' => 'ORD-TEST102',
            'customer_id' => $this->customer->id,
            'salesperson_id' => $this->owner->id,
            'total_amount' => 70000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'order_date' => now(),
        ]);

        SalesOrderItem::create([
            'tenant_id' => $this->tenant->id,
            'sales_order_id' => $order->id,
            'variant_id' => $this->variant->id,
            'inventory_unit_id' => $unit->id,
            'quantity' => 1,
            'unit_price' => 70000,
            'unit_cost' => 50000,
            'profit' => 20000,
            'sourcing_type' => 'internal_stock',
        ]);

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/receive-from-vendor", [
                'action' => 'deliver_to_customer',
                'condition' => 'refurbished',
                'battery_health' => 100,
                'notes' => 'Battery replaced by vendor under warranty',
            ]);

        $response->assertOk();
        $unit->refresh();
        $this->assertEquals('sold', $unit->status);
        $this->assertEquals('With Customer', $unit->location);
        $this->assertFalse($unit->customer_waiting);
        $this->assertTrue($unit->is_repaired);
        $this->assertEquals(100, $unit->battery_health);

        $order->refresh();
        $this->assertStringContainsString('Vendor Return', $order->notes);
    }

    public function test_vendor_swap_with_new_imei_transfers_waiting_customer_sales_order(): void
    {
        $oldUnit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '353333444555666',
            'cost_basis' => 50000,
            'status' => 'returned_to_vendor',
            'customer_waiting' => true,
            'customer_waiting_at' => now()->subDays(3),
            'location' => 'Returned to Vendor/Supplier',
            'source_type' => 'consignment',
            'supplier_contact_id' => $this->supplier->id,
            'condition' => 'defective',
            'sim_type' => 'physical',
        ]);

        $order = SalesOrder::create([
            'tenant_id' => $this->tenant->id,
            'order_number' => 'ORD-TEST103',
            'customer_id' => $this->customer->id,
            'salesperson_id' => $this->owner->id,
            'total_amount' => 70000,
            'payment_method' => 'cash',
            'payment_status' => 'paid',
            'order_date' => now(),
        ]);

        $orderItem = SalesOrderItem::create([
            'tenant_id' => $this->tenant->id,
            'sales_order_id' => $order->id,
            'variant_id' => $this->variant->id,
            'inventory_unit_id' => $oldUnit->id,
            'quantity' => 1,
            'unit_price' => 70000,
            'unit_cost' => 50000,
            'profit' => 20000,
            'sourcing_type' => 'internal_stock',
        ]);

        $newImei = '359999888777666';

        $response = $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$oldUnit->id}/vendor-swap", [
                'replacement_imei' => $newImei,
                'action' => 'deliver_to_customer',
                'condition' => 'new',
                'battery_health' => 100,
                'notes' => 'Vendor provided brand new replacement unit',
            ]);

        $response->assertOk();

        // Check new unit created
        $replacement = InventoryUnit::where('imei_or_serial', $newImei)->first();
        $this->assertNotNull($replacement);
        $this->assertEquals('sold', $replacement->status);
        $this->assertEquals('With Customer', $replacement->location);
        $this->assertEquals(50000, (float) $replacement->cost_basis);
        $this->assertEquals($oldUnit->id, $replacement->swapped_from_unit_id);
        $this->assertTrue($replacement->is_swapped);

        // Check sales order item now points to the new unit!
        $orderItem->refresh();
        $this->assertEquals($replacement->id, $orderItem->inventory_unit_id);

        // Check old unit is closed and not customer waiting
        $oldUnit->refresh();
        $this->assertFalse($oldUnit->customer_waiting);
        $this->assertEquals($replacement->id, $oldUnit->swapped_replacement_unit_id);

        // Check sales order notes updated
        $order->refresh();
        $this->assertStringContainsString($newImei, $order->notes);
    }
}
