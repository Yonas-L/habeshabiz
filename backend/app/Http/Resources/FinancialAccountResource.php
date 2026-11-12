<?php

namespace App\Http\Resources;

use App\Models\FinancialAccount;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FinancialAccount
 */
class FinancialAccountResource extends JsonResource
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
        $isOwner = $user ? $user->isOwner() : false;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'account_number' => $this->account_number,
            'currency' => $this->currency,
            'logo' => $this->logo,
            'current_balance' => $isOwner ? $this->current_balance : null,
            'default_fee_type' => $this->default_fee_type ?? 'none',
            'default_fee_amount' => $this->default_fee_amount ?? 0,
            'is_custom_asset' => (bool) $this->is_custom_asset,
            'asset_details' => $this->asset_details,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
