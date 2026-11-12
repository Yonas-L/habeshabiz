<?php

namespace App\Http\Resources;

use App\Models\SalesOrder;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesOrder
 */
class SalesOrderResource extends JsonResource
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
            'order_number' => $this->order_number,
            'customer_id' => $this->customer_id,
            'salesperson_id' => $this->salesperson_id,
            'total_amount' => $this->total_amount,
            'discount_amount' => $this->discount_amount,
            'write_off_amount' => $this->write_off_amount,
            'exchange_allowance' => $this->exchange_allowance,
            'exchange_unit_id' => $this->exchange_unit_id,
            'total_bonus_amount' => $this->total_bonus_amount,
            'paid_amount' => $this->paid_amount,
            'payment_status' => $this->payment_status,
            'credit_sale' => (bool) $this->credit_sale,
            'payment_method' => $this->payment_method,
            'financial_account_id' => $this->financial_account_id,
            'payment_splits' => $this->payment_splits,
            'is_vendor_sourced' => (bool) $this->is_vendor_sourced,
            'vendor_contact_id' => $this->vendor_contact_id,
            'vendor_cost_basis' => $this->when($canViewCost, $this->vendor_cost_basis),
            'notes' => $this->notes,
            'order_date' => $this->order_date ? Carbon::parse($this->order_date)->toISOString() : null,
            'bonus_info' => $this->bonus_info,
            'customer' => new ContactResource($this->whenLoaded('customer')),
            'salesperson' => new UserResource($this->whenLoaded('salesperson')),
            'financial_account' => new FinancialAccountResource($this->whenLoaded('financialAccount')),
            'exchange_unit' => new InventoryUnitResource($this->whenLoaded('exchangeUnit')),
            'items' => SalesOrderItemResource::collection($this->whenLoaded('items')),
            'vendor' => new ContactResource($this->whenLoaded('vendor')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
