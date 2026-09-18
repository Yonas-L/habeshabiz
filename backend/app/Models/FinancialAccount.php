<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinancialAccount extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'name',
        'type',
        'account_number',
        'currency',
        'current_balance',
        'is_custom_asset',
        'asset_details',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'current_balance' => 'decimal:2',
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
}
