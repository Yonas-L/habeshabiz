<?php

namespace App\Http\Resources;

use App\Models\SalesOrderItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesOrderItem
 */
class SalesOrderItemResource extends JsonResource
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
            'tenant_id' => $this->tenant_id,
            'sales_order_id' => $this->sales_order_id,
            'variant_id' => $this->variant_id,
            'inventory_unit_id' => $this->inventory_unit_id,
            'is_accessory' => (bool) $this->is_accessory,
            'accessory_name' => $this->accessory_name,
            'parent_item_id' => $this->parent_item_id,
            'quantity' => $this->quantity,
            'unit_price' => $this->unit_price,
            'setted_price' => $this->setted_price,
            'unit_cost' => $this->when($canViewCost, $this->unit_cost),
            'profit' => $this->when($canViewCost, $this->profit),
            'bonus_amount' => $this->bonus_amount,
            'sourcing_type' => $this->sourcing_type,
            'vendor_contact_id' => $this->vendor_contact_id,
            'vendor_cost' => $this->when($canViewCost, $this->vendor_cost),
            'sales_order' => new SalesOrderResource($this->whenLoaded('salesOrder')),
            'variant' => new ProductVariantResource($this->whenLoaded('variant')),
            'inventory_unit' => new InventoryUnitResource($this->whenLoaded('inventoryUnit')),
            'vendor_contact' => new ContactResource($this->whenLoaded('vendorContact')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
