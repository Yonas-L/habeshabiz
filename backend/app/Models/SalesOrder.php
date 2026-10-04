<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalesOrder extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

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
        'exchange_unit_id',
        'is_vendor_sourced',
        'vendor_contact_id',
        'vendor_cost_basis',
        'vendor_payment_status',
        'notes',
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
        return $this->belongsTo(User::class, 'salesperson_id');
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
}
