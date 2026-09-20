<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProductVariant extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'product_id',
        'storage',
        'ram',
        'color',
        'specs',
        'sku',
        'default_selling_price',
    ];

    protected function casts(): array
    {
        return [
            'specs' => 'array',
            'default_selling_price' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function inventoryUnits(): HasMany
    {
        return $this->hasMany(InventoryUnit::class, 'variant_id');
    }

    public function stock(): HasOne
    {
        return $this->hasOne(InventoryStock::class, 'variant_id');
    }

    public function getDisplayNameAttribute(): string
    {
        $productName = $this->product instanceof Product ? $this->product->name : '';
        $parts = [$productName];
        if ($this->storage) {
            $parts[] = $this->storage;
        }
        if ($this->ram) {
            $parts[] = $this->ram.' RAM';
        }
        if ($this->color) {
            $parts[] = $this->color;
        }
        if (! empty($this->specs) && is_array($this->specs)) {
            foreach ($this->specs as $val) {
                if ($val) {
                    $parts[] = (string) $val;
                }
            }
        }

        return implode(' ', array_filter($parts));
    }
}
