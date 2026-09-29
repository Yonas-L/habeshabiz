<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $name
 * @property string $email
 * @property string|null $phone
 * @property string|null $business_name
 * @property string|null $message
 * @property bool $consented
 * @property string $status
 * @property Carbon|null $contacted_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PlatformWaitlist extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'platform_waitlist';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'business_name',
        'message',
        'consented',
        'status',
        'contacted_at',
    ];

    protected function casts(): array
    {
        return [
            'consented' => 'boolean',
            'contacted_at' => 'datetime',
        ];
    }

    public function scopeConsented(Builder $query): Builder
    {
        return $query->where('consented', true);
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', 'pending');
    }

    public function scopeContacted(Builder $query): Builder
    {
        return $query->where('status', 'contacted');
    }
}
