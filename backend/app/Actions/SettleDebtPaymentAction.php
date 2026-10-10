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
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\User;
use App\Scopes\TenantScope;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class SettleDebtPaymentAction
{
    /**
     * @param  array{
     *     amount: float|int,
     *     financial_account_id: string,
     *     payment_date?: string|null,
     *     reference_number?: string|null,
     *     notes?: string|null
     * }  $data
     */
    public function execute(Debt $debt, array $data): DebtPayment
    {
        return DB::transaction(function () use ($debt, $data) {
            $tenantId = TenantScope::getActiveTenantId() ?? $debt->tenant_id;
            $amount = (float) $data['amount'];

            if ($amount <= 0) {
                throw new InvalidArgumentException('Payment amount must be greater than zero.');
            }

            if ($amount > (float) $debt->remaining_amount) {
                throw new InvalidArgumentException("Payment amount ({$amount}) exceeds remaining balance ({$debt->remaining_amount}).");
            }

            $rawSplits = $data['payment_splits'] ?? $data['splits'] ?? null;
            if (is_array($rawSplits) && count($rawSplits) > 0) {
                $splits = $rawSplits;
                $splitSum = (float) collect($splits)->sum(fn ($s) => (float) ($s['amount'] ?? 0));
                if (abs($splitSum - $amount) > 0.01) {
                    throw new InvalidArgumentException("Split allocation total (".number_format($splitSum, 2)." ETB) does not match payment amount (".number_format($amount, 2)." ETB).");
                }
            } else {
                if (empty($data['financial_account_id'])) {
                    throw new InvalidArgumentException('A financial account or payment splits must be provided.');
                }
                $splits = [
                    [
                        'financial_account_id' => $data['financial_account_id'],
                        'amount' => $amount,
                        'reference_number' => $data['reference_number'] ?? null,
                    ],
                ];
            }

            $splitGroupId = count($splits) > 1 ? (string) Str::uuid() : null;
            $contactName = $debt->contact instanceof Contact ? $debt->contact->name : 'Contact';
            $createdPayments = [];

            foreach ($splits as $split) {
                $splitAmount = (float) ($split['amount'] ?? 0);
                if ($splitAmount <= 0) {
                    throw new InvalidArgumentException('Payment split amount must be greater than zero.');
                }

                $account = FinancialAccount::findOrFail($split['financial_account_id']);
                $refNumber = $split['reference_number'] ?? $data['reference_number'] ?? null;
                $splitNotes = count($splits) > 1
                    ? trim(($data['notes'] ?? '')." (Split via {$account->name}: ".number_format($splitAmount, 2)." ETB)")
                    : ($data['notes'] ?? null);

                $payment = DebtPayment::create([
                    'tenant_id' => $tenantId,
                    'debt_id' => $debt->id,
                    'split_group_id' => $splitGroupId,
                    'financial_account_id' => $account->id,
                    'amount' => $splitAmount,
                    'payment_date' => $data['payment_date'] ?? now(),
                    'reference_number' => $refNumber,
                    'notes' => $splitNotes,
                    'created_by' => auth()->id(),
                ]);
                $createdPayments[] = $payment;

                // If Receivable: Customer is paying us -> money enters our account
                if ($debt->isReceivable()) {
                    $account->increment('current_balance', $splitAmount);

                    FinancialTransaction::create([
                        'tenant_id' => $tenantId,
                        'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                        'destination_account_id' => $account->id,
                        'type' => 'customer_payment',
                        'amount' => $splitAmount,
                        'reference_number' => $refNumber,
                        'contact_id' => $debt->contact_id,
                        'description' => count($splits) > 1
                            ? "Debt payment received from {$contactName} (Split via {$account->name})"
                            : "Debt payment received from {$contactName}",
                        'date' => now(),
                        'created_by' => auth()->id(),
                    ]);
                }

                // If Payable: We are paying supplier/peer vendor -> money leaves our account
                if ($debt->isPayable()) {
                    $fee = $account->calculateOutgoingFee($splitAmount, isset($split['fee']) ? (float) $split['fee'] : (isset($data['fee']) ? (float) $data['fee'] : null));
                    $totalDeduction = $splitAmount + $fee;

                    if ((float) $account->current_balance < $totalDeduction) {
                        throw new InvalidArgumentException("Insufficient balance in account '{$account->name}'. Available: ".number_format((float) $account->current_balance, 2)." ETB, Required: ".number_format($totalDeduction, 2)." ETB (including fee).");
                    }
                    $account->decrement('current_balance', $totalDeduction);

                    FinancialTransaction::create([
                        'tenant_id' => $tenantId,
                        'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                        'source_account_id' => $account->id,
                        'type' => 'supplier_payment',
                        'amount' => $splitAmount,
                        'fee' => $fee,
                        'reference_number' => $refNumber,
                        'contact_id' => $debt->contact_id,
                        'description' => count($splits) > 1
                            ? "Debt payment to supplier {$contactName} (Split via {$account->name})"
                            : "Debt payment to supplier {$contactName}",
                        'date' => now(),
                        'created_by' => auth()->id(),
                    ]);
                }
            }

            // Update debt amounts
            $debt->recalculateSettlement();

            // If this was a handover holding debt and payment is made, auto-mark unit as sold and record sales order
            if ($debt->reference_type === 'handover_holding' && ! empty($debt->reference_id)) {
                $unit = InventoryUnit::find($debt->reference_id);
                if ($unit) {
                    $vendorName = $unit->handover_to ?? ($debt->contact?->name ?? 'Vendor/Broker');

                    // If unit was out on handover or in stock, transition status to sold
                    if ($unit->status === 'out' || $unit->status === 'in_stock') {
                        $unit->update([
                            'status' => 'sold',
                            'sold_at' => $data['payment_date'] ?? now(),
                            'location' => "Sold by {$vendorName}",
                        ]);

                        $stock = InventoryStock::where('variant_id', $unit->variant_id)->first();
                        if ($stock && $stock->quantity_on_hand > 0) {
                            $stock->decrement('quantity_on_hand', 1);
                        }

                        (new SynchronizeInventoryStockAction)->execute();
                    }

                    // Ensure SalesOrder and SalesOrderItem exist and are synchronized
                    $orderItem = SalesOrderItem::where('inventory_unit_id', $unit->id)->first();
                    $finalPrice = (float) $unit->selling_price > 0
                        ? (float) $unit->selling_price
                        : (float) $debt->original_amount;
                    if ($finalPrice <= 0) {
                        $finalPrice = (float) $debt->original_amount;
                    }

                    $orderPaid = (float) $debt->paid_amount;
                    $paymentStatus = $debt->status === 'settled' ? 'paid' : 'partial';

                    if (! $orderItem) {
                        $customerContact = $debt->contact;
                        if (! $customerContact && ! empty($unit->handover_to)) {
                            $customerContact = Contact::where('tenant_id', $tenantId)
                                ->where('name', 'ilike', $unit->handover_to)
                                ->first();
                        }

                        $salespersonId = auth()->id() ?? User::where('tenant_id', $tenantId)->first()?->id;

                        $payDate = now();
                        if (! empty($data['payment_date'])) {
                            $parsed = Carbon::parse($data['payment_date']);
                            $payDate = $parsed->isSameDay(now()) ? now() : $parsed->setTime(now()->hour, now()->minute, now()->second);
                        }

                        $payMethod = 'bank_transfer';
                        if (! empty($data['financial_account_id'])) {
                            $acc = FinancialAccount::find($data['financial_account_id']);
                            $payMethod = match ($acc?->type) {
                                'cash' => 'cash',
                                'mobile_money' => 'mobile_money',
                                default => 'bank_transfer',
                            };
                        }

                        $orderNumber = 'SO-'.strtoupper(Str::random(8));
                        $order = SalesOrder::create([
                            'tenant_id' => $tenantId,
                            'order_number' => $orderNumber,
                            'customer_id' => $customerContact?->id ?? $debt->contact_id,
                            'salesperson_id' => $salespersonId,
                            'total_amount' => $finalPrice,
                            'paid_amount' => $orderPaid,
                            'payment_method' => $payMethod,
                            'payment_status' => $paymentStatus,
                            'credit_sale' => $debt->status !== 'settled',
                            'order_date' => $payDate,
                            'notes' => "Handover sale to {$vendorName} collected via debt payment [unit_id:{$unit->id}]",
                        ]);

                        $costBasis = (float) $unit->cost_basis;
                        $profit = max(0, $finalPrice - $costBasis);

                        SalesOrderItem::create([
                            'tenant_id' => $tenantId,
                            'sales_order_id' => $order->id,
                            'variant_id' => $unit->variant_id,
                            'inventory_unit_id' => $unit->id,
                            'quantity' => 1,
                            'unit_price' => $finalPrice,
                            'unit_cost' => $costBasis,
                            'profit' => $profit,
                            'sourcing_type' => 'internal_stock',
                        ]);
                    } else {
                        // Keep existing order in sync with debt settlement
                        $existingOrder = $orderItem->salesOrder;
                        if ($existingOrder) {
                            $existingOrder->update([
                                'paid_amount' => $orderPaid,
                                'payment_status' => $paymentStatus,
                                'credit_sale' => $debt->status !== 'settled',
                            ]);
                        }
                    }

                    AuditLog::record(
                        action: 'unit_sold_via_debt_collection',
                        entityType: 'InventoryUnit',
                        entityId: (string) $unit->id,
                        newValues: [
                            'imei_or_serial' => $unit->imei_or_serial,
                            'handover_to' => $unit->handover_to,
                            'settled_amount' => $debt->paid_amount,
                            'status' => $unit->status,
                        ]
                    );
                }
            }

            // If linked to a sales order, keep sales order paid_amount and payment_status in sync
            if ($debt->reference_type === 'sales_order' && ! empty($debt->reference_id)) {
                $order = \App\Models\SalesOrder::find($debt->reference_id);
                if ($order) {
                    $orderPaid = (float) $order->paid_amount + $amount;
                    $orderRemaining = max(0, (float) $order->total_amount - $orderPaid);
                    $order->update([
                        'paid_amount' => $orderPaid,
                        'payment_status' => $orderRemaining <= 0 ? 'paid' : 'partial',
                    ]);
                }
            }

            return $createdPayments[0] ?? $payment;
        });
    }
}
