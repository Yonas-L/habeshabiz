<?php

namespace App\Actions;

use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class OffsetStaffBonusDebtAction
{
    /**
     * Use open salesperson commission bonus payables to settle an open receivable debt.
     *
     * @param  array{
     *     amount: float|int,
     *     receivable_debt_id: string,
     *     notes?: string|null
     * }  $data
     * @return array{
     *     bonus_debts: Debt[],
     *     receivable_debt: Debt,
     *     bonus_payments: DebtPayment[],
     *     receivable_payment: DebtPayment,
     *     amount_offset: float
     * }
     */
    public function execute(User $staff, array $data): array
    {
        return DB::transaction(function () use ($staff, $data) {
            $tenantId = TenantScope::getActiveTenantId() ?? $staff->tenant_id;
            $amount = round((float) ($data['amount'] ?? 0), 2);

            if ($amount <= 0) {
                throw new InvalidArgumentException('Offset amount must be greater than zero.');
            }

            if (empty($data['receivable_debt_id'])) {
                throw new InvalidArgumentException('Receivable debt ID is required for debt offset.');
            }

            /** @var Debt|null $receivableDebt */
            $receivableDebt = Debt::with(['contact', 'salesOrder'])
                ->where('tenant_id', $tenantId)
                ->where('type', 'receivable')
                ->whereIn('status', ['open', 'partially_paid'])
                ->find($data['receivable_debt_id']);

            if (! $receivableDebt) {
                throw new InvalidArgumentException('The selected receivable debt was not found or is already fully settled.');
            }

            $receivableRemaining = round((float) $receivableDebt->remaining_amount, 2);
            if ($amount > $receivableRemaining + 0.01) {
                throw new InvalidArgumentException(
                    'Offset amount ('.number_format($amount, 2).' ETB) exceeds remaining receivable balance ('.number_format($receivableRemaining, 2).' ETB).'
                );
            }

            // Find all open salesperson bonus debts for this staff member (FIFO order)
            $openBonusDebts = Debt::where('tenant_id', $tenantId)
                ->where('salesperson_id', $staff->id)
                ->where('reference_type', 'salesperson_bonus')
                ->whereIn('status', ['open', 'partially_paid'])
                ->orderBy('created_at', 'asc')
                ->get();

            $totalOpenBonus = round((float) $openBonusDebts->sum('remaining_amount'), 2);
            if ($totalOpenBonus <= 0) {
                throw new InvalidArgumentException("{$staff->name} has no open salesperson commission bonuses to offset.");
            }

            if ($amount > $totalOpenBonus + 0.01) {
                throw new InvalidArgumentException(
                    'Offset amount ('.number_format($amount, 2).' ETB) exceeds available open bonus balance ('.number_format($totalOpenBonus, 2).' ETB).'
                );
            }

            $remToAllocate = $amount;
            $createdBonusPayments = [];
            $updatedBonusDebts = [];
            $contactName = $receivableDebt->contact?->name ?? 'Customer';
            $userNotes = ! empty($data['notes']) && ! str_starts_with(trim($data['notes']), 'Commission bonus payout') ? ' | '.trim($data['notes']) : '';

            // 1. Consume from bonus debts sequentially (FIFO)
            foreach ($openBonusDebts as $bDebt) {
                if ($remToAllocate <= 0.001) {
                    break;
                }

                $bRemaining = (float) $bDebt->remaining_amount;
                $alloc = min($remToAllocate, $bRemaining);
                if ($alloc <= 0) {
                    continue;
                }

                $refNum = ! empty($data['reference_number'])
                    ? $data['reference_number']
                    : "BONUS-OFFSET-REC";

                $customNotes = ! empty($data['notes']) && ! str_starts_with(trim($data['notes']), 'Commission bonus payout')
                    ? ': '.trim($data['notes'])
                    : '';

                $bonusPayment = DebtPayment::create([
                    'tenant_id' => $tenantId,
                    'debt_id' => $bDebt->id,
                    'financial_account_id' => null,
                    'amount' => $alloc,
                    'payment_date' => $data['payment_date'] ?? now(),
                    'reference_number' => $refNum,
                    'notes' => "Used for debt: Settled receivable for {$contactName}{$customNotes}",
                    'created_by' => auth()->id(),
                ]);
                $createdBonusPayments[] = $bonusPayment;

                $newPaid = (float) $bDebt->paid_amount + $alloc;
                $newRem = max(0, (float) $bDebt->original_amount - $newPaid);
                $newStatus = $newRem <= 0.001 ? 'settled' : 'partially_paid';

                $bDebt->update([
                    'paid_amount' => $newPaid,
                    'remaining_amount' => $newRem,
                    'status' => $newStatus,
                ]);

                $updatedBonusDebts[] = $bDebt;
                $remToAllocate -= $alloc;
            }

            // 2. Apply settlement to the receivable debt
            $recPayment = DebtPayment::create([
                'tenant_id' => $tenantId,
                'debt_id' => $receivableDebt->id,
                'financial_account_id' => null,
                'amount' => $amount,
                'payment_date' => $data['payment_date'] ?? now(),
                'reference_number' => $data['reference_number'] ?? "OFFSET-STAFF-BONUS-{$staff->id}",
                'notes' => "Settled via {$staff->name}'s commission bonus{$userNotes}",
                'created_by' => auth()->id(),
            ]);

            $newRecPaid = (float) $receivableDebt->paid_amount + $amount;
            $newRecRem = max(0, (float) $receivableDebt->original_amount - $newRecPaid);
            $newRecStatus = $newRecRem <= 0.001 ? 'settled' : 'partially_paid';

            $receivableDebt->update([
                'paid_amount' => $newRecPaid,
                'remaining_amount' => $newRecRem,
                'status' => $newRecStatus,
            ]);

            // Sync linked sales order if applicable
            if ($receivableDebt->reference_type === 'sales_order') {
                $receivableDebt->syncLinkedSalesOrder();
            }

            // 3. Log user activity / audit log (revertable)
            $firstBonusPayment = $createdBonusPayments[0];
            AuditLog::record(
                action: 'bonus_used_for_debt',
                entityType: 'DebtPayment',
                entityId: (string) $firstBonusPayment->id,
                newValues: [
                    'staff_id' => $staff->id,
                    'staff_name' => $staff->name,
                    'receivable_debt_id' => $receivableDebt->id,
                    'receivable_contact_name' => $contactName,
                    'amount' => $amount,
                    'bonus_payment_ids' => array_map(fn ($p) => $p->id, $createdBonusPayments),
                    'receivable_payment_id' => $recPayment->id,
                    'bonus_debt_ids' => array_map(fn ($d) => $d->id, $updatedBonusDebts),
                    'notes' => $data['notes'] ?? null,
                    'paid_by' => auth()->user()?->name ?? 'Owner',
                    'settled_at' => now()->toIso8601String(),
                ]
            );

            return [
                'bonus_debts' => $updatedBonusDebts,
                'receivable_debt' => $receivableDebt->fresh(['contact', 'payments']),
                'bonus_payments' => $createdBonusPayments,
                'receivable_payment' => $recPayment,
                'amount_offset' => $amount,
            ];
        });
    }
}
