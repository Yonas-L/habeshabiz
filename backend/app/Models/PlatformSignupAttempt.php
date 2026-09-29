<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $email
 * @property string|null $business_name
 * @property string $outcome
 * @property Carbon $created_at
 */
class PlatformSignupAttempt extends Model
{
    use HasFactory, HasUuids;

    public $timestamps = false;

    protected $table = 'platform_signup_attempts';

    protected $fillable = [
        'email',
        'business_name',
        'outcome',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PlatformSignupAttempt $attempt): void {
            if ($attempt->created_at === null) {
                $attempt->created_at = now();
            }
        });
    }
}
