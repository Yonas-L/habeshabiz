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
use App\Models\Debt;
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

    public function test_b2b_cross_vendor_return_and_repaired_redelivery_lifecycle(): void
    {
        // 1. Create Vendor B (Yenus - original supplier) and Vendor A (Nati - B2B partner)
        $vendorB = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Yenus Supplier',
            'phone' => '+251911445566',
            'roles' => ['peer_vendor', 'supplier'],
        ]);

        $vendorA = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Nati Peer',
            'phone' => '+251911778899',
            'roles' => ['peer_vendor'],
        ]);

        // 2. Intake device from Vendor B (cost 45,000 ETB)
        $intakeRes = $this->actingAs($this->owner)
            ->postJson('/api/v1/inventory/units', [
                'variant_id' => $this->variant->id,
                'imei_or_serial' => 'SN-B2B-CROSS-999',
                'condition' => 'new',
                'cost_basis' => 45000.00,
                'selling_price' => 50000.00,
                'source_type' => 'consignment',
                'supplier_contact_id' => $vendorB->id,
            ]);
        $intakeRes->assertCreated();
        $unitId = $intakeRes->json('data.id');

        // Check Vendor B's intake payable debt
        $debtB = \App\Models\Debt::where('contact_id', $vendorB->id)->where('reference_type', 'stock_intake')->first();
        $this->assertNotNull($debtB);
        $this->assertEquals(45000.00, (float) $debtB->remaining_amount);

        // 3. We owe Vendor A 100,000 ETB
        $debtA = \App\Models\Debt::create([
            'tenant_id' => $this->tenant->id,
            'contact_id' => $vendorA->id,
            'type' => 'payable',
            'reference_type' => 'manual_payable',
            'original_amount' => 100000.00,
            'paid_amount' => 0.00,
            'remaining_amount' => 100000.00,
            'status' => 'open',
            'notes' => 'Owed to Nati for previous stock intake',
        ]);

        // 4. Give the unit to Vendor A (handover with offset at 50,000 ETB)
        $handoverRes = $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unitId}/handover", [
                'handover_to' => $vendorA->name,
                'handover_payout' => 50000.00,
                'instant_offset' => true,
            ]);
        $handoverRes->assertOk();

        // Debt to Vendor A is now reduced to 50,000 ETB
        $debtA->refresh();
        $this->assertEquals(50000.00, (float) $debtA->remaining_amount);

        // 5. Vendor A returns the defective unit to shop, shop returns directly to Vendor B (destination: vendor)
        $returnRes = $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unitId}/customer-return", [
                'return_reason' => 'Screen defective hardware',
                'destination' => 'vendor',
                'customer_waiting' => true,
                'condition' => 'defective',
            ]);
        $returnRes->assertOk();

        // Check unit status
        $unit = InventoryUnit::find($unitId);
        $this->assertEquals('returned_to_vendor', $unit->status);
        $this->assertTrue($unit->customer_waiting);

        // Check Vendor B's debt: CANCELLED (0.00 ETB remaining)
        $debtB->refresh();
        $this->assertEquals(0.00, (float) $debtB->remaining_amount);
        $this->assertEquals('settled', $debtB->status);
        $this->assertTrue($debtB->payments->contains(fn ($p) => $p->reference_number === 'RETURN-TO-VENDOR'));

        // Check Vendor B's statement: exactly 0.00 ETB net balance!
        $statementAction = app(\App\Actions\GeneratePartnerStatementAction::class);
        $stmtB = $statementAction->execute($vendorB);
        $this->assertEquals(0.00, (float) $stmtB['kpis']['current_net_balance']);

        // Check Vendor A's debt: restored to 100,000 ETB (because they returned the phone)
        $debtA->refresh();
        $this->assertEquals(100000.00, (float) $debtA->remaining_amount);

        // 6. Vendor B resolves defect and returns unit back: Receive Fixed -> Deliver to Customer (Vendor A)
        $receiveRes = $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unitId}/receive-from-vendor", [
                'action' => 'deliver_to_customer',
                'condition' => 'refurbished',
                'notes' => 'Yenus replaced screen and returned',
            ]);
        $receiveRes->assertOk();

        // Check unit status: sold to Vendor A
        $unit->refresh();
        $this->assertEquals('sold', $unit->status);
        $this->assertEquals($vendorA->name, $unit->handover_to);
        $this->assertEquals("With {$vendorA->name}", $unit->location);

        // Check Vendor B's debt: re-instated (we owe Vendor B 45,000 ETB again)
        $debtB->refresh();
        $this->assertEquals(45000.00, (float) $debtB->remaining_amount);
        $stmtBAfter = $statementAction->execute($vendorB);
        $this->assertEquals(-45000.00, (float) $stmtBAfter['kpis']['current_net_balance']);

        // Check Vendor A's debt: deducted again by 50,000 ETB (down to 50,000 ETB)
        $debtA->refresh();
        $this->assertEquals(50000.00, (float) $debtA->remaining_amount);
        $this->assertTrue($debtA->payments->contains(fn ($p) => str_contains($p->notes ?? '', '(Repaired)')));

        // Check SalesOrder profit restored
        $salesOrder = SalesOrder::where('customer_id', $vendorA->id)->latest()->first();
        $this->assertNotNull($salesOrder);
        $this->assertEquals('paid', $salesOrder->payment_status);
        $this->assertEquals(5000.00, (float) $salesOrder->items->first()->profit);
    }

    public function test_cannot_deliver_unsold_stock_unit_to_customer_on_receive_or_swap(): void
    {
        $unsoldUnit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '358888999000111',
            'cost_basis' => 60000,
            'status' => 'returned_to_vendor',
            'customer_waiting' => false,
            'location' => 'Returned to Vendor/Supplier',
            'source_type' => 'consignment',
            'supplier_contact_id' => $this->supplier->id,
            'condition' => 'refurbished',
            'sim_type' => 'physical',
        ]);

        // Attempt receiveFromVendor with deliver_to_customer -> should be rejected with 422
        $resReceive = $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unsoldUnit->id}/receive-from-vendor", [
                'action' => 'deliver_to_customer',
                'condition' => 'refurbished',
            ]);

        $resReceive->assertStatus(422);
        $resReceive->assertJsonFragment([
            'message' => 'This unit was never sold to a customer or assigned to a partner. Please select "Restock to Shelf".',
        ]);

        // Attempt vendorSwap with deliver_to_customer -> should be rejected with 422
        $resSwap = $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unsoldUnit->id}/vendor-swap", [
                'replacement_imei' => '358888999000222',
                'action' => 'deliver_to_customer',
            ]);

        $resSwap->assertStatus(422);
        $resSwap->assertJsonFragment([
            'message' => 'This unit was never sold to a customer or assigned to a partner. Please select "Restock to Shelf".',
        ]);
    }

    public function test_multiple_return_and_receive_cycles_properly_reinstates_supplier_debt(): void
    {
        // 1. Initial intake
        $unit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '359999111222333',
            'cost_basis' => 40000,
            'status' => 'in_stock',
            'location' => 'Shop Counter',
            'source_type' => 'consignment',
            'supplier_contact_id' => $this->supplier->id,
            'condition' => 'refurbished',
            'sim_type' => 'physical',
        ]);

        $debt = Debt::create([
            'tenant_id' => $this->tenant->id,
            'contact_id' => $this->supplier->id,
            'type' => 'payable',
            'reference_type' => 'stock_intake',
            'reference_id' => $unit->id,
            'original_amount' => 40000,
            'paid_amount' => 0,
            'remaining_amount' => 40000,
            'status' => 'open',
            'notes' => 'Stock intake',
        ]);

        // Cycle 1: Return to vendor
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/return-to-vendor", [
                'reason' => 'Defect 1',
                'customer_waiting' => false,
            ])
            ->assertOk();

        $debt->refresh();
        $this->assertEquals(0.0, (float) $debt->remaining_amount);
        $this->assertEquals('settled', $debt->status);

        // Cycle 1: Receive back fixed
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/receive-from-vendor", [
                'action' => 'restock',
                'condition' => 'refurbished',
            ])
            ->assertOk();

        $debt->refresh();
        $this->assertEquals(40000.0, (float) $debt->remaining_amount);
        $this->assertEquals('open', $debt->status);

        // Cycle 2: Return to vendor again
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/return-to-vendor", [
                'reason' => 'Defect 2',
                'customer_waiting' => false,
            ])
            ->assertOk();

        $debt->refresh();
        $this->assertEquals(0.0, (float) $debt->remaining_amount);
        $this->assertEquals('settled', $debt->status);

        // Cycle 2: Receive back fixed again
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/receive-from-vendor", [
                'action' => 'restock',
                'condition' => 'refurbished',
            ])
            ->assertOk();

        $debt->refresh();
        $this->assertEquals(40000.0, (float) $debt->remaining_amount);
        $this->assertEquals('open', $debt->status);
    }
}



