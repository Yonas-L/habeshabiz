<?php

namespace App\Models;

use App\Actions\Undo\UndoActionFactory;
use App\Scopes\TenantScope;
use App\Traits\BelongsToTenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $tenant_id
 * @property int|null $user_id
 * @property string $action
 * @property string $entity_type
 * @property string|null $entity_id
 * @property string|null $revert_group_id
 * @property array<string, mixed>|null $old_values
 * @property array<string, mixed>|null $new_values
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property Carbon|null $created_at
 * @property Carbon|null $reverted_at
 * @property int|null $reverted_by
 * @property-read User|null $user
 * @property-read User|null $revertedByUser
 */
class AuditLog extends Model
{
    use BelongsToTenant, HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'action',
        'entity_type',
        'entity_id',
        'revert_group_id',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
        'created_at',
        'reverted_at',
        'reverted_by',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
            'reverted_at' => 'datetime',
        ];
    }

    protected $appends = [
        'can_undo',
        'is_reverted',
        'reverted_by_name',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function revertedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reverted_by');
    }

    public function isReverted(): bool
    {
        return $this->reverted_at !== null;
    }

    public function isWithinUndoWindow(): bool
    {
        return $this->created_at !== null && $this->created_at->gte(now()->subHours(24));
    }

    public function canBeUndone(): bool
    {
        return ! $this->isReverted()
            && $this->isWithinUndoWindow()
            && UndoActionFactory::isUndoable($this->action);
    }

    public function getCanUndoAttribute(): bool
    {
        return $this->canBeUndone();
    }

    public function getIsRevertedAttribute(): bool
    {
        return $this->isReverted();
    }

    public function getRevertedByNameAttribute(): ?string
    {
        return $this->revertedByUser?->name;
    }

    /**
     * Record an audit event.
     */
    public static function record(
        string $action,
        string $entityType,
        ?string $entityId = null,
        ?array $newValues = null,
        ?array $oldValues = null,
        ?int $userId = null,
        ?string $revertGroupId = null
    ): self {
        $tenantId = TenantScope::getActiveTenantId();

        return static::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId ?? auth()->id(),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'revert_group_id' => $revertGroupId,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => request()->ip(),
            'user_agent' => substr((string) request()->userAgent(), 0, 255),
            'created_at' => now(),
        ]);
    }
}
