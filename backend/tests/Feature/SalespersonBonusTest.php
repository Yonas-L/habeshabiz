<?php

use App\Actions\RecordSaleAction;
use App\Actions\SettleDebtPaymentAction;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->tenant = Tenant::create(['name' => 'Bole Shop', 'slug' => 'bole-bonus-test']);
    TenantScope::setForcedTenantId($this->tenant->id);

    $this->owner = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'owner',
        'is_active' => true,
    ]);
    $this->salesperson = User::factory()->create([
        'tenant_id' => $this->tenant->id,
        'role' => 'salesperson',
        'name' => 'Dawit Sales',
        'phone' => '+251911223344',
        'is_active' => true,
    ]);

    $this->actingAs($this->salesperson);

    $this->account = FinancialAccount::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'Cash on Hand',
        'type' => 'cash',
        'currency' => 'ETB',
        'current_balance' => 500000.00,
        'is_active' => true,
    ]);

    $this->product = Product::create([
        'tenant_id' => $this->tenant->id,
        'name' => 'iPhone 16 Pro',
        'brand' => 'Apple',
        'category' => 'phones',
        'has_serials' => true,
    ]);

    $this->variant = ProductVariant::create([
        'tenant_id' => $this->tenant->id,
        'product_id' => $this->product->id,
        'storage' => '256GB',
        'color' => 'Desert Titanium',
        'default_selling_price' => 150000.00,
    ]);

    $this->unit = InventoryUnit::create([
        'tenant_id' => $this->tenant->id,
        'variant_id' => $this->variant->id,
        'imei_or_serial' => '359871102987123',
        'cost_basis' => 130000.00,
        'status' => 'in_stock',
        'source_type' => 'purchase',
    ]);
});

test('selling product above setted price creates bonus amount and payable debt for salesperson', function () {
    $action = app(RecordSaleAction::class);

    // Setted price is 150,000, sold for 160,000 -> 10,000 bonus
    $order = $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'paid_amount' => 160000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 160000.00,
            ],
        ],
    ]);

    expect((float) $order->total_bonus_amount)->toBe(10000.0);

    $item = $order->items->first();
    expect((float) $item->setted_price)->toBe(150000.0);
    expect((float) $item->bonus_amount)->toBe(10000.0);
    // Shop profit is (160,000 - 130,000) - 10,000 bonus = 20,000
    expect((float) $item->profit)->toBe(20000.0);

    // Verify payable debt was created for the sales agent
    $bonusDebt = Debt::where('salesperson_id', $this->salesperson->id)
        ->where('reference_type', 'salesperson_bonus')
        ->first();

    expect($bonusDebt)->not->toBeNull();
    expect($bonusDebt->type)->toBe('payable');
    expect((float) $bonusDebt->original_amount)->toBe(10000.0);
    expect((float) $bonusDebt->remaining_amount)->toBe(10000.0);
    expect($bonusDebt->status)->toBe('open');
    expect($bonusDebt->contact->name)->toBe('Dawit Sales');
});

test('selling at or below setted price generates no bonus debt', function () {
    $action = app(RecordSaleAction::class);

    // Sold at exactly setted price (150,000)
    $order = $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'paid_amount' => 150000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 150000.00,
            ],
        ],
    ]);

    expect((float) $order->total_bonus_amount)->toBe(0.0);
    expect(Debt::where('reference_type', 'salesperson_bonus')->count())->toBe(0);
});

test('owner below-cost sale records a real negative item profit', function () {
    $action = app(RecordSaleAction::class);

    $order = $action->execute([
        'salesperson_id' => $this->owner->id,
        'paid_amount' => 120000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 120000.00,
            ],
        ],
    ]);

    expect((float) $order->items->first()->profit)->toBe(-10000.0);
    expect((float) $order->items->first()->bonus_amount)->toBe(0.0);
});

test('a short payment is rejected unless checkout explicitly marks the sale as credit', function () {
    $action = app(RecordSaleAction::class);

    expect(fn () => $action->execute([
        'salesperson_id' => $this->owner->id,
        'paid_amount' => 100000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [[
            'variant_id' => $this->variant->id,
            'inventory_unit_id' => $this->unit->id,
            'quantity' => 1,
            'unit_price' => 120000.00,
        ]],
    ]))->toThrow(ValidationException::class);

    expect(SalesOrder::count())->toBe(0);
    expect(Debt::where('type', 'receivable')->count())->toBe(0);
});

