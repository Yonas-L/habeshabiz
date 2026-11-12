<?php

namespace App\Http\Resources;

use App\Models\InventoryUnit;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InventoryUnit
 */
class InventoryUnitResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user();
        $canViewCost = $user ? ($user->isOwner() || $user->canViewCosts()) : false;

        return [
            'id' => $this->id,
            'variant_id' => $this->variant_id,
            'imei_or_serial' => $this->imei_or_serial,
            'serial_number' => $this->serial_number,
            'battery_health' => $this->battery_health,
            'cycle_count' => $this->cycle_count,
            'sim_type' => $this->sim_type,
            'condition' => $this->condition,
            'cost_basis' => $this->when($canViewCost, $this->cost_basis),
            'selling_price' => $this->selling_price,
            'status' => $this->status,
            'customer_waiting' => (bool) $this->customer_waiting,
            'customer_waiting_at' => $this->customer_waiting_at ? Carbon::parse($this->customer_waiting_at)->toISOString() : null,
            'is_repaired' => (bool) $this->is_repaired,
            'is_swapped' => (bool) $this->is_swapped,
            'swapped_at' => $this->swapped_at ? Carbon::parse($this->swapped_at)->toISOString() : null,
            'swapped_sales_order_id' => $this->swapped_sales_order_id,
            'swapped_from_unit_id' => $this->swapped_from_unit_id,
            'swapped_replacement_unit_id' => $this->swapped_replacement_unit_id,
            'source_type' => $this->source_type,
            'funding_source' => $this->funding_source,
            'payment_account_id' => $this->payment_account_id,
            'payment_splits' => $this->payment_splits,
            'receivable_contact_id' => $this->receivable_contact_id,
            'receivable_offset_amount' => $this->receivable_offset_amount,
            'supplier_contact_id' => $this->supplier_contact_id,
            'exchange_sales_order_id' => $this->exchange_sales_order_id,
            'location' => $this->location,
            'handover_to' => $this->handover_to,
            'handed_out_at' => $this->handed_out_at ? Carbon::parse($this->handed_out_at)->toISOString() : null,
            'notes' => $this->notes,
            'return_reason' => $this->return_reason,
            'returned_at' => $this->returned_at ? Carbon::parse($this->returned_at)->toISOString() : null,
            'return_deadline' => $this->return_deadline ? Carbon::parse($this->return_deadline)->toDateString() : null,
            'handover_payout' => $this->handover_payout,
            'sold_at' => $this->sold_at ? Carbon::parse($this->sold_at)->toISOString() : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'variant' => new ProductVariantResource($this->whenLoaded('variant')),
            'supplier' => new ContactResource($this->whenLoaded('supplier')),
            'payment_account' => new FinancialAccountResource($this->whenLoaded('paymentAccount')),
            'paymentAccount' => new FinancialAccountResource($this->whenLoaded('paymentAccount')),
            'maintenance_records' => MaintenanceRecordResource::collection($this->whenLoaded('maintenanceRecords')),
            'sales_order_item' => new SalesOrderItemResource($this->whenLoaded('salesOrderItem')),
            'swapped_sales_order' => new SalesOrderResource($this->whenLoaded('swappedSalesOrder')),
            'swapped_from_unit' => new InventoryUnitResource($this->whenLoaded('swappedFromUnit')),
            'swapped_replacement_unit' => new InventoryUnitResource($this->whenLoaded('swappedReplacementUnit')),
        ];
    }
}
