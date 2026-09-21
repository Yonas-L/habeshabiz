<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryUnit extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'variant_id',
        'imei_or_serial',
        'battery_health',
        'cycle_count',
        'sim_type',
        'condition',
        'cost_basis',
        'status',
        'source_type',
        'supplier_contact_id',
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
            'handover_payout' => 'decimal:2',
            'handed_out_at' => 'datetime',
            'returned_at' => 'datetime',
            'return_deadline' => 'date',
            'sold_at' => 'datetime',
        ];
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'supplier_contact_id');
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }

    public function isAvailable(): bool
    {
        return $this->status === 'in_stock';
    }
}
