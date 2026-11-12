<?php

namespace App\Http\Resources;

use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProductVariant
 */
class ProductVariantResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'storage' => $this->storage,
            'ram' => $this->ram,
            'color' => $this->color,
            'specs' => $this->specs,
            'sku' => $this->sku,
            'default_selling_price' => $this->default_selling_price,
            'display_name' => $this->display_name,
            'stock' => new InventoryStockResource($this->whenLoaded('stock')),
            'inventory_units' => InventoryUnitResource::collection($this->whenLoaded('inventoryUnits')),
            'product' => new ProductResource($this->whenLoaded('product')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
