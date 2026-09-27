<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryUnit extends Model
{
    use BelongsToTenant, HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'variant_id',
        'imei_or_serial',
        'battery_health',
        'cycle_count',
        'sim_type',
        'condition',
        'cost_basis',
        'selling_price',
        'status',
        'customer_waiting',
        'customer_waiting_at',
        'is_repaired',
        'is_swapped',
        'swapped_at',
        'swapped_sales_order_id',
        'swapped_from_unit_id',
        'swapped_replacement_unit_id',
        'source_type',
        'supplier_contact_id',
        'exchange_sales_order_id',
        'location',
        'handover_to',
        'handed_out_at',
        'notes',
        'return_reason',
        'returned_at',
        'return_deadline',
        'handover_payout',
        'sold_at',
    ];

    protected function casts(): array
    {
        return [
            'battery_health' => 'integer',
            'cycle_count' => 'integer',
            'cost_basis' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'customer_waiting' => 'boolean',
            'customer_waiting_at' => 'datetime',
            'is_repaired' => 'boolean',
            'is_swapped' => 'boolean',
            'swapped_at' => 'datetime',
            'handover_payout' => 'decimal:2',
            'handed_out_at' => 'datetime',
            'returned_at' => 'datetime',
            'return_deadline' => 'date',
            'sold_at' => 'datetime',
        ];
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id')->withTrashed();
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_contact_id')->withTrashed();
    }

    public function exchangeSalesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'exchange_sales_order_id');
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }

    public function salesOrderItem(): HasOne
    {
        return $this->hasOne(SalesOrderItem::class, 'inventory_unit_id');
    }

    public function swappedSalesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'swapped_sales_order_id');
    }

    public function swappedFromUnit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class, 'swapped_from_unit_id');
    }

    public function swappedReplacementUnit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class, 'swapped_replacement_unit_id');
    }

    public function isAvailable(): bool
    {
        return $this->status === 'in_stock';
    }
}
