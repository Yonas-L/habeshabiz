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

    /**
     * Convert an uploaded logo file to a base64 data URI for permanent DB persistence on ephemeral hosting.
     */
    public static function convertUploadedFileToDataUri(\Illuminate\Http\UploadedFile $file): string
    {
        $mime = $file->getMimeType() ?: 'image/png';
        $realPath = $file->getRealPath();

        // If SVG or GD not loaded, return base64 data URI directly
        if (str_contains($mime, 'svg') || !extension_loaded('gd') || !function_exists('imagecreatefromstring')) {
            $contents = file_get_contents($realPath);
            return 'data:' . $mime . ';base64,' . base64_encode($contents);
        }

        try {
            $rawContent = file_get_contents($realPath);
            $srcImg = @imagecreatefromstring($rawContent);
            if ($srcImg) {
                $width = imagesx($srcImg);
                $height = imagesy($srcImg);
                $maxDimension = 512;

                if ($width > $maxDimension || $height > $maxDimension) {
                    if ($width >= $height) {
                        $newWidth = $maxDimension;
                        $newHeight = (int) round(($height / $width) * $maxDimension);
                    } else {
                        $newHeight = $maxDimension;
                        $newWidth = (int) round(($width / $height) * $maxDimension);
                    }

                    $dstImg = imagecreatetruecolor($newWidth, $newHeight);
                    imagealphablending($dstImg, false);
                    imagesavealpha($dstImg, true);
                    $transparent = imagecolorallocatealpha($dstImg, 255, 255, 255, 127);
                    imagefilledrectangle($dstImg, 0, 0, $newWidth, $newHeight, $transparent);

                    imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                    imagedestroy($srcImg);
                    $srcImg = $dstImg;
                }

                ob_start();
                if (str_contains($mime, 'png') || str_contains($mime, 'webp') || str_contains($mime, 'gif')) {
                    imagepng($srcImg, null, 6);
                    $outMime = 'image/png';
                } else {
                    imagejpeg($srcImg, null, 85);
                    $outMime = 'image/jpeg';
                }
                $imgData = ob_get_clean();
                imagedestroy($srcImg);

                if (!empty($imgData)) {
                    return 'data:' . $outMime . ';base64,' . base64_encode($imgData);
                }
            }
        } catch (\Throwable $e) {
            // Fallback to direct file encoding
        }

        $contents = file_get_contents($realPath);
        return 'data:' . $mime . ';base64,' . base64_encode($contents);
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
