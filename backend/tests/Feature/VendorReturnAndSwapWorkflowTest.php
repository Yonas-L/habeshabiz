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
use App\Models\FinancialAccount;
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

    public function test_triangular_b2b_handover_sale_customer_return_and_vendor_repair_lifecycle(): void
    {
        $supplier = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Supplier Nati',
            'roles' => ['peer_vendor'],
        ]);

        $buyer = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Partner Yenus',
            'roles' => ['peer_vendor'],
        ]);

        $account = \App\Models\FinancialAccount::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Main Bank',
            'type' => 'bank',
            'current_balance' => 0,
        ]);

        // 1. Stock intake from Supplier Nati (50k cost)
        $unit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => '74623874623874999',
            'cost_basis' => 50000,
            'status' => 'out',
            'location' => 'Out with Partner Yenus',
            'handover_to' => $buyer->name,
            'handover_payout' => 100000,
            'source_type' => 'consignment',
            'supplier_contact_id' => $supplier->id,
            'condition' => 'refurbished',
            'sim_type' => 'physical',
        ]);

        $supplierDebt = Debt::create([
            'tenant_id' => $this->tenant->id,
            'contact_id' => $supplier->id,
            'type' => 'payable',
            'reference_type' => 'stock_intake',
            'reference_id' => $unit->id,
            'original_amount' => 50000,
            'paid_amount' => 0,
            'remaining_amount' => 50000,
            'status' => 'open',
            'notes' => 'Stock intake: iPhone 15',
        ]);

        $holdingDebt = Debt::create([
            'tenant_id' => $this->tenant->id,
            'contact_id' => $buyer->id,
            'type' => 'receivable',
            'reference_type' => 'handover_holding',
            'reference_id' => $unit->id,
            'original_amount' => 100000,
            'paid_amount' => 0,
            'remaining_amount' => 100000,
            'status' => 'open',
            'notes' => 'Handover holding debt',
        ]);

        // 2. Mark Handover Sold: Buyer Yenus pays 100k cash
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/mark-sold", [
                'selling_price' => 100000,
                'settlement_type' => 'paid',
                'financial_account_id' => $account->id,
            ])
            ->assertOk();

        // Verify order created with Buyer Yenus (NOT Supplier Nati)
        $salesOrder = SalesOrder::where('notes', 'like', "%{$unit->id}%")->first();
        $this->assertNotNull($salesOrder);
        $this->assertEquals($buyer->id, $salesOrder->customer_id);
        $this->assertEquals(50000.0, (float) $salesOrder->items->first()->profit);

        // 3. Customer Return: Buyer Yenus returns defective unit directly to supplier
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/customer-return", [
                'return_reason' => 'Defective Camera',
                'destination' => 'vendor',
                'customer_waiting' => true,
            ])
            ->assertOk();

        // Profit zeroed, order marked refunded
        $salesOrder->refresh();
        $this->assertEquals('refunded', $salesOrder->payment_status);
        $this->assertEquals(0.0, (float) $salesOrder->items->first()->profit);

        // Refund payable debt created for Buyer Yenus (we owe Yenus 100k)
        $buyerRefundDebt = Debt::where('contact_id', $buyer->id)
            ->where('reference_type', 'customer_return_refund')
            ->where('reference_id', $unit->id)
            ->first();
        $this->assertNotNull($buyerRefundDebt);
        $this->assertEquals('open', $buyerRefundDebt->status);
        $this->assertEquals(100000.0, (float) $buyerRefundDebt->remaining_amount);

        // Supplier Nati debt cancelled via RETURN-TO-VENDOR (we owe Nati 0k while device is with Nati)
        $supplierDebt->refresh();
        $this->assertEquals(0.0, (float) $supplierDebt->remaining_amount);
        $this->assertEquals('settled', $supplierDebt->status);

        // 4. Supplier Nati repairs device and returns it -> Deliver to Customer (Buyer Yenus)
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/receive-from-vendor", [
                'action' => 'deliver_to_customer',
                'condition' => 'refurbished',
            ])
            ->assertOk();

        // Supplier Nati debt reinstated (we owe Nati 50k again)
        $supplierDebt->refresh();
        $this->assertEquals(50000.0, (float) $supplierDebt->remaining_amount);
        $this->assertEquals('open', $supplierDebt->status);

        // Buyer Yenus refund debt settled upon redelivery (we owe Yenus 0k)
        $buyerRefundDebt->refresh();
        $this->assertEquals(0.0, (float) $buyerRefundDebt->remaining_amount);
        $this->assertEquals('settled', $buyerRefundDebt->status);

        // Profit restored on Sales Order
        $salesOrder->refresh();
        $this->assertEquals('paid', $salesOrder->payment_status);
        $this->assertEquals(50000.0, (float) $salesOrder->items->first()->profit);

        // Unit marked sold with Buyer Yenus
        $unit->refresh();
        $this->assertEquals('sold', $unit->status);
        $this->assertEquals($buyer->name, $unit->handover_to);
    }

    public function test_collecting_payment_on_handover_debt_automatically_marks_unit_sold_and_creates_sales_order_and_profit(): void
    {
        $supplier = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Supplier Yenus',
            'phone' => '+251911999888',
            'roles' => ['supplier'],
            'is_active' => true,
        ]);

        $partner = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Broker Nati',
            'phone' => '+251922777666',
            'roles' => ['peer_vendor'],
            'is_active' => true,
        ]);

        $account = FinancialAccount::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'CBE Main',
            'type' => 'bank',
            'current_balance' => 0,
            'is_active' => true,
        ]);

        // 1. Stock intake from Yenus at 100k
        $unit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => 'SN-HANDOVER-COLLECT-TEST',
            'cost_basis' => 100000,
            'selling_price' => 150000,
            'status' => 'out',
            'source_type' => 'consignment',
            'supplier_contact_id' => $supplier->id,
            'handover_to' => $partner->name,
            'handed_out_at' => now(),
            'condition' => 'new',
            'sim_type' => 'physical',
        ]);

        $handoverDebt = Debt::create([
            'tenant_id' => $this->tenant->id,
            'contact_id' => $partner->id,
            'type' => 'receivable',
            'reference_type' => 'handover_holding',
            'reference_id' => $unit->id,
            'original_amount' => 150000,
            'paid_amount' => 0,
            'remaining_amount' => 150000,
            'status' => 'open',
            'notes' => "Handover payout for {$unit->imei_or_serial} to {$partner->name}",
        ]);

        // 2. User collects payment on the receivable debt via drawer
        $res = $this->actingAs($this->owner)
            ->postJson("/api/v1/debts/{$handoverDebt->id}/payments", [
                'amount' => 150000,
                'financial_account_id' => $account->id,
            ]);

        $res->assertOk();

        // 3. Assert debt is settled
        $handoverDebt->refresh();
        $this->assertEquals('settled', $handoverDebt->status);
        $this->assertEquals(0.0, (float) $handoverDebt->remaining_amount);
        $this->assertEquals(150000.0, (float) $handoverDebt->paid_amount);

        // 4. Assert unit is marked as sold
        $unit->refresh();
        $this->assertEquals('sold', $unit->status);
        $this->assertEquals("Sold by {$partner->name}", $unit->location);
        $this->assertNotNull($unit->sold_at);

        // 5. Assert SalesOrder was automatically created
        $orderItem = SalesOrderItem::where('inventory_unit_id', $unit->id)->first();
        $this->assertNotNull($orderItem);
        $this->assertEquals(150000.0, (float) $orderItem->unit_price);
        $this->assertEquals(100000.0, (float) $orderItem->unit_cost);
        $this->assertEquals(50000.0, (float) $orderItem->profit);

        $salesOrder = $orderItem->salesOrder;
        $this->assertNotNull($salesOrder);
        $this->assertEquals($partner->id, $salesOrder->customer_id);
        $this->assertEquals(150000.0, (float) $salesOrder->total_amount);
        $this->assertEquals(150000.0, (float) $salesOrder->paid_amount);
        $this->assertEquals('paid', $salesOrder->payment_status);

        // 6. Assert Bank Account received the 150,000 ETB
        $account->refresh();
        $this->assertEquals(150000.0, (float) $account->current_balance);
    }

    public function test_triangular_return_to_shelf_and_subsequent_return_to_vendor_clears_supplier_debt_but_preserves_customer_refund_debt(): void
    {
        $supplier = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Supplier Yenus',
            'phone' => '+251911999888',
            'roles' => ['supplier'],
            'is_active' => true,
        ]);

        $partner = Contact::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Partner Nati',
            'phone' => '+251922777666',
            'roles' => ['peer_vendor'],
            'is_active' => true,
        ]);

        $account = FinancialAccount::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'CBE Main',
            'type' => 'bank',
            'current_balance' => 0,
            'is_active' => true,
        ]);

        // 1. Stock intake from Yenus at 100k
        $unit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => 'SN-TRIANGLE-RETURN-TEST',
            'cost_basis' => 100000,
            'selling_price' => 120000,
            'status' => 'out',
            'source_type' => 'consignment',
            'supplier_contact_id' => $supplier->id,
            'handover_to' => $partner->name,
            'handed_out_at' => now(),
            'condition' => 'new',
            'sim_type' => 'physical',
        ]);

        $supplierDebt = Debt::create([
            'tenant_id' => $this->tenant->id,
            'contact_id' => $supplier->id,
            'type' => 'payable',
            'reference_type' => 'stock_intake',
            'reference_id' => $unit->id,
            'original_amount' => 100000,
            'paid_amount' => 0,
            'remaining_amount' => 100000,
            'status' => 'open',
            'notes' => "Stock intake: {$this->variant->product->name} (SN: {$unit->imei_or_serial})",
        ]);

        $handoverDebt = Debt::create([
            'tenant_id' => $this->tenant->id,
            'contact_id' => $partner->id,
            'type' => 'receivable',
            'reference_type' => 'handover_holding',
            'reference_id' => $unit->id,
            'original_amount' => 120000,
            'paid_amount' => 0,
            'remaining_amount' => 120000,
            'status' => 'open',
            'notes' => "Handover payout for {$unit->imei_or_serial} to {$partner->name}",
        ]);

        // 2. Partner sells device and we collect payment
        $this->actingAs($this->owner)
            ->postJson("/api/v1/debts/{$handoverDebt->id}/payments", [
                'amount' => 120000,
                'financial_account_id' => $account->id,
            ])
            ->assertOk();

        $unit->refresh();
        $this->assertEquals('sold', $unit->status);

        // 3. Customer/Partner returns the device to shelf
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/customer-return", [
                'return_reason' => 'Customer changed mind',
                'destination' => 'repair',
            ])
            ->assertOk();

        $unit->refresh();
        $this->assertEquals('returned', $unit->status);

        // Assert customer refund debt exists and is open for 120k
        $customerRefundDebt = Debt::where('tenant_id', $this->tenant->id)
            ->where('contact_id', $partner->id)
            ->where('type', 'payable')
            ->where('reference_type', 'customer_return_refund')
            ->where('reference_id', $unit->id)
            ->first();

        $this->assertNotNull($customerRefundDebt);
        $this->assertEquals('open', $customerRefundDebt->status);
        $this->assertEquals(120000.0, (float) $customerRefundDebt->remaining_amount);

        // 4. Return device from shelf to upstream supplier Yenus
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/return-to-vendor", [
                'return_reason' => 'Defective consignment returned to supplier',
            ])
            ->assertOk();

        $unit->refresh();
        $this->assertEquals('returned_to_vendor', $unit->status);

        // 5. Assert:
        // A) Supplier payable to Yenus is settled (cancelled)
        $supplierDebt->refresh();
        $this->assertEquals('settled', $supplierDebt->status);
        $this->assertEquals(0.0, (float) $supplierDebt->remaining_amount);

        // B) Customer refund payable to Nati is STILL OPEN (120k owed to Nati!)
        $customerRefundDebt->refresh();
        $this->assertEquals('open', $customerRefundDebt->status);
        $this->assertEquals(120000.0, (float) $customerRefundDebt->remaining_amount);
        $this->assertEquals(0.0, (float) $customerRefundDebt->paid_amount);

        // C) Partner Statement for Nati shows 120k payable
        $action = app(\App\Actions\GeneratePartnerStatementAction::class);
        $natiStmt = $action->execute($partner);
        $this->assertEquals(120000.0, (float) $natiStmt['kpis']['current_open_payable']);
        $this->assertEquals(-120000.0, (float) $natiStmt['kpis']['current_net_balance']);

        // D) Partner Statement for Yenus shows 0 payable (settled)
        $yenusStmt = $action->execute($supplier);
        $this->assertEquals(0.0, (float) $yenusStmt['kpis']['current_open_payable']);
        $this->assertEquals(0.0, (float) $yenusStmt['kpis']['current_net_balance']);

        // 6. Upstream supplier Yenus fixes the phone and returns it -> We redeliver to partner Nati
        $this->actingAs($this->owner)
            ->postJson("/api/v1/inventory/units/{$unit->id}/receive-from-vendor", [
                'action' => 'deliver_to_customer',
                'notes' => 'Fixed screen defect and handed back to Nati',
            ])
            ->assertOk();

        $unit->refresh();
        $this->assertEquals('sold', $unit->status);
        $this->assertEquals("With {$partner->name}", $unit->location);

        // 7. Assert:
        // A) Supplier payable to Yenus is restored (100k owed to Yenus)
        $supplierDebt->refresh();
        $this->assertEquals('open', $supplierDebt->status);
        $this->assertEquals(100000.0, (float) $supplierDebt->remaining_amount);

        // B) Customer refund payable to Nati is settled upon redelivery
        $customerRefundDebt->refresh();
        $this->assertEquals('settled', $customerRefundDebt->status);
        $this->assertEquals(0.0, (float) $customerRefundDebt->remaining_amount);

        // C) Partner Statement for Yenus shows 100k payable
        $yenusStmt2 = $action->execute($supplier);
        $this->assertEquals(100000.0, (float) $yenusStmt2['kpis']['current_open_payable']);
        $this->assertEquals(-100000.0, (float) $yenusStmt2['kpis']['current_net_balance']);

        // D) Partner Statement for Nati shows 0 payable (settled)
        $natiStmt2 = $action->execute($partner);
        $this->assertEquals(0.0, (float) $natiStmt2['kpis']['current_open_payable']);
        $this->assertEquals(0.0, (float) $natiStmt2['kpis']['current_net_balance']);
    }
}




