<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contact extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'name',
        'phone',
        'alt_phone',
        'email',
        'roles',
        'notes',
        'is_active',
    ];

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
}
