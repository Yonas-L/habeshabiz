<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function units(Request $request): JsonResponse
    {
        $query = InventoryUnit::with(['variant.product', 'supplier']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } else {
            $query->where('status', 'in_stock');
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('imei_or_serial', 'ilike', "%{$search}%")
                    ->orWhere('condition', 'ilike', "%{$search}%")
                    ->orWhereHas('variant.product', function ($pq) use ($search) {
                        $pq->where('name', 'ilike', "%{$search}%");
                    });
            });
        }

        $units = $query->latest()->get();

        // Check if user is allowed to view cost basis
        /** @var User|null $user */
        $user = $request->user();
        $canViewCost = $user ? $user->canViewCosts() : false;

        $mapped = $units->map(function ($unit) use ($canViewCost) {
            $data = $unit->toArray();
            if (! $canViewCost) {
                unset($data['cost_basis']);
            }

            return $data;
        });

        return response()->json([
            'success' => true,
            'data' => $mapped,
        ]);
    }

    public function intakeUnit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'variant_id' => ['required', 'exists:product_variants,id'],
            'imei_or_serial' => ['nullable', 'string', 'max:100'],
            'battery_health' => ['nullable', 'integer', 'min:50', 'max:100'],
            'cycle_count' => ['nullable', 'integer', 'min:0'],
            'sim_type' => ['required', 'string', 'in:physical,esim,dual'],
            'condition' => ['required', 'string', 'max:50'],
            'cost_basis' => ['required', 'numeric', 'min:0'],
            'supplier_contact_id' => ['nullable', 'exists:contacts,id'],
            'location' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        $unit = InventoryUnit::create(array_merge($validated, [
            'status' => 'in_stock',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Inventory unit recorded into stock.',
            'data' => $unit->load('variant.product'),
        ], 201);
    }

    public function stockSummary(Request $request): JsonResponse
    {
        $inStockUnits = InventoryUnit::with('variant.product')
            ->where('status', 'in_stock')
            ->get();

        $quantityStocks = InventoryStock::with('variant.product')->get();

        /** @var User|null $user */
        $user = $request->user();
        $canViewCost = $user ? $user->canViewCosts() : false;

        return response()->json([
            'success' => true,
            'data' => [
                'serialized_units_count' => $inStockUnits->count(),
                'serialized_cost_total' => $canViewCost ? $inStockUnits->sum('cost_basis') : null,
                'quantity_items_count' => $quantityStocks->sum('quantity_on_hand'),
                'quantity_cost_total' => $canViewCost ? $quantityStocks->sum(fn ($s) => $s->quantity_on_hand * (float) $s->average_cost) : null,
            ],
        ]);
    }
}
