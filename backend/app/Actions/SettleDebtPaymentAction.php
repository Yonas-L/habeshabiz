<?php

namespace App\Actions;

use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
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
            $newPaid = (float) $debt->paid_amount + $amount;
            $newRemaining = (float) $debt->original_amount - $newPaid;
            $status = $newRemaining <= 0 ? 'settled' : 'partially_paid';

            $debt->update([
                'paid_amount' => $newPaid,
                'remaining_amount' => max(0, $newRemaining),
                'status' => $status,
            ]);

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
                $account->decrement('current_balance', $amount);

                FinancialTransaction::create([
                    'tenant_id' => $tenantId,
                    'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                    'source_account_id' => $account->id,
                    'type' => 'supplier_payment',
                    'amount' => $amount,
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
