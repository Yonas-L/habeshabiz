<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contact extends Model
{
    use BelongsToTenant, HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'name',
        'phone',
        'alt_phone',
        'email',
        'roles',
        'notes',
        'is_active',
        'statement_token',
    ];

    protected $appends = [
        'net_balance',
        'open_receivable',
        'open_payable',
    ];

    protected static function booted(): void
    {
        static::creating(function (Contact $contact) {
            if (empty($contact->statement_token)) {
                $contact->statement_token = \Illuminate\Support\Str::random(32);
            }
        });
    }

    protected function casts(): array
    {
        return [
            'roles' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->roles ?? [], true);
    }

    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class);
    }

    public function salesOrders(): HasMany
    {
        return $this->hasMany(SalesOrder::class, 'customer_id');
    }

    public function brokeredItems(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class, 'vendor_contact_id');
    }

    public function suppliedUnits(): HasMany
    {
        return $this->hasMany(InventoryUnit::class, 'supplier_contact_id');
    }

    public function getOpenReceivableAttribute(): float
    {
        $open = $this->relationLoaded('debts')
            ? (float) $this->debts
                ->where('type', 'receivable')
                ->whereIn('status', ['open', 'partially_paid'])
                ->sum('remaining_amount')
            : (float) $this->debts()
                ->where('type', 'receivable')
                ->whereIn('status', ['open', 'partially_paid'])
                ->sum('remaining_amount');

        $surplus = 0.0;
        if ($this->relationLoaded('debts')) {
            foreach ($this->debts->where('type', 'receivable') as $d) {
                if ($d->relationLoaded('payments')) {
                    $paid = (float) $d->payments->sum('amount');
                    if ($paid > (float) $d->original_amount) {
                        $surplus += ($paid - (float) $d->original_amount);
                    }
                }
            }
        }

        return round(max(0.0, $open - $surplus), 2);
    }

    public function getOpenPayableAttribute(): float
    {
        $open = $this->relationLoaded('debts')
            ? (float) $this->debts
                ->where('type', 'payable')
                ->whereIn('status', ['open', 'partially_paid'])
                ->sum('remaining_amount')
            : (float) $this->debts()
                ->where('type', 'payable')
                ->whereIn('status', ['open', 'partially_paid'])
                ->sum('remaining_amount');

        $surplus = 0.0;
        if ($this->relationLoaded('debts')) {
            foreach ($this->debts->where('type', 'payable') as $d) {
                if ($d->relationLoaded('payments')) {
                    $paid = (float) $d->payments->sum('amount');
                    if ($paid > (float) $d->original_amount) {
                        $surplus += ($paid - (float) $d->original_amount);
                    }
                }
            }
        }

        return round(max(0.0, $open - $surplus), 2);
    }

    public function getNetBalanceAttribute(): float
    {
        return round($this->open_receivable - $this->open_payable, 2);
    }
}
