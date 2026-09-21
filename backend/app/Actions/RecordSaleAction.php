<?php

namespace App\Actions;

use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class RecordSaleAction
{
    /**
     * @param  array{
     *     order_number?: string,
     *     customer_id?: string|null,
     *     salesperson_id?: int|null,
     *     discount_amount?: float|int,
     *     paid_amount: float|int,
     *     payment_method?: string,
     *     financial_account_id?: string|null,
     *     notes?: string|null,
     *     items: array<int, array{
     *         variant_id: string,
     *         inventory_unit_id?: string|null,
     *         quantity?: int,
     *         unit_price: float|int,
     *         sourcing_type?: string,
     *         vendor_contact_id?: string|null,
     *         vendor_cost?: float|int|null
     *     }>
     * }  $data
     */
    public function execute(array $data): SalesOrder
    {
        return DB::transaction(function () use ($data) {
            $tenantId = TenantScope::getActiveTenantId();
            $orderNumber = $data['order_number'] ?? 'ORD-'.strtoupper(Str::random(8));
            $discount = (float) ($data['discount_amount'] ?? 0);
            $paidAmount = (float) $data['paid_amount'];

            // Compute total price across items
            $totalAmount = 0.0;
            foreach ($data['items'] as $itemData) {
                $qty = (int) ($itemData['quantity'] ?? 1);
                $totalAmount += (float) $itemData['unit_price'] * $qty;
            }

            $netPayable = max(0, $totalAmount - $discount);
            $paymentStatus = 'paid';
            if ($paidAmount <= 0) {
                $paymentStatus = 'unpaid';
            } elseif ($paidAmount < $netPayable) {
                $paymentStatus = 'partially_paid';
            }

            $order = SalesOrder::create([
                'tenant_id' => $tenantId,
                'order_number' => $orderNumber,
                'customer_id' => $data['customer_id'] ?? null,
                'salesperson_id' => $data['salesperson_id'] ?? null,
                'total_amount' => $totalAmount,
                'discount_amount' => $discount,
                'paid_amount' => $paidAmount,
                'payment_status' => $paymentStatus,
                'payment_method' => $data['payment_method'] ?? 'cash',
                'financial_account_id' => $data['financial_account_id'] ?? null,
                'notes' => $data['notes'] ?? null,
                'order_date' => now(),
            ]);

            foreach ($data['items'] as $itemData) {
                $qty = (int) ($itemData['quantity'] ?? 1);
                $unitPrice = (float) $itemData['unit_price'];
                $sourcingType = $itemData['sourcing_type'] ?? 'internal_stock';
                $vendorContactId = $itemData['vendor_contact_id'] ?? null;
                $vendorCost = isset($itemData['vendor_cost']) ? (float) $itemData['vendor_cost'] : null;
                $unitCost = 0.0;

                if ($sourcingType === 'brokered_neighbour') {
                    if (! $vendorContactId || $vendorCost === null) {
                        throw new InvalidArgumentException('Brokered neighbour sourcing requires vendor_contact_id and vendor_cost.');
                    }
                    $unitCost = $vendorCost;

                    // Automatically create an outstanding payable to the peer vendor
                    $payableAmount = $vendorCost * $qty;
                    Debt::create([
                        'tenant_id' => $tenantId,
                        'contact_id' => $vendorContactId,
                        'type' => 'payable',
                        'reference_type' => 'brokered_sourcing',
                        'reference_id' => $order->id,
                        'original_amount' => $payableAmount,
                        'paid_amount' => 0.0,
                        'remaining_amount' => $payableAmount,
                        'due_date' => now()->addDays(7),
                        'status' => 'open',
                        'notes' => "Brokered sourcing for Order #{$order->order_number}",
                    ]);
                } else {
                    // Internal Stock
                    if (! empty($itemData['inventory_unit_id'])) {
                        $unit = InventoryUnit::where('id', $itemData['inventory_unit_id'])
                            ->where('status', 'in_stock')
                            ->first();

                        if (! $unit) {
                            throw new InvalidArgumentException("Selected inventory unit is not available in stock.");
                        }

                        $unitCost = (float) $unit->cost_basis;
                        $unit->update([
                            'status' => 'sold',
                            'sold_at' => now(),
                        ]);
                    } else {
                        // Quantity stock
                        $stock = InventoryStock::where('variant_id', $itemData['variant_id'])->first();
                        $unitCost = $stock ? (float) $stock->average_cost : 0.0;
                        if ($stock) {
                            if ($stock->quantity_on_hand < $qty) {
                                throw new InvalidArgumentException("Requested quantity ({$qty}) exceeds available stock ({$stock->quantity_on_hand}).");
                            }
                            $stock->decrement('quantity_on_hand', $qty);
                        }
                    }
                }

                $profit = ($unitPrice - $unitCost) * $qty;

                SalesOrderItem::create([
                    'tenant_id' => $tenantId,
                    'sales_order_id' => $order->id,
                    'variant_id' => $itemData['variant_id'],
                    'inventory_unit_id' => $itemData['inventory_unit_id'] ?? null,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'unit_cost' => $unitCost,
                    'profit' => $profit,
                    'sourcing_type' => $sourcingType,
                    'vendor_contact_id' => $vendorContactId,
                    'vendor_cost' => $vendorCost,
                ]);
            }

            // Record customer receivable if partially paid or unpaid
            $unpaidBalance = $netPayable - $paidAmount;
            if ($unpaidBalance > 0 && ! empty($data['customer_id'])) {
                Debt::create([
                    'tenant_id' => $tenantId,
                    'contact_id' => $data['customer_id'],
                    'type' => 'receivable',
                    'reference_type' => 'sales_order',
                    'reference_id' => $order->id,
                    'original_amount' => $unpaidBalance,
                    'paid_amount' => 0.0,
                    'remaining_amount' => $unpaidBalance,
                    'due_date' => now()->addDays(14),
                    'status' => 'open',
                    'notes' => "Unpaid balance for Order #{$order->order_number}",
                ]);
            }

            // Credit financial account if initial payment was made
            if ($paidAmount > 0 && ! empty($data['financial_account_id'])) {
                $account = FinancialAccount::findOrFail($data['financial_account_id']);
                $account->increment('current_balance', $paidAmount);

                FinancialTransaction::create([
                    'tenant_id' => $tenantId,
                    'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                    'destination_account_id' => $account->id,
                    'type' => 'customer_payment',
                    'amount' => $paidAmount,
                    'contact_id' => $data['customer_id'] ?? null,
                    'description' => "Payment received for Order #{$order->order_number}",
                    'date' => now(),
                    'created_by' => auth()->id(),
                ]);
            }

            AuditLog::record(
                action: 'sale_created',
                entityType: 'SalesOrder',
                entityId: (string) $order->id,
                newValues: [
                    'order_number' => $order->order_number,
                    'total_amount' => $order->total_amount,
                    'paid_amount' => $order->paid_amount,
                    'payment_method' => $order->payment_method,
                    'items_count' => count($data['items']),
                ],
                userId: $data['salesperson_id'] ?? auth()->id()
            );

            return $order->load(['items', 'customer', 'salesperson']);
        });
    }
}
