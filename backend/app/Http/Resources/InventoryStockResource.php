<?php

namespace App\Http\Resources;

use App\Models\InventoryStock;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InventoryStock
 */
class InventoryStockResource extends JsonResource
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
            'variant_id' => $this->variant_id,
            'quantity_on_hand' => $this->quantity_on_hand,
            'average_cost' => $this->when($canViewCost, $this->average_cost),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
