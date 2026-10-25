<?php

namespace App\Actions;

use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
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
     *     credit_sale?: bool,
     *     intentional_shortfall?: bool,
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
            $revertGroupId = (string) Str::uuid();
            $orderNumber = $data['order_number'] ?? 'ORD-'.strtoupper(Str::random(8));
            $discount = (float) ($data['discount_amount'] ?? 0);
            $paidAmount = (float) $data['paid_amount'];

            // Resolve or create customer contact if provided
            $customerId = $data['customer_id'] ?? null;
            $customerName = isset($data['customer_name']) ? trim((string) $data['customer_name']) : '';
            $customerPhone = isset($data['customer_phone']) && trim((string) $data['customer_phone']) !== ''
                ? trim((string) $data['customer_phone'])
                : null;

            if (! $customerId && ($customerName !== '' || $customerPhone !== null)) {
                if ($customerName === '' && $customerPhone !== null) {
                    $customerName = 'Customer ('.$customerPhone.')';
                }

                // Check if a contact already exists with this phone or exact name in this tenant
                $existingContact = null;
                if ($customerPhone) {
                    $existingContact = Contact::where('tenant_id', $tenantId)
                        ->where('phone', $customerPhone)
                        ->first();
                }
                if (! $existingContact && $customerName !== '') {
                    $existingContact = Contact::where('tenant_id', $tenantId)
                        ->where('name', $customerName)
                        ->first();
                }

                if ($existingContact) {
                    $customerId = $existingContact->id;
                    $roles = $existingContact->roles ?? [];
                    $needsUpdate = false;
                    if (! in_array('customer', $roles, true)) {
                        $roles[] = 'customer';
                        $existingContact->roles = $roles;
                        $needsUpdate = true;
                    }
                    if ($customerPhone && empty($existingContact->phone)) {
                        $existingContact->phone = $customerPhone;
                        $needsUpdate = true;
                    }
                    if ($needsUpdate) {
                        $existingContact->save();
                    }
                } else {
                    $newContact = Contact::create([
                        'tenant_id' => $tenantId,
                        'name' => $customerName,
                        'phone' => $customerPhone,
                        'roles' => ['customer'],
                        'is_active' => true,
                    ]);
                    $customerId = $newContact->id;
                }
            }

            // If customer paid more than entered total price (e.g. salesperson entered final selling price into paid_amount)
            $preliminaryTotal = 0.0;
            foreach ($data['items'] as $itemData) {
                $qty = (int) ($itemData['quantity'] ?? 1);
                $preliminaryTotal += (float) $itemData['unit_price'] * $qty;
            }
            if ($paidAmount + $discount > $preliminaryTotal && count($data['items']) === 1) {
                $firstKey = array_key_first($data['items']);
                $itemQty = max(1, (int) ($data['items'][$firstKey]['quantity'] ?? 1));
                $data['items'][$firstKey]['unit_price'] = ($paidAmount + $discount) / $itemQty;
            }

            // Compute total price and upsell bonus across items
            $totalAmount = 0.0;
            $rawItemBonuses = [];
            $settedPrices = [];
            foreach ($data['items'] as $idx => $itemData) {
                $qty = (int) ($itemData['quantity'] ?? 1);
                $unitPrice = (float) $itemData['unit_price'];
                $totalAmount += $unitPrice * $qty;

                $variant = ! empty($itemData['variant_id']) ? ProductVariant::find($itemData['variant_id']) : null;
                $unit = ! empty($itemData['inventory_unit_id']) ? InventoryUnit::find($itemData['inventory_unit_id']) : null;
                $benchmarkPrice = (float) ($unit?->selling_price ?? $variant?->default_selling_price ?? 0);
                $settedPrice = isset($itemData['setted_price']) && (float) $itemData['setted_price'] > 0
                    ? (float) $itemData['setted_price']
                    : $benchmarkPrice;

                if ($settedPrice <= 0) {
                    $settedPrice = $unitPrice;
                }

                $settedPrices[$idx] = $settedPrice;
                $rawItemBonuses[$idx] = $unitPrice > $settedPrice ? ($unitPrice - $settedPrice) * $qty : 0.0;
            }

            $totalRawBonus = array_sum($rawItemBonuses);
            $salesperson = ! empty($data['salesperson_id'])
                ? User::find($data['salesperson_id'])
                : null;
            $isSalespersonBonusEligible = $salesperson && ! $salesperson->isOwner();
            $netOrderBonus = $isSalespersonBonusEligible
                ? max(0.0, $totalRawBonus - $discount)
                : 0.0;

            $exchangeData = $data['exchange'] ?? null;
            $exchangeAllowance = 0.0;
            if (! empty($exchangeData) && ! empty($exchangeData['trade_in_value'])) {
                $exchangeAllowance = (float) $exchangeData['trade_in_value'];
            }

            $isDebtOffset = ($data['payment_method'] ?? '') === 'debt_offset';
            $debtOffsetAmount = isset($data['debt_offset_amount'])
                ? (float) $data['debt_offset_amount']
                : ($isDebtOffset ? (isset($data['cash_amount']) ? max(0.0, $paidAmount - (float) $data['cash_amount']) : $paidAmount) : 0.0);
            $bankCashReceived = isset($data['cash_amount'])
                ? (float) $data['cash_amount']
                : ($isDebtOffset ? max(0.0, $paidAmount - $debtOffsetAmount) : $paidAmount);

            // Total paid satisfies order = debt offset + bank cash
            $effectivePaid = $isDebtOffset ? ($debtOffsetAmount + $bankCashReceived) : $paidAmount;
            if ($effectivePaid > 0 && $paidAmount <= 0) {
                $paidAmount = $effectivePaid;
            }

            // Net payable is order total minus discount minus trade-in exchange allowance
            $netPayable = max(0, $totalAmount - $discount - $exchangeAllowance);
            $creditSale = (bool) ($data['credit_sale'] ?? (($data['payment_method'] ?? null) === 'credit'));
            $unpaidBalance = max(0, $netPayable - $paidAmount);
            $intentionalShortfall = (bool) ($data['intentional_shortfall'] ?? false);

            if ($creditSale && $intentionalShortfall) {
                throw ValidationException::withMessages([
                    'intentional_shortfall' => 'A sale cannot be both a credit sale and an intentional write-off.',
                ]);
            }

            if ($unpaidBalance > 0 && ! $creditSale && ! $intentionalShortfall) {
                throw ValidationException::withMessages([
                    'credit_sale' => 'The sale has an unpaid balance. Mark it as credit, record a price concession, or collect the full amount before completing checkout.',
                ]);
            }

            $paymentStatus = 'paid';
            if ($intentionalShortfall) {
                $paymentStatus = 'paid';
            } elseif ($netPayable > 0 && $paidAmount <= 0) {
                $paymentStatus = 'unpaid';
            } elseif ($paidAmount < $netPayable) {
                $paymentStatus = 'partially_paid';
            }

            $rawSplits = $data['payment_splits'] ?? null;
            $enrichedSplits = null;
            if (is_array($rawSplits) && count($rawSplits) > 0) {
                $accIds = collect($rawSplits)->pluck('financial_account_id')->filter()->all();
                $accMap = FinancialAccount::whereIn('id', $accIds)->pluck('name', 'id');
                $enrichedSplits = array_map(function ($s) use ($accMap) {
                    $aid = $s['financial_account_id'] ?? null;

                    return [
                        'financial_account_id' => $aid,
                        'account_name' => $s['account_name'] ?? ($accMap[$aid] ?? 'Account'),
                        'amount' => (float) ($s['amount'] ?? 0),
                        'reference_number' => $s['reference_number'] ?? null,
                    ];
                }, $rawSplits);

                if ($bankCashReceived > 0) {
                    $splitSum = (float) collect($enrichedSplits)->sum(fn ($s) => (float) ($s['amount'] ?? 0));
                    if (abs($splitSum - $bankCashReceived) > 0.01) {
                        throw ValidationException::withMessages([
                            'payment_splits' => ['Split allocation total ('.number_format($splitSum, 2).' ETB) does not match customer bank cash amount ('.number_format($bankCashReceived, 2).' ETB).'],
                        ]);
                    }
                }
            }
            $primaryAccountId = $data['financial_account_id'] ?? ($enrichedSplits ? ($enrichedSplits[0]['financial_account_id'] ?? null) : null);

            $order = SalesOrder::create([
                'tenant_id' => $tenantId,
                'order_number' => $orderNumber,
                'customer_id' => $customerId,
                'salesperson_id' => $data['salesperson_id'] ?? null,
                'total_amount' => $totalAmount,
                'discount_amount' => $discount,
                'write_off_amount' => $intentionalShortfall ? $unpaidBalance : 0,
                'exchange_allowance' => $exchangeAllowance,
                'total_bonus_amount' => $netOrderBonus,
                'paid_amount' => $paidAmount,
                'payment_status' => $paymentStatus,
                'credit_sale' => $creditSale,
                'payment_method' => $data['payment_method'] ?? 'cash',
                'financial_account_id' => $primaryAccountId,
                'payment_splits' => $enrichedSplits,
                'notes' => $data['notes'] ?? null,
                'order_date' => now(),
            ]);

            // If an exchange device was traded in, create the incoming inventory unit
            if (! empty($exchangeData) && ! empty($exchangeData['variant_id']) && $exchangeAllowance > 0) {
                $exchangeVariant = ProductVariant::with('product')->findOrFail($exchangeData['variant_id']);
                $exchangeImei = ! empty($exchangeData['imei_or_serial']) ? trim($exchangeData['imei_or_serial']) : null;
                $exchangeSerial = ! empty($exchangeData['serial_number']) ? trim($exchangeData['serial_number']) : null;
                if (! $exchangeImei && $exchangeSerial) {
                    $exchangeImei = $exchangeSerial;
                }

                if ($exchangeImei) {
                    $alreadyExists = InventoryUnit::where('tenant_id', $tenantId)
                        ->whereIn('status', ['in_stock', 'reserved', 'out'])
                        ->where('imei_or_serial', $exchangeImei)
                        ->exists();

                    if ($alreadyExists) {
                        throw new InvalidArgumentException("Traded-in device IMEI/Serial '{$exchangeImei}' is already present in active shop inventory.");
                    }
                }

                if ($exchangeSerial && $exchangeSerial !== $exchangeImei) {
                    $alreadyExistsS = InventoryUnit::where('tenant_id', $tenantId)
                        ->whereIn('status', ['in_stock', 'reserved', 'out'])
                        ->where('serial_number', $exchangeSerial)
                        ->exists();

                    if ($alreadyExistsS) {
                        throw new InvalidArgumentException("Traded-in device Serial '{$exchangeSerial}' is already present in active shop inventory.");
                    }
                }

                $exchangeUnit = InventoryUnit::create([
                    'tenant_id' => $tenantId,
                    'variant_id' => $exchangeVariant->id,
                    'imei_or_serial' => $exchangeImei,
                    'serial_number' => $exchangeSerial,
                    'condition' => $exchangeData['condition'] ?? 'used_clean',
                    'battery_health' => isset($exchangeData['battery_health']) && $exchangeData['battery_health'] !== '' ? (int) $exchangeData['battery_health'] : null,
                    'cycle_count' => isset($exchangeData['cycle_count']) && $exchangeData['cycle_count'] !== '' ? (int) $exchangeData['cycle_count'] : null,
                    'sim_type' => $exchangeData['sim_type'] ?? 'physical',
                    'cost_basis' => $exchangeAllowance,
                    'status' => 'in_stock',
                    'source_type' => 'exchange',
                    'supplier_contact_id' => $customerId,
                    'exchange_sales_order_id' => $order->id,
                    'location' => $exchangeData['location'] ?? 'Shop Counter',
                    'notes' => ! empty($exchangeData['notes'])
                        ? $exchangeData['notes']
                        : "Exchanged/Traded-in against Order #{$order->order_number}",
                ]);

                // Update order reference to the exchange unit
                $order->update(['exchange_unit_id' => $exchangeUnit->id]);

                // Increment in-stock count in aggregated InventoryStock
                $stock = InventoryStock::firstOrCreate(
                    [
                        'tenant_id' => $tenantId,
                        'variant_id' => $exchangeVariant->id,
                    ],
                    [
                        'quantity_on_hand' => 0,
                        'average_cost' => $exchangeAllowance,
                    ]
                );

                $currentQty = $stock->quantity_on_hand;
                $newQty = $currentQty + 1;
                $newAvgCost = $currentQty > 0
                    ? (($stock->average_cost * $currentQty) + $exchangeAllowance) / $newQty
                    : $exchangeAllowance;

                $stock->update([
                    'quantity_on_hand' => $newQty,
                    'average_cost' => round($newAvgCost, 2),
                ]);

                AuditLog::record(
                    action: 'exchange_device_received',
                    entityType: 'InventoryUnit',
                    entityId: (string) $exchangeUnit->id,
                    newValues: [
                        'order_number' => $order->order_number,
                        'variant_id' => $exchangeVariant->id,
                        'imei_or_serial' => $exchangeUnit->imei_or_serial,
                        'trade_in_value' => $exchangeAllowance,
                    ],
                    userId: $data['salesperson_id'] ?? auth()->id(),
                    revertGroupId: $revertGroupId
                );
            }

            $primaryItemId = null;
            foreach ($data['items'] as $idx => $itemData) {
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

                    if (! empty($itemData['inventory_unit_id'])) {
                        $unit = InventoryUnit::where('id', $itemData['inventory_unit_id'])->first();
                        if ($unit) {
                            $unit->update([
                                'status' => 'sold',
                                'sold_at' => now(),
                            ]);
                        }
                    }

                    $payableAmount = $vendorCost * $qty;
                    $vendorPaidNow = ! empty($itemData['vendor_paid_now']);
                    $vendorPaidAmount = isset($itemData['vendor_paid_amount'])
                        ? (float) $itemData['vendor_paid_amount']
                        : ($vendorPaidNow ? $payableAmount : 0.0);

                    $paidNow = min($payableAmount, max(0.0, $vendorPaidAmount));
                    $remOwed = max(0.0, $payableAmount - $paidNow);
                    $debtStatus = $remOwed <= 0.009 ? 'settled' : ($paidNow > 0.009 ? 'partially_paid' : 'open');
                    $vendorAccountId = $itemData['vendor_payment_account_id'] ?? null;
                    $vendorSplits = $itemData['vendor_payment_splits'] ?? null;
                    $hasSplits = is_array($vendorSplits) && count($vendorSplits) > 0;

                    $isAcc = ! empty($itemData['is_accessory']) || ! empty($itemData['accessory_name']);
                    $accLabel = ! empty($itemData['accessory_name'])
                        ? " (Vendored Accessory: {$itemData['accessory_name']})"
                        : ($isAcc ? ' (Vendored Accessory)' : '');
                    $brokeredDebt = Debt::create([
                        'tenant_id' => $tenantId,
                        'contact_id' => $vendorContactId,
                        'type' => 'payable',
                        'reference_type' => 'brokered_sourcing',
                        'reference_id' => $order->id,
                        'original_amount' => $payableAmount,
                        'paid_amount' => $paidNow,
                        'remaining_amount' => $remOwed,
                        'due_date' => $remOwed > 0 ? now()->addDays(7) : now(),
                        'status' => $debtStatus,
                        'payment_splits' => $hasSplits ? $vendorSplits : null,
                        'notes' => $remOwed <= 0.009
                            ? "Brokered sourcing{$accLabel} for Order #{$order->order_number} (Paid on spot)"
                            : ($paidNow > 0.009
                                ? "Brokered sourcing{$accLabel} for Order #{$order->order_number} (Partial down payment: ".number_format($paidNow, 2).' ETB, Remaining: '.number_format($remOwed, 2).' ETB)'
                                : "Brokered sourcing{$accLabel} for Order #{$order->order_number}"),
                    ]);

                    if ($paidNow > 0) {
                        $alreadyProcessed = ! empty($itemData['payout_already_processed']);
                        if ($hasSplits) {
                            $splitGroupId = count($vendorSplits) > 1 ? (string) Str::uuid() : null;
                            foreach ($vendorSplits as $vSplit) {
                                $vSplitAmt = (float) ($vSplit['amount'] ?? 0);
                                if ($vSplitAmt <= 0) {
                                    continue;
                                }
                                $vAcc = FinancialAccount::find($vSplit['financial_account_id']);
                                $accName = $vAcc?->name ?? 'Account';
                                DebtPayment::create([
                                    'tenant_id' => $tenantId,
                                    'debt_id' => $brokeredDebt->id,
                                    'split_group_id' => $splitGroupId,
                                    'financial_account_id' => $vSplit['financial_account_id'],
                                    'amount' => $vSplitAmt,
                                    'payment_date' => now(),
                                    'reference_number' => $vSplit['reference_number'] ?? null,
                                    'notes' => count($vendorSplits) > 1
                                        ? "Settled immediately at POS sale (Split via {$accName})"
                                        : 'Settled immediately at POS sale',
                                    'created_by' => $data['salesperson_id'] ?? auth()->id(),
                                ]);

                                if (! $alreadyProcessed && $vAcc) {
                                    $vAcc->decrement('current_balance', $vSplitAmt);
                                    FinancialTransaction::create([
                                        'tenant_id' => $tenantId,
                                        'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                                        'source_account_id' => $vAcc->id,
                                        'type' => 'supplier_payment',
                                        'amount' => $vSplitAmt,
                                        'fee' => 0,
                                        'reference_number' => $vSplit['reference_number'] ?? null,
                                        'contact_id' => $vendorContactId,
                                        'description' => "Vendor payout for brokered item{$accLabel} on Order #{$order->order_number}",
                                        'date' => now(),
                                        'created_by' => $data['salesperson_id'] ?? auth()->id(),
                                    ]);
                                }
                            }
                        } elseif ($vendorAccountId) {
                            $vAcc = FinancialAccount::find($vendorAccountId);
                            DebtPayment::create([
                                'tenant_id' => $tenantId,
                                'debt_id' => $brokeredDebt->id,
                                'financial_account_id' => $vendorAccountId,
                                'amount' => $paidNow,
                                'payment_date' => now(),
                                'notes' => 'Settled immediately at POS sale',
                                'created_by' => $data['salesperson_id'] ?? auth()->id(),
                            ]);

                            if (! $alreadyProcessed && $vAcc) {
                                $vAcc->decrement('current_balance', $paidNow);
                                FinancialTransaction::create([
                                    'tenant_id' => $tenantId,
                                    'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                                    'source_account_id' => $vAcc->id,
                                    'type' => 'supplier_payment',
                                    'amount' => $paidNow,
                                    'fee' => 0,
                                    'contact_id' => $vendorContactId,
                                    'description' => "Vendor payout for brokered item{$accLabel} on Order #{$order->order_number}",
                                    'date' => now(),
                                    'created_by' => $data['salesperson_id'] ?? auth()->id(),
                                ]);
                            }
                        }
                    }

                    if ($remOwed > 0) {
                        Debt::applyOpenAdvancesToPayable($brokeredDebt);
                    }
                } else {
                    // Internal Stock
                    if (! empty($itemData['inventory_unit_id'])) {
                        $unit = InventoryUnit::where('id', $itemData['inventory_unit_id'])
                            ->where('status', 'in_stock')
                            ->first();

                        if (! $unit) {
                            throw new InvalidArgumentException('Selected inventory unit is not available in stock.');
                        }

                        $unitCost = (float) $unit->cost_basis;
                        $unit->update([
                            'status' => 'sold',
                            'sold_at' => now(),
                        ]);

                        // If this was vendor consignment stock, auto-create a payable for the broker's agreed cut
                        if ($unit->source_type === 'consignment' && $unit->supplier_contact_id) {
                            $vendorContactId = $unit->supplier_contact_id;
                            $vendorCost = $unitCost;
                            $sourcingType = 'brokered_neighbour';

                            // Check if a payable debt was already created when the unit was stocked (stock intake)
                            $hasExistingDebt = Debt::where('contact_id', $unit->supplier_contact_id)
                                ->where('reference_type', 'stock_intake')
                                ->where('reference_id', $unit->id)
                                ->exists();

                            $payableAmount = $unitCost * $qty;
                            if (! $hasExistingDebt && $payableAmount > 0) {
                                $newPayable = Debt::create([
                                    'tenant_id' => $tenantId,
                                    'contact_id' => $unit->supplier_contact_id,
                                    'type' => 'payable',
                                    'reference_type' => 'consignment_sale',
                                    'reference_id' => $order->id,
                                    'original_amount' => $payableAmount,
                                    'paid_amount' => 0.0,
                                    'remaining_amount' => $payableAmount,
                                    'due_date' => now()->addDays(7),
                                    'status' => 'open',
                                    'notes' => 'Vendor stock payout for SN: '.($unit->imei_or_serial ?: 'Unit')." in Order #{$order->order_number}. Agreed vendor cut.",
                                ]);

                                Debt::applyOpenAdvancesToPayable($newPayable);
                            }
                        }

                        // Keep aggregated stock in sync
                        $stock = InventoryStock::where('variant_id', $itemData['variant_id'])->first();
                        if ($stock && $stock->quantity_on_hand > 0) {
                            $stock->decrement('quantity_on_hand', 1);
                        }
                    } else {
                        // Quantity stock (non-serialized or bulk units)
                        $stock = InventoryStock::where('variant_id', $itemData['variant_id'])->first();
                        $inStockUnits = InventoryUnit::where('variant_id', $itemData['variant_id'])
                            ->where('status', 'in_stock')
                            ->orderBy('created_at')
                            ->get();

                        $availableCount = max($stock?->quantity_on_hand ?? 0, $inStockUnits->count());
                        if ($availableCount < $qty) {
                            throw new InvalidArgumentException("Requested quantity ({$qty}) exceeds available stock ({$availableCount}).");
                        }

                        // Determine unit cost
                        if ($stock && (float) $stock->average_cost > 0) {
                            $unitCost = (float) $stock->average_cost;
                        } elseif ($inStockUnits->isNotEmpty()) {
                            $unitCost = (float) $inStockUnits->avg('cost_basis');
                        } else {
                            $unitCost = 0.0;
                        }

                        // Decrement InventoryStock
                        if ($stock) {
                            $newQty = max(0, $stock->quantity_on_hand - $qty);
                            $stock->update(['quantity_on_hand' => $newQty]);
                        }

                        // Also mark matching InventoryUnit records as sold if any exist
                        if ($inStockUnits->isNotEmpty()) {
                            $unitsToMarkSold = $inStockUnits->take($qty);
                            if ($qty === 1 && $unitsToMarkSold->count() === 1 && empty($itemData['inventory_unit_id'])) {
                                $itemData['inventory_unit_id'] = $unitsToMarkSold->first()->id;
                            }
                            foreach ($unitsToMarkSold as $u) {
                                $u->update([
                                    'status' => 'sold',
                                    'sold_at' => now(),
                                ]);

                                if ($u->source_type === 'consignment' && $u->supplier_contact_id && (float) $u->cost_basis > 0) {
                                    $hasExistingDebt = Debt::where('contact_id', $u->supplier_contact_id)
                                        ->where('reference_type', 'stock_intake')
                                        ->where('reference_id', $u->id)
                                        ->exists();

                                    if (! $hasExistingDebt) {
                                        $bulkPayable = Debt::create([
                                            'tenant_id' => $tenantId,
                                            'contact_id' => $u->supplier_contact_id,
                                            'type' => 'payable',
                                            'reference_type' => 'consignment_sale',
                                            'reference_id' => $order->id,
                                            'original_amount' => (float) $u->cost_basis,
                                            'paid_amount' => 0.0,
                                            'remaining_amount' => (float) $u->cost_basis,
                                            'due_date' => now()->addDays(7),
                                            'status' => 'open',
                                            'notes' => "Vendor stock payout for unit in Order #{$order->order_number}. Agreed vendor cut.",
                                        ]);

                                        Debt::applyOpenAdvancesToPayable($bulkPayable);
                                    }
                                }
                            }
                        }
                    }
                }

                $rawBonus = $rawItemBonuses[$idx] ?? 0.0;
                $itemBonus = $totalRawBonus > 0 ? round(($rawBonus / $totalRawBonus) * $netOrderBonus, 2) : 0.0;
                $itemSettedPrice = $settedPrices[$idx] ?? $unitPrice;

                // Profit earned by the shop (net of salesperson bonus)
                // Loss-making sales must remain negative. Clamping this to zero
                // hides below-cost sales from the owner and overstates profit.
                $profit = (($unitPrice - $unitCost) * $qty) - $itemBonus;

                $isAccessory = ! empty($itemData['is_accessory']);
                $accessoryName = $itemData['accessory_name'] ?? null;
                $parentItemId = $itemData['parent_item_id'] ?? ($isAccessory ? $primaryItemId : null);

                $createdItem = SalesOrderItem::create([
                    'tenant_id' => $tenantId,
                    'sales_order_id' => $order->id,
                    'variant_id' => $itemData['variant_id'] ?? null,
                    'inventory_unit_id' => $itemData['inventory_unit_id'] ?? null,
                    'is_accessory' => $isAccessory,
                    'accessory_name' => $accessoryName,
                    'parent_item_id' => $parentItemId,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'setted_price' => $itemSettedPrice,
                    'unit_cost' => $unitCost,
                    'profit' => $profit,
                    'bonus_amount' => $itemBonus,
                    'sourcing_type' => $sourcingType,
                    'vendor_contact_id' => $vendorContactId,
                    'vendor_cost' => $vendorCost,
                ]);

                if (! $isAccessory && $primaryItemId === null) {
                    $primaryItemId = $createdItem->id;
                }
            }

            // Record salesperson bonus payable if bonus was earned.
            // Owners do not get a commission payable — their extra margin is business profit,
            // not a staff expense. Owner withdrawals are recorded separately as owner draws.
            if ($netOrderBonus > 0 && $salesperson) {
                if (! $salesperson->isOwner()) {
                    $staffContact = Contact::firstOrCreate(
                        [
                            'tenant_id' => $tenantId,
                            'name' => $salesperson->name,
                        ],
                        [
                            'phone' => $salesperson->phone ?? null,
                            'email' => $salesperson->email ?? null,
                            'roles' => ['staff', 'salesperson'],
                            'is_active' => true,
                        ]
                    );

                    Debt::create([
                        'tenant_id' => $tenantId,
                        'contact_id' => $staffContact->id,
                        'salesperson_id' => $salesperson->id,
                        'type' => 'payable',
                        'reference_type' => 'salesperson_bonus',
                        'reference_id' => $order->id,
                        'original_amount' => $netOrderBonus,
                        'paid_amount' => 0.0,
                        'remaining_amount' => $netOrderBonus,
                        'due_date' => now()->addDays(7),
                        'status' => 'open',
                        'notes' => "Sales bonus for Order #{$order->order_number} by {$salesperson->name}",
                    ]);
                }
            }

            // Record customer receivable if partially paid or unpaid
            if ($unpaidBalance > 0 && ! $intentionalShortfall) {
                if (empty($customerId)) {
                    $walkIn = Contact::firstOrCreate(
                        [
                            'tenant_id' => $tenantId,
                            'name' => 'Walk-in Customer',
                        ],
                        [
                            'roles' => ['customer'],
                            'is_active' => true,
                        ]
                    );
                    $customerId = $walkIn->id;
                    $order->update(['customer_id' => $customerId]);
                }

                Debt::create([
                    'tenant_id' => $tenantId,
                    'contact_id' => $customerId,
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

            // Debt offset settlement against customer/vendor's open payable debt
            if ($debtOffsetAmount > 0 && ! empty($customerId)) {
                $remOffset = $debtOffsetAmount;
                $openPayables = Debt::where('tenant_id', $tenantId)
                    ->where('contact_id', $customerId)
                    ->where('type', 'payable')
                    ->whereIn('status', ['open', 'partially_paid'])
                    ->with('payments')
                    ->orderBy('created_at')
                    ->get();

                $order->loadMissing(['items.variant.product', 'items.inventoryUnit.variant.product']);
                $deviceSummary = $order->items->map(function ($it) {
                    $pName = $it->inventoryUnit?->variant?->product?->name ?? $it->variant?->product?->name ?? 'Device';
                    $sn = $it->inventoryUnit?->imei_or_serial ? " (SN: {$it->inventoryUnit->imei_or_serial})" : '';
                    $uId = $it->inventory_unit_id ? " [unit_id:{$it->inventory_unit_id}]" : '';

                    return "{$pName}{$sn}{$uId}";
                })->filter()->join(', ');

                $offsetNotes = $deviceSummary
                    ? "Handover device: {$deviceSummary}"
                    : "Handover device for Order #{$order->order_number}";

                foreach ($openPayables as $payable) {
                    if ($remOffset <= 0) {
                        break;
                    }
                    $applied = min($remOffset, (float) $payable->remaining_amount);

                    $pmt = DebtPayment::create([
                        'tenant_id' => $tenantId,
                        'debt_id' => $payable->id,
                        'financial_account_id' => null,
                        'amount' => $applied,
                        'payment_date' => now(),
                        'reference_number' => 'BILATERAL-OFFSET',
                        'notes' => $offsetNotes,
                        'created_by' => $data['salesperson_id'] ?? auth()->id(),
                    ]);

                    $payable->payments->push($pmt);
                    $payable->recalculateSettlement();

                    $remOffset -= $applied;
                }
            }

            // Credit financial account(s) if bank cash was received
            if ($bankCashReceived > 0) {
                if ($enrichedSplits) {
                    $splits = $enrichedSplits;
                } elseif (! empty($primaryAccountId)) {
                    $splits = [
                        [
                            'financial_account_id' => $primaryAccountId,
                            'amount' => $bankCashReceived,
                        ],
                    ];
                } else {
                    $splits = [];
                }

                foreach ($splits as $split) {
                    $splitAmount = (float) ($split['amount'] ?? 0);
                    if ($splitAmount <= 0) {
                        continue;
                    }
                    $account = FinancialAccount::findOrFail($split['financial_account_id']);
                    $account->increment('current_balance', $splitAmount);

                    FinancialTransaction::create([
                        'tenant_id' => $tenantId,
                        'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                        'destination_account_id' => $account->id,
                        'type' => 'customer_payment',
                        'amount' => $splitAmount,
                        'reference_number' => $split['reference_number'] ?? null,
                        'contact_id' => $customerId,
                        'description' => count($splits) > 1
                            ? "Payment received for Order #{$order->order_number} ({$account->name})"
                            : "Payment received for Order #{$order->order_number}",
                        'date' => now(),
                        'created_by' => auth()->id(),
                    ]);
                }
            }

            $soldUnitIds = [];
            foreach ($data['items'] as $it) {
                if (! empty($it['inventory_unit_id'])) {
                    $soldUnitIds[] = $it['inventory_unit_id'];
                }
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
                    'sold_unit_ids' => $soldUnitIds,
                    'exchange_unit_id' => $order->exchange_unit_id,
                ],
                oldValues: [
                    'sold_units_count' => count($soldUnitIds),
                ],
                userId: $data['salesperson_id'] ?? auth()->id(),
                revertGroupId: $revertGroupId
            );

            return $order->load([
                'customer',
                'salesperson',
                'financialAccount',
                'exchangeUnit.variant.product',
                'items.variant.product',
                'items.inventoryUnit',
                'items.vendorContact',
            ]);
        });
    }
}
