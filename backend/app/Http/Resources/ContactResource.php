<?php

namespace App\Http\Resources;

use App\Models\Contact;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Contact
 */
class ContactResource extends JsonResource
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
            'phone' => $this->phone,
            'alt_phone' => $this->alt_phone,
            'email' => $this->email,
            'roles' => $this->roles ?? [],
            'notes' => $this->notes,
            'is_active' => (bool) $this->is_active,
            'statement_token' => $this->statement_token,
            'statement_overrides' => $this->statement_overrides,
            'net_balance' => $this->net_balance,
            'open_receivable' => $this->open_receivable,
            'open_payable' => $this->open_payable,
            'open_bonus_payable' => $this->open_bonus_payable,
            'debts_count' => $this->when(isset($this->debts_count), $this->debts_count),
            'sales_orders_count' => $this->when(isset($this->sales_orders_count), $this->sales_orders_count),
            'brokered_items_count' => $this->when(isset($this->brokered_items_count), $this->brokered_items_count),
            'supplied_units_count' => $this->when(isset($this->supplied_units_count), $this->supplied_units_count),
            'debts' => DebtResource::collection($this->whenLoaded('debts')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
