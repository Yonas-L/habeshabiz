<?php

namespace Tests\Feature;

use App\Actions\RecordSaleAction;
use App\Models\Contact;
use App\Models\FinancialAccount;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeviceWarrantySwapTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $owner;
    private User $salesperson;
    private FinancialAccount $account;
    private ProductVariant $variant;
    private InventoryUnit $soldUnit;
    private InventoryUnit $stockUnit;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create(['name' => 'Habesha Electronics', 'slug' => 'habesha']);
        \App\Scopes\TenantScope::setForcedTenantId($this->tenant->id);

        $this->owner = User::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Shop Owner',
            'email' => 'owner@habesha.com',
            'password' => bcrypt('secret'),
            'role' => 'owner',
        ]);
        $this->salesperson = User::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Sales Attendant',
            'email' => 'sales@habesha.com',
            'password' => bcrypt('secret'),
            'role' => 'salesperson',
        ]);

        $this->account = FinancialAccount::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Main Cash Drawer',
            'type' => 'cash',
            'current_balance' => 500000,
        ]);

        $product = Product::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'iPhone 14 Pro',
            'has_serials' => true,
        ]);

        $this->variant = ProductVariant::create([
            'tenant_id' => $this->tenant->id,
            'product_id' => $product->id,
            'storage' => '256GB',
            'color' => 'Deep Purple',
            'retail_price' => 140000,
        ]);

        // Create 2 units: 1 will be sold, 1 will remain in stock
        $this->soldUnit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => 'IMEI-SOLD-1111',
            'cost_basis' => 100000,
            'status' => 'in_stock',
            'location' => 'Shop Counter',
        ]);

        $this->stockUnit = InventoryUnit::create([
            'tenant_id' => $this->tenant->id,
            'variant_id' => $this->variant->id,
            'imei_or_serial' => 'IMEI-REPLACEMENT-2222',
            'cost_basis' => 100000,
            'status' => 'in_stock',
            'location' => 'Shop Counter',
        ]);

        // Sell unit 1
        $saleAction = new RecordSaleAction();
        $saleAction->execute([
            'customer_name' => 'Abebe Kebede',
            'customer_phone' => '0911000001',
            'salesperson_id' => $this->owner->id,
            'financial_account_id' => $this->account->id,
            'payment_method' => 'cash',
            'paid_amount' => 140000,
            'items' => [
                [
                    'variant_id' => $this->variant->id,
                    'inventory_unit_id' => $this->soldUnit->id,
                    'quantity' => 1,
                    'unit_price' => 140000,
                    'sourcing_type' => 'internal_stock',
                ],
            ],
        ], $this->tenant->id, $this->owner->id);

        $this->soldUnit->refresh();
    }

    public function test_owner_can_swap_defective_sold_device_for_in_stock_replacement(): void
    {
        $this->assertEquals('sold', $this->soldUnit->status);
        $this->assertEquals('in_stock', $this->stockUnit->status);

        $initialAccountBalance = (float) $this->account->fresh()->current_balance;

        $response = $this->actingAs($this->owner)->postJson("/api/v1/inventory/units/{$this->soldUnit->id}/swap", [
            'replacement_unit_id' => $this->stockUnit->id,
            'swap_reason' => 'Battery drains too fast within 7-day warranty',
            'destination' => 'repair',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->soldUnit->refresh();
        $this->stockUnit->refresh();

        // Old unit is now returned/in repair, flagged swapped
        $this->assertEquals('returned', $this->soldUnit->status);
        $this->assertEquals('Repair & Inspection Shelf', $this->soldUnit->location);
        $this->assertTrue($this->soldUnit->is_swapped);
        $this->assertNotNull($this->soldUnit->swapped_at);
        $this->assertEquals($this->stockUnit->id, $this->soldUnit->swapped_replacement_unit_id);
        $this->assertStringContainsString('Battery drains too fast', $this->soldUnit->return_reason);

        // Replacement unit is now sold
        $this->assertEquals('sold', $this->stockUnit->status);
        $this->assertEquals('With Customer', $this->stockUnit->location);
        $this->assertEquals($this->soldUnit->id, $this->stockUnit->swapped_from_unit_id);

        // Sales order item now points to the replacement unit
        $this->assertNull($this->soldUnit->salesOrderItem);
        $this->assertNotNull($this->stockUnit->salesOrderItem);
        $this->assertEquals(100000, (float) $this->stockUnit->salesOrderItem->unit_cost);
        $this->assertEquals(40000, (float) $this->stockUnit->salesOrderItem->profit);

        // Monetary consistency: zero money movement, cash balance untouched
        $this->assertEquals($initialAccountBalance, (float) $this->account->fresh()->current_balance);

        // Order note reflects swap audit trail
        $order = $this->stockUnit->salesOrderItem->salesOrder;
        $this->assertStringContainsString('Warranty Swap', $order->notes);
        $this->assertStringContainsString('IMEI-SOLD-1111', $order->notes);
        $this->assertStringContainsString('IMEI-REPLACEMENT-2222', $order->notes);
    }

    public function test_swap_blocks_cost_mismatch_without_override(): void
    {
        // Update replacement unit to have different cost
        $this->stockUnit->update(['cost_basis' => 120000]);

        $response = $this->actingAs($this->owner)->postJson("/api/v1/inventory/units/{$this->soldUnit->id}/swap", [
            'replacement_unit_id' => $this->stockUnit->id,
            'swap_reason' => 'Defect swap test',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', fn ($msg) => str_contains($msg, 'Cost value mismatch'));
    }

    public function test_cannot_swap_with_unavailable_unit(): void
    {
        // Mark replacement as already sold
        $this->stockUnit->update(['status' => 'sold']);

        $response = $this->actingAs($this->owner)->postJson("/api/v1/inventory/units/{$this->soldUnit->id}/swap", [
            'replacement_unit_id' => $this->stockUnit->id,
            'swap_reason' => 'Test swap',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'The replacement device must be currently in stock on the shop shelf.');
    }

    public function test_non_owner_cannot_swap(): void
    {
        $response = $this->actingAs($this->salesperson)->postJson("/api/v1/inventory/units/{$this->soldUnit->id}/swap", [
            'replacement_unit_id' => $this->stockUnit->id,
            'swap_reason' => 'Test swap',
        ]);

        $response->assertStatus(403);
    }
}
