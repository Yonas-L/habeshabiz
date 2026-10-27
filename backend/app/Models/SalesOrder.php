<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $tenant_id
 * @property string $order_number
 * @property string|null $customer_id
 * @property int|null $salesperson_id
 * @property string|float $total_amount
 * @property string|float $paid_amount
 * @property string|null $payment_status
 * @property string|null $financial_account_id
 * @property array<int, array<string, mixed>>|null $payment_splits
 * @property string|null $exchange_unit_id
 * @property string|float $exchange_allowance
 * @property Carbon|string|null $order_date
 * @property Carbon|string|null $created_at
 * @property-read Contact|null $customer
 * @property-read User|null $salesperson
 * @property-read FinancialAccount|null $financialAccount
 * @property-read InventoryUnit|null $exchangeUnit
 * @property-read Collection<int, SalesOrderItem> $items
 */
class SalesOrder extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $appends = ['bonus_info'];

    protected $fillable = [
        'tenant_id',
        'order_number',
        'customer_id',
        'salesperson_id',
        'total_amount',
        'discount_amount',
        'write_off_amount',
        'exchange_allowance',
        'total_bonus_amount',
        'paid_amount',
        'payment_status',
        'credit_sale',
        'payment_method',
        'financial_account_id',
        'payment_splits',
        'exchange_unit_id',
        'is_vendor_sourced',
        'vendor_contact_id',
        'vendor_cost_basis',
        'vendor_payment_status',
        'notes',
        'signature_stamp_config',
        'order_date',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'write_off_amount' => 'decimal:2',
            'exchange_allowance' => 'decimal:2',
            'total_bonus_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'credit_sale' => 'boolean',
            'is_vendor_sourced' => 'boolean',
            'payment_splits' => 'array',
            'signature_stamp_config' => 'array',
            'vendor_cost_basis' => 'decimal:2',
            'order_date' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'customer_id')->withTrashed();
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'vendor_contact_id')->withTrashed();
    }

    public function salesperson(): BelongsTo
    {
        return $this->belongsTo(User::class, 'salesperson_id')->withTrashed();
    }

    public function financialAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'financial_account_id')->withTrashed();
    }

    public function exchangeUnit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class, 'exchange_unit_id')->withTrashed();
    }

    public function items(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class, 'sales_order_id');
    }

    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class, 'reference_id')->where('reference_type', 'sales_order');
    }

    public function bonusDebts(): HasMany
    {
        return $this->hasMany(Debt::class, 'reference_id')->where('reference_type', 'salesperson_bonus');
    }

    public function getBonusInfoAttribute(): ?array
    {
        if (! $this->relationLoaded('bonusDebts')) {
            $this->load('bonusDebts.payments');
        }

        $bDebt = $this->bonusDebts->first();
        if (! $bDebt && (float) $this->total_bonus_amount <= 0) {
            return null;
        }

        $usedForDebt = false;
        $offsetNotes = null;

        if ($bDebt) {
            foreach ($bDebt->payments as $p) {
                if (str_contains($p->reference_number ?? '', 'BONUS-OFFSET') || str_contains($p->notes ?? '', 'Used for debt')) {
                    $usedForDebt = true;
                    $offsetNotes = $p->notes;
                    break;
                }
            }
        }

        $bonusAmount = $bDebt ? (float) $bDebt->original_amount : (float) ($this->total_bonus_amount ?? 0);
        $paidAmount = $bDebt ? (float) $bDebt->paid_amount : 0.0;
        $remainingAmount = $bDebt ? (float) $bDebt->remaining_amount : $bonusAmount;
        $status = $usedForDebt
            ? 'used_for_debt'
            : ($bDebt ? ($bDebt->status === 'settled' ? 'disbursed' : 'uncollected') : 'uncollected');

        return [
            'bonus_amount' => $bonusAmount,
            'paid_amount' => $paidAmount,
            'remaining_amount' => $remainingAmount,
            'status' => $status,
            'used_for_debt' => $usedForDebt,
            'offset_notes' => $offsetNotes,
        ];
    }
}
