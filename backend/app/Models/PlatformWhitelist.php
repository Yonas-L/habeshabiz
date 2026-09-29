<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string|null $email
 * @property string|null $notes
 * @property string $status
 * @property Carbon|null $used_at
 * @property string|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property PlatformAdmin|null $creator
 */
class PlatformWhitelist extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'platform_whitelist';

    protected $fillable = [
        'email',
        'notes',
        'status',
        'used_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'used_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(PlatformAdmin::class, 'created_by');
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', 'pending');
    }

    public function scopeUsed(Builder $query): Builder
    {
        return $query->where('status', 'used');
    }
}
