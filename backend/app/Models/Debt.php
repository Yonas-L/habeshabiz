<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Debt extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'contact_id',
        'salesperson_id',
        'type',
        'reference_type',
        'reference_id',
        'original_amount',
        'paid_amount',
        'remaining_amount',
        'due_date',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'original_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
            'due_date' => 'date',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class)->withTrashed();
    }

    public function salesperson(): BelongsTo
    {
        return $this->belongsTo(User::class, 'salesperson_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(DebtPayment::class);
    }

    public function isReceivable(): bool
    {
        return $this->type === 'receivable';
    }

    public function isPayable(): bool
    {
        return $this->type === 'payable';
    }

    public function isSettled(): bool
    {
        return $this->status === 'settled';
    }

    public static function applyOpenAdvancesToPayable(self $payableDebt): void
    {
        if ($payableDebt->type !== 'payable' || (float) $payableDebt->remaining_amount <= 0) {
            return;
        }

        $advances = self::where('tenant_id', $payableDebt->tenant_id)
            ->where('contact_id', $payableDebt->contact_id)
            ->where('type', 'receivable')
            ->where('reference_type', 'vendor_advance_payout')
            ->whereIn('status', ['open', 'partially_paid'])
            ->orderBy('created_at')
            ->get();

        foreach ($advances as $advance) {
            if ((float) $payableDebt->remaining_amount <= 0) {
                break;
            }

            $offsetAmount = min((float) $advance->remaining_amount, (float) $payableDebt->remaining_amount);

            $expense = ! empty($advance->reference_id) ? Expense::find($advance->reference_id) : null;
            $accountId = $expense?->financial_account_id;

            DebtPayment::create([
                'tenant_id' => $payableDebt->tenant_id,
                'debt_id' => $payableDebt->id,
                'financial_account_id' => $accountId,
                'amount' => $offsetAmount,
                'payment_date' => $advance->created_at ?? now(),
                'reference_number' => $expense ? "EXP-{$expense->id}" : 'ADVANCE-OFFSET',
                'notes' => "Offset against vendor advance payout ({$advance->notes})",
                'created_by' => auth()->id(),
            ]);

            $newPayablePaid = (float) $payableDebt->paid_amount + $offsetAmount;
            $newPayableRemaining = max(0, (float) $payableDebt->original_amount - $newPayablePaid);
            $payableDebt->update([
                'paid_amount' => $newPayablePaid,
                'remaining_amount' => $newPayableRemaining,
                'status' => $newPayableRemaining <= 0 ? 'settled' : 'partially_paid',
            ]);

            $newAdvancePaid = (float) $advance->paid_amount + $offsetAmount;
            $newAdvanceRemaining = max(0, (float) $advance->original_amount - $newAdvancePaid);
            $advance->update([
                'paid_amount' => $newAdvancePaid,
                'remaining_amount' => $newAdvanceRemaining,
                'status' => $newAdvanceRemaining <= 0 ? 'settled' : 'partially_paid',
            ]);
        }
    }

    /**
     * Atomically reconcile and offset open mutual obligations (receivables vs payables) for a single contact.
     */
    public static function reconcileContactMutualDebts(string $tenantId, string $contactId): void
    {
        $openReceivables = self::where('tenant_id', $tenantId)
            ->where('contact_id', $contactId)
            ->where('type', 'receivable')
            ->where('reference_type', '!=', 'handover_holding')
            ->whereIn('status', ['open', 'partially_paid'])
            ->orderBy('created_at')
            ->get();

        $openPayables = self::where('tenant_id', $tenantId)
            ->where('contact_id', $contactId)
            ->where('type', 'payable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->orderBy('created_at')
            ->get();

        if ($openReceivables->isEmpty() || $openPayables->isEmpty()) {
            return;
        }

        $userId = auth()->id() ?? User::where('tenant_id', $tenantId)->where('role', 'owner')->value('id');

        foreach ($openReceivables as $rec) {
            if ((float) $rec->remaining_amount <= 0) {
                continue;
            }

            foreach ($openPayables as $pay) {
                if ((float) $rec->remaining_amount <= 0) {
                    break;
                }
                if ((float) $pay->remaining_amount <= 0) {
                    continue;
                }

                $offsetAmount = min((float) $rec->remaining_amount, (float) $pay->remaining_amount);
                if ($offsetAmount <= 0) {
                    continue;
                }

                // Downstream payment record on payable
                DebtPayment::create([
                    'tenant_id' => $tenantId,
                    'debt_id' => $pay->id,
                    'financial_account_id' => null,
                    'amount' => $offsetAmount,
                    'payment_date' => now(),
                    'reference_number' => "OFFSET-{$rec->id}",
                    'notes' => 'Mutual credit offset against receivable obligation',
                    'created_by' => $userId,
                ]);

                $newPayPaid = (float) $pay->paid_amount + $offsetAmount;
                $newPayRem = max(0, (float) $pay->original_amount - $newPayPaid);
                $pay->update([
                    'paid_amount' => $newPayPaid,
                    'remaining_amount' => $newPayRem,
                    'status' => $newPayRem <= 0 ? 'settled' : 'partially_paid',
                ]);

                // Downstream payment record on receivable
                DebtPayment::create([
                    'tenant_id' => $tenantId,
                    'debt_id' => $rec->id,
                    'financial_account_id' => null,
                    'amount' => $offsetAmount,
                    'payment_date' => now(),
                    'reference_number' => 'MUTUAL-OFFSET',
                    'notes' => 'Applied against open payable debt',
                    'created_by' => $userId,
                ]);

                $newRecPaid = (float) $rec->paid_amount + $offsetAmount;
                $newRecRem = max(0, (float) $rec->original_amount - $newRecPaid);
                $rec->update([
                    'paid_amount' => $newRecPaid,
                    'remaining_amount' => $newRecRem,
                    'status' => $newRecRem <= 0 ? 'settled' : 'partially_paid',
                ]);
            }
        }
    }

    /**
     * Identify any contacts who have overlapping open receivables and payables, and reconcile them automatically.
     */
    public static function reconcileAllMutualDebtsForTenant(string $tenantId): void
    {
        $contactIds = self::where('tenant_id', $tenantId)
            ->whereIn('status', ['open', 'partially_paid'])
            ->where('reference_type', '!=', 'handover_holding')
            ->whereNotNull('contact_id')
            ->select('contact_id')
            ->groupBy('contact_id')
            ->havingRaw('COUNT(DISTINCT type) > 1')
            ->pluck('contact_id');

        foreach ($contactIds as $contactId) {
            self::reconcileContactMutualDebts($tenantId, (string) $contactId);
        }
    }
}
