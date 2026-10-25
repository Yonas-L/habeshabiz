<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProformaInvoice extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'tenant_id',
        'proforma_number',
        'created_by_user_id',
        'customer_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'customer_tin',
        'issue_date',
        'valid_until',
        'currency',
        'status',
        'subtotal',
        'discount_total',
        'taxable_amount',
        'vat_rate',
        'vat_total',
        'withholding_rate',
        'withholding_total',
        'shipping_fee',
        'total_amount',
        'net_payable',
        'payment_terms',
        'payment_method',
        'bank_account_id',
        'reference_number',
        'prepared_by',
        'notes',
        'delivery_terms',
        'signature_stamp_config',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date:Y-m-d',
            'valid_until' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'taxable_amount' => 'decimal:2',
            'vat_rate' => 'decimal:2',
            'vat_total' => 'decimal:2',
            'withholding_rate' => 'decimal:2',
            'withholding_total' => 'decimal:2',
            'shipping_fee' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'net_payable' => 'decimal:2',
            'signature_stamp_config' => 'array',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProformaInvoiceItem::class, 'proforma_invoice_id')->orderBy('item_number');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Contact::class, 'customer_id')->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id')->withTrashed();
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'bank_account_id')->withTrashed();
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Generate an incremental, unique proforma invoice number for a given tenant.
     * E.g. PI-2026-0001
     */
    public static function generateProformaNumber(string $tenantId): string
    {
        $year = date('Y');
        $prefix = "PI-{$year}-";

        $latest = static::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('proforma_number', 'LIKE', "{$prefix}%")
            ->orderByDesc('proforma_number')
            ->value('proforma_number');

        if ($latest && preg_match('/^PI-\d{4}-(\d+)$/', $latest, $matches)) {
            $nextSeq = (int) $matches[1] + 1;
        } else {
            $count = static::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->where('proforma_number', 'LIKE', "{$prefix}%")
                ->count();
            $nextSeq = $count + 1;
        }

        return sprintf('%s%04d', $prefix, $nextSeq);
    }
}
