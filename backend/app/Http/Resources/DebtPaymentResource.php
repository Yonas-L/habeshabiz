<?php

namespace App\Http\Resources;

use App\Models\DebtPayment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DebtPayment
 */
class DebtPaymentResource extends JsonResource
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
            'tenant_id' => $this->tenant_id,
            'debt_id' => $this->debt_id,
            'split_group_id' => $this->split_group_id,
            'financial_account_id' => $this->financial_account_id,
            'amount' => $this->amount,
            'payment_date' => $this->payment_date ? Carbon::parse($this->payment_date)->toISOString() : null,
            'reference_number' => $this->reference_number,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'financial_account' => new FinancialAccountResource($this->whenLoaded('financialAccount')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
