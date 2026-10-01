<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'phone',
        'currency_code',
        'business_type',
        'settings',
        'is_active',
        'is_locked',
        'lock_reason',
        'locked_at',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'is_active' => 'boolean',
            'is_locked' => 'boolean',
            'locked_at' => 'datetime',
        ];
    }

    public function getSettingsAttribute($value): array
    {
        $settings = is_array($value) ? $value : (json_decode($value ?? '[]', true) ?: []);
        if (!empty($settings['logo_url']) && is_string($settings['logo_url'])) {
            $settings['logo_url'] = self::normalizeStorageUrl($settings['logo_url']);
        }
        return $settings;
    }

    public static function normalizeStorageUrl(string $url): string
    {
        if (str_starts_with($url, 'data:') || str_starts_with($url, 'blob:')) {
            return $url;
        }

        $storagePos = strpos($url, '/storage/');
        if ($storagePos !== false) {
            $path = substr($url, $storagePos);
            $baseUrl = config('app.url');
            if (empty($baseUrl) || str_contains($baseUrl, 'localhost')) {
                if (app()->runningInConsole()) {
                    $baseUrl = env('APP_URL', 'https://habeshabiz-backend.onrender.com');
                } else {
                    $baseUrl = request()?->getSchemeAndHttpHost() ?: 'https://habeshabiz-backend.onrender.com';
                }
            }
            if ((request()?->header('X-Forwarded-Proto') === 'https') || str_starts_with($baseUrl, 'https://')) {
                $baseUrl = preg_replace('/^http:\/\//i', 'https://', $baseUrl);
            }
            return rtrim($baseUrl, '/') . $path;
        }

        return $url;
    }

    public function scopeLocked(Builder $query): Builder
    {
        return $query->where('is_locked', true);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_locked', false);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function financialAccounts(): HasMany
    {
        return $this->hasMany(FinancialAccount::class);
    }

    public function salesOrders(): HasMany
    {
        return $this->hasMany(SalesOrder::class);
    }

    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }
}
