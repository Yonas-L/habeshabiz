<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesOrderItem extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'sales_order_id',
        'variant_id',
        'inventory_unit_id',
        'quantity',
        'unit_price',
        'unit_cost',
        'profit',
        'sourcing_type',
        'vendor_contact_id',
        'vendor_cost',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'unit_cost' => 'decimal:2',
            'profit' => 'decimal:2',
            'vendor_cost' => 'decimal:2',
        ];
    }

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function inventoryUnit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class, 'inventory_unit_id');
    }

    public function vendorContact(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'vendor_contact_id');
    }

    public function isBrokered(): bool
    {
        return $this->sourcing_type === 'brokered_neighbour';
    }
}
