<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
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

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        } elseif (! $request->filled('status')) {
            $query->where('status', 'in_stock');
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('imei_or_serial', 'ilike', "%{$search}%")
                    ->orWhere('condition', 'ilike', "%{$search}%")
                    ->orWhere('handover_to', 'ilike', "%{$search}%")
                    ->orWhere('return_reason', 'ilike', "%{$search}%")
                    ->orWhereHas('variant.product', function ($pq) use ($search) {
                        $pq->where('name', 'ilike', "%{$search}%");
                    });
            });
        }

        $units = $query->latest()->get();

        // Calculate tab counts
        $counts = [
            'in_stock' => InventoryUnit::where('status', 'in_stock')->count(),
            'out' => InventoryUnit::where('status', 'out')->count(),
            'sold' => InventoryUnit::where('status', 'sold')->count(),
            'returned' => InventoryUnit::where('status', 'returned')->count(),
            'all' => InventoryUnit::count(),
        ];

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
            'counts' => $counts,
        ]);
    }

    public function intakeUnit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'variant_id' => ['required', 'exists:product_variants,id'],
            'imei_or_serial' => ['nullable', 'string', 'max:100'],
            'battery_health' => ['nullable', 'integer', 'min:0', 'max:100'],
            'cycle_count' => ['nullable', 'integer', 'min:0'],
            'sim_type' => ['nullable', 'string', 'in:physical,esim,dual,na'],
            'condition' => ['required', 'string', 'max:50'],
            'cost_basis' => ['required', 'numeric', 'min:0'],
            'supplier_contact_id' => ['nullable', 'exists:contacts,id'],
            'location' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        if (empty($validated['sim_type'])) {
            $validated['sim_type'] = 'na';
        }

        $unit = InventoryUnit::create(array_merge($validated, [
            'status' => 'in_stock',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Inventory unit recorded into stock.',
            'data' => $unit->load('variant.product'),
        ], 201);
    }

    /**
     * Mark an in-stock unit as taken out by a staff member or broker to sell.
     */
    public function handoverUnit(Request $request, string $id): JsonResponse
    {
        $unit = InventoryUnit::findOrFail($id);

        if ($unit->status !== 'in_stock') {
            return response()->json([
                'success' => false,
                'message' => 'Only in-stock items can be marked as out for sale.',
            ], 422);
        }

        $validated = $request->validate([
            'handover_to' => ['required', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        $unit->update([
            'status' => 'out',
            'handover_to' => $validated['handover_to'],
            'handed_out_at' => now(),
            'location' => $validated['location'] ?? "Out with {$validated['handover_to']}",
            'notes' => ! empty($validated['notes'])
                ? ($unit->notes ? "{$unit->notes} | {$validated['notes']}" : $validated['notes'])
                : $unit->notes,
        ]);

        AuditLog::record(
            action: 'unit_handover',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'handover_to' => $validated['handover_to'],
                'location' => $unit->location,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Item handed out to {$validated['handover_to']} for sale.",
            'data' => $unit->load('variant.product'),
        ]);
    }

    /**
     * Restock an unsold item that was out with staff/broker back to shop shelf.
     * Note: Sold items are NOT restocked directly; they must go through customer return.
     */
    public function restockUnit(Request $request, string $id): JsonResponse
    {
        $unit = InventoryUnit::findOrFail($id);

        if ($unit->status === 'sold') {
            return response()->json([
                'success' => false,
                'message' => 'Sold products cannot be restocked. If returned by a customer, please process as a Customer Return.',
            ], 422);
        }

        if ($unit->status === 'in_stock') {
            return response()->json([
                'success' => false,
                'message' => 'This product is already in stock on the shop shelf.',
            ], 422);
        }

        $previousHandover = $unit->handover_to;

        $unit->update([
            'status' => 'in_stock',
            'handover_to' => null,
            'handed_out_at' => null,
            'location' => 'Shop Counter',
            'sold_at' => null,
        ]);

        $note = $previousHandover ? " (returned unsold by {$previousHandover})" : '';

        AuditLog::record(
            action: 'unit_restocked',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'previous_handover' => $previousHandover,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Device restocked back to shelf inventory{$note}.",
            'data' => $unit->load('variant.product'),
        ]);
    }

    /**
     * Process a return of a sold item by a customer.
     * Requires a reason and places unit in returned/repair tracking.
     */
    public function customerReturn(Request $request, string $id): JsonResponse
    {
        $unit = InventoryUnit::findOrFail($id);

        if ($unit->status !== 'sold') {
            return response()->json([
                'success' => false,
                'message' => 'Only sold products can be processed as customer returns.',
            ], 422);
        }

        $validated = $request->validate([
            'return_reason' => ['required', 'string', 'max:500'],
            'condition' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ]);

        $unit->update([
            'status' => 'returned',
            'return_reason' => $validated['return_reason'],
            'returned_at' => now(),
            'condition' => $validated['condition'] ?? $unit->condition,
            'location' => 'Repair & Inspection Shelf',
            'notes' => ! empty($validated['notes'])
                ? ($unit->notes ? "{$unit->notes} | Return note: {$validated['notes']}" : "Return note: {$validated['notes']}")
                : $unit->notes,
        ]);

        AuditLog::record(
            action: 'customer_return',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'return_reason' => $validated['return_reason'],
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Device returned by customer. Moved to Repair & Inspection shelf.',
            'data' => $unit->load('variant.product'),
        ]);
    }

    /**
     * Mark a returned/repaired unit as repaired and restock it to shop shelf.
     */
    public function repairAndRestock(Request $request, string $id): JsonResponse
    {
        $unit = InventoryUnit::findOrFail($id);

        if ($unit->status !== 'returned') {
            return response()->json([
                'success' => false,
                'message' => 'Only returned items can be processed as repaired & restocked.',
            ], 422);
        }

        $validated = $request->validate([
            'condition' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ]);

        $unit->update([
            'status' => 'in_stock',
            'condition' => $validated['condition'] ?? $unit->condition,
            'location' => 'Shop Counter',
            'notes' => ! empty($validated['notes'])
                ? ($unit->notes ? "{$unit->notes} | Repair note: {$validated['notes']}" : "Repair note: {$validated['notes']}")
                : $unit->notes,
        ]);

        AuditLog::record(
            action: 'unit_repaired_restocked',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'condition' => $unit->condition,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Device repaired and restocked back to shop shelf.',
            'data' => $unit->load('variant.product'),
        ]);
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
