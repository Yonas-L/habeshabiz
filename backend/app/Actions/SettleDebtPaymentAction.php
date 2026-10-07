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
use App\Scopes\TenantScope;
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

            $account = FinancialAccount::findOrFail($data['financial_account_id']);

            $payment = DebtPayment::create([
                'tenant_id' => $tenantId,
                'debt_id' => $debt->id,
                'financial_account_id' => $account->id,
                'amount' => $amount,
                'payment_date' => $data['payment_date'] ?? now(),
                'reference_number' => $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => auth()->id(),
            ]);

            // Update debt amounts
            $debt->recalculateSettlement();

            // If this was a handover holding debt and now fully settled, auto-mark unit as sold
            if ($debt->reference_type === 'handover_holding' && $debt->status === 'settled' && ! empty($debt->reference_id)) {
                $unit = InventoryUnit::find($debt->reference_id);
                if ($unit && $unit->status === 'out') {
                    $vendorName = $unit->handover_to ?? 'Vendor/Broker';
                    $unit->update([
                        'status' => 'sold',
                        'sold_at' => now(),
                        'location' => "Sold by {$vendorName}",
                    ]);

                    $stock = InventoryStock::where('variant_id', $unit->variant_id)->first();
                    if ($stock && $stock->quantity_on_hand > 0) {
                        $stock->decrement('quantity_on_hand', 1);
                    }

                    (new \App\Actions\SynchronizeInventoryStockAction())->execute();

                    AuditLog::record(
                        action: 'unit_sold_via_debt_collection',
                        entityType: 'InventoryUnit',
                        entityId: (string) $unit->id,
                        newValues: [
                            'imei_or_serial' => $unit->imei_or_serial,
                            'handover_to' => $unit->handover_to,
                            'settled_amount' => $debt->paid_amount,
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

            $contactName = $debt->contact instanceof Contact ? $debt->contact->name : 'Contact';

            // If Receivable: Customer is paying us -> money enters our account
            if ($debt->isReceivable()) {
                $account->increment('current_balance', $amount);

                FinancialTransaction::create([
                    'tenant_id' => $tenantId,
                    'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                    'destination_account_id' => $account->id,
                    'type' => 'customer_payment',
                    'amount' => $amount,
                    'reference_number' => $data['reference_number'] ?? null,
                    'contact_id' => $debt->contact_id,
                    'description' => "Debt payment received from {$contactName}",
                    'date' => now(),
                    'created_by' => auth()->id(),
                ]);
            }

            // If Payable: We are paying supplier/peer vendor -> money leaves our account
            if ($debt->isPayable()) {
                $fee = $account->calculateOutgoingFee($amount, isset($data['fee']) ? (float) $data['fee'] : null);
                $totalDeduction = $amount + $fee;

                if ((float) $account->current_balance < $totalDeduction) {
                    throw new InvalidArgumentException("Insufficient balance in account '{$account->name}'. Available: " . number_format($account->current_balance, 2) . " ETB, Required: " . number_format($totalDeduction, 2) . " ETB (including fee).");
                }
                $account->decrement('current_balance', $totalDeduction);

                FinancialTransaction::create([
                    'tenant_id' => $tenantId,
                    'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                    'source_account_id' => $account->id,
                    'type' => 'supplier_payment',
                    'amount' => $amount,
                    'fee' => $fee,
                    'reference_number' => $data['reference_number'] ?? null,
                    'contact_id' => $debt->contact_id,
                    'description' => "Debt payment to supplier {$contactName}",
                    'date' => now(),
                    'created_by' => auth()->id(),
                ]);
            }

            return $payment;
        });
    }
}
