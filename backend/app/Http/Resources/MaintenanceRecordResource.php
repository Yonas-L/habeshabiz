<?php

namespace App\Http\Resources;

use App\Models\MaintenanceRecord;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MaintenanceRecord
 */
class MaintenanceRecordResource extends JsonResource
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
            'inventory_unit_id' => $this->inventory_unit_id,
            'cost' => $this->when($canViewCost, $this->cost),
            'is_capitalized' => (bool) $this->is_capitalized,
            'billing_type' => $this->billing_type,
            'vendor_contact_id' => $this->vendor_contact_id,
            'vendor_debt_id' => $this->vendor_debt_id,
            'financial_account_id' => $this->financial_account_id,
            'payment_splits' => $this->when($canViewCost, $this->payment_splits),
            'description' => $this->description,
            'date' => Carbon::parse($this->date)->toISOString(),
            'financial_account' => new FinancialAccountResource($this->whenLoaded('financialAccount')),
            'vendor_contact' => new ContactResource($this->whenLoaded('vendorContact')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
