<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string|null $tenant_id
 * @property string|null $phone
 * @property string $role
 * @property array<string, mixed>|null $permissions
 * @property bool $is_active
 * @property Tenant|null $tenant
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'tenant_id',
        'phone',
        'role',
        'permissions',
        'is_active',
        'last_device',
        'last_device_type',
        'last_browser',
        'last_login_ip',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'permissions' => 'array',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isManager(): bool
    {
        return in_array($this->role, ['owner', 'manager'], true);
    }

    public function isSalesperson(): bool
    {
        return $this->role === 'salesperson';
    }

    public function canViewCosts(): bool
    {
        if ($this->isManager()) {
            return true;
        }

        $permissions = is_array($this->permissions) ? $this->permissions : [];

        return (bool) ($permissions['can_view_costs'] ?? false);
    }

    public function canDiscount(): bool
    {
        if ($this->isManager()) {
            return true;
        }

        $permissions = is_array($this->permissions) ? $this->permissions : [];

        return (bool) ($permissions['can_discount'] ?? false);
    }

    public function canHandover(): bool
    {
        if ($this->isManager()) {
            return true;
        }

        $permissions = is_array($this->permissions) ? $this->permissions : [];

        return (bool) ($permissions['can_handover'] ?? false);
    }

    public function canIntakeStock(): bool
    {
        if ($this->isManager()) {
            return true;
        }

        $permissions = is_array($this->permissions) ? $this->permissions : [];

        return (bool) ($permissions['can_intake_stock'] ?? false);
    }

    public function canManageInventory(): bool
    {
        if ($this->isManager()) {
            return true;
        }

        $permissions = is_array($this->permissions) ? $this->permissions : [];

        return (bool) ($permissions['can_manage_inventory'] ?? false);
    }
}
