<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class FinancialAccount extends Model
{
    use BelongsToTenant, HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'name',
        'type',
        'account_number',
        'currency',
        'logo',
        'current_balance',
        'default_fee_type',
        'default_fee_amount',
        'is_custom_asset',
        'asset_details',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'current_balance' => 'decimal:2',
            'default_fee_amount' => 'decimal:4',
            'is_custom_asset' => 'boolean',
            'asset_details' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function sourceTransactions(): HasMany
    {
        return $this->hasMany(FinancialTransaction::class, 'source_account_id');
    }

    public function destinationTransactions(): HasMany
    {
        return $this->hasMany(FinancialTransaction::class, 'destination_account_id');
    }

    public function debtPayments(): HasMany
    {
        return $this->hasMany(DebtPayment::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function calculateOutgoingFee(float|int $amount, ?float $overrideFee = null): float
    {
        if ($overrideFee !== null) {
            return max(0.0, (float) $overrideFee);
        }

        if (! $this->default_fee_type || $this->default_fee_type === 'none') {
            return 0.0;
        }

        $rate = (float) ($this->default_fee_amount ?? 0);
        if ($rate <= 0) {
            return 0.0;
        }

        if ($this->default_fee_type === 'fixed') {
            return round($rate, 2);
        }

        if ($this->default_fee_type === 'percentage') {
            return round(((float) $amount * $rate) / 100, 2);
        }

        return 0.0;
    }
}
