<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceRecord extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'inventory_unit_id',
        'cost',
        'is_capitalized',
        'billing_type',
        'vendor_contact_id',
        'vendor_debt_id',
        'financial_account_id',
        'payment_splits',
        'description',
        'date',
    ];

    protected function casts(): array
    {
        return [
            'cost' => 'decimal:2',
            'is_capitalized' => 'boolean',
            'payment_splits' => 'array',
            'date' => 'datetime',
        ];
    }

    public function inventoryUnit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class);
    }

    public function financialAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class)->withTrashed();
    }

    public function vendorContact(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'vendor_contact_id')->withTrashed();
    }

    public function vendorDebt(): BelongsTo
    {
        return $this->belongsTo(Debt::class, 'vendor_debt_id');
    }
}
