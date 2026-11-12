<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
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
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role,
            'permissions' => $this->permissions ?? [],
            'can_view_costs' => $this->canViewCosts(),
            'can_discount' => $this->canDiscount(),
            'can_handover' => $this->canHandover(),
            'can_intake_stock' => $this->canIntakeStock(),
            'can_manage_inventory' => $this->canManageInventory(),
        ];
    }
}