test('an explicitly marked credit sale creates the receivable and preserves the loss', function () {
    $action = app(RecordSaleAction::class);

    $order = $action->execute([
        'salesperson_id' => $this->owner->id,
        'credit_sale' => true,
        'paid_amount' => 100000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [[
            'variant_id' => $this->variant->id,
            'inventory_unit_id' => $this->unit->id,
            'quantity' => 1,
            'unit_price' => 120000.00,
        ]],
    ]);

    expect($order->credit_sale)->toBeTrue();
    expect((float) $order->items->first()->profit)->toBe(-10000.0);
    expect((float) Debt::where('type', 'receivable')->firstOrFail()->remaining_amount)->toBe(20000.0);
});

test('an intentional price concession closes the sale without creating a receivable', function () {
    $action = app(RecordSaleAction::class);

    $order = $action->execute([
        'salesperson_id' => $this->owner->id,
        'intentional_shortfall' => true,
        'paid_amount' => 100000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [[
            'variant_id' => $this->variant->id,
            'inventory_unit_id' => $this->unit->id,
            'quantity' => 1,
            'unit_price' => 120000.00,
        ]],
    ]);

    expect($order->credit_sale)->toBeFalse();
    expect($order->payment_status)->toBe('paid');
    expect((float) $order->write_off_amount)->toBe(20000.0);
    expect(Debt::where('type', 'receivable')->count())->toBe(0);
});

test('owner sale above setted price keeps the full margin as business profit without a bonus payable', function () {
    $action = app(RecordSaleAction::class);

    $order = $action->execute([
        'salesperson_id' => $this->owner->id,
        'paid_amount' => 160000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 160000.00,
            ],
        ],
    ]);

    $item = $order->items->first();

    expect((float) $order->total_bonus_amount)->toBe(0.0);
    expect((float) $item->bonus_amount)->toBe(0.0);
    expect((float) $item->profit)->toBe(30000.0);
    expect(Debt::where('reference_type', 'salesperson_bonus')->count())->toBe(0);
});

test('leaderboard returns uncollected bonus and collected bonus accurately before and after settlement', function () {
    $action = app(RecordSaleAction::class);

    // Record sale with 15,000 ETB bonus
    $order = $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'paid_amount' => 165000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 165000.00,
            ],
        ],
    ]);

    // Check leaderboard API before settlement
    $response = $this->actingAs($this->salesperson)
        ->getJson('/api/v1/staff/leaderboard');

    $response->assertOk();
    $staffData = collect($response->json('data.leaderboard'))->firstWhere('user_id', $this->salesperson->id);
    expect($staffData)->not->toBeNull();
    expect((float) $staffData['uncollected_bonus'])->toBe(15000.0);
    expect((float) $staffData['collected_bonus'])->toBe(0.0);
    expect((float) $staffData['total_bonus_earned'])->toBe(15000.0);

    // Owner settles the bonus payable via SettleDebtPaymentAction
    $bonusDebt = Debt::where('salesperson_id', $this->salesperson->id)
        ->where('reference_type', 'salesperson_bonus')
        ->firstOrFail();

    $settleAction = app(SettleDebtPaymentAction::class);
    $settleAction->execute($bonusDebt, [
        'amount' => 15000.00,
        'financial_account_id' => $this->account->id,
    ]);

    expect($bonusDebt->fresh()->status)->toBe('settled');
    expect((float) $bonusDebt->fresh()->remaining_amount)->toBe(0.0);

    // Check leaderboard API after settlement
    $responseAfter = $this->actingAs($this->salesperson)
        ->getJson('/api/v1/staff/leaderboard');

    $staffDataAfter = collect($responseAfter->json('data.leaderboard'))->firstWhere('user_id', $this->salesperson->id);
    expect((float) $staffDataAfter['uncollected_bonus'])->toBe(0.0);
    expect((float) $staffDataAfter['collected_bonus'])->toBe(15000.0);
    expect((float) $staffDataAfter['total_bonus_earned'])->toBe(15000.0);
});

test('dashboard summary reports uncollected bonus alerts to owner', function () {
    $action = app(RecordSaleAction::class);

    $action->execute([
        'salesperson_id' => $this->salesperson->id,
        'paid_amount' => 160000.00,
        'payment_method' => 'cash',
        'financial_account_id' => $this->account->id,
        'items' => [
            [
                'variant_id' => $this->variant->id,
                'inventory_unit_id' => $this->unit->id,
                'quantity' => 1,
                'unit_price' => 160000.00,
            ],
        ],
    ]);

    $res = $this->actingAs($this->owner)
        ->getJson('/api/v1/dashboard/summary');

    $res->assertOk();
    expect((float) $res->json('data.counts.uncollected_staff_bonuses'))->toBe(10000.0);
    expect($res->json('data.counts.pending_bonus_staff_count'))->toBe(1);
});
