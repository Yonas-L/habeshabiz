<?php

namespace App\Http\Resources;

use App\Models\Debt;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Debt
 */
class DebtResource extends JsonResource
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
            'contact_id' => $this->contact_id,
            'salesperson_id' => $this->salesperson_id,
            'type' => $this->type,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'original_amount' => $this->original_amount,
            'paid_amount' => $this->paid_amount,
            'remaining_amount' => $this->remaining_amount,
            'due_date' => $this->due_date ? Carbon::parse($this->due_date)->toDateString() : null,
            'status' => $this->status,
            'notes' => $this->notes,
            'payment_splits' => $this->payment_splits,
            'contact' => new ContactResource($this->whenLoaded('contact')),
            'salesperson' => new UserResource($this->whenLoaded('salesperson')),
            'payments' => DebtPaymentResource::collection($this->whenLoaded('payments')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
